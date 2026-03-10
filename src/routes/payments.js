import express from 'express';
import { Op } from 'sequelize';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { authRequired } from '../middleware/auth.js';
import { Order, Product, User, Promotion, GiftCard } from '../models/index.js';
import { sendOrderConfirmation, sendInvoiceEmail } from '../utils/emailService.js';

// ── Helper: decrement stock in JSONB variants or plain stock ──
async function decrementStock(productId, variantId, quantity) {
  const product = await Product.findByPk(productId);
  if (!product) return;
  if (variantId) {
    const variants = [...(product.variants || [])];
    const idx = variants.findIndex(v => String(v._id || v.id) === String(variantId));
    if (idx >= 0 && variants[idx].stock >= quantity) {
      variants[idx] = { ...variants[idx], stock: variants[idx].stock - quantity };
      product.variants = variants;
      product.changed('variants', true);
      await product.save();
    }
  } else {
    if (product.stock >= quantity) {
      product.stock = product.stock - quantity;
      await product.save();
    }
  }
}

const router = express.Router();

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || '',
});

// ── POST /payments/create-preference ──
// Creates a pending order + MP preference, returns the preference init_point
router.post('/create-preference', authRequired, async (req, res) => {
  try {
    const {
      items, promoCode, address, address2, department, postalCode,
      cedula, phone, paymentMethod, userName, email,
      shippingCity, shippingCost, giftCardCode
    } = req.body;

    // ── Validations (same as orders route) ──
    const requester = await User.findById(req.user.id);
    if (!requester || !requester.emailVerified) {
      return res.status(403).json({ error: 'Debes verificar tu cuenta de correo antes de realizar pedidos.' });
    }
    if (!address || !address.trim()) return res.status(400).json({ error: 'La dirección de envío es obligatoria' });
    if (!phone || !phone.trim()) return res.status(400).json({ error: 'El número de teléfono es obligatorio' });
    if (!shippingCity || !shippingCity.trim()) return res.status(400).json({ error: 'La ciudad de envío es obligatoria' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'El carrito está vacío' });

    // Validate stock and compute subtotal
    const productIds = items.map(i => i.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    const map = new Map(products.map(p => [String(p._id), p]));

    let subtotal = 0;
    const orderItems = [];
    const mpItems = [];

    for (const it of items) {
      const p = map.get(String(it.productId));
      if (!p) throw new Error('Product not found');
      let unitPrice = p.price;
      if (it.variantId) {
        const v = (p.variants || []).find(v => String(v._id || v.id) === String(it.variantId));
        if (!v) throw new Error('Variant not found');
        if (v.stock < it.quantity) throw new Error(`Stock insuficiente para ${p.name} (${v.size}/${v.color})`);
        if (typeof v.priceOverride === 'number') unitPrice = v.priceOverride;
        orderItems.push({
          productId: p.id, productName: p.name, productPrice: unitPrice,
          quantity: it.quantity, category: p.category,
          variant: { id: v._id || v.id, size: v.size, color: v.color }
        });
      } else {
        if (p.stock < it.quantity) throw new Error(`Stock insuficiente para ${p.name}`);
        orderItems.push({
          productId: p.id, productName: p.name, productPrice: unitPrice,
          quantity: it.quantity, category: p.category
        });
      }
      subtotal += unitPrice * it.quantity;
      mpItems.push({
        id: String(p.id),
        title: p.name + (it.variantId ? ` (${orderItems[orderItems.length-1].variant?.size||''}/${orderItems[orderItems.length-1].variant?.color||''})` : ''),
        quantity: it.quantity,
        unit_price: unitPrice,
        currency_id: 'COP',
      });
    }

    let discount = 0;
    let total = subtotal;
    if (promoCode) {
      const promo = await Promotion.findOne({ where: { code: promoCode.toUpperCase(), active: true } });
      if (!promo) return res.status(400).json({ error: 'Código de promoción inválido' });
      discount = subtotal * (promo.discount / 100);
      total = subtotal - discount;
    }

    // Shipping
    let shipping = 0;
    if (shippingCity) {
      const tariffs = { 'Bogotá': 12000, 'Medellín': 15000, 'Cali': 15000 };
      shipping = tariffs[shippingCity] ?? 18000;
      total += shipping;
    }

    // Gift card
    let giftApplied = 0;
    let giftCodeSaved = undefined;
    if (giftCardCode) {
      const gc = await GiftCard.findOne({ where: { code: String(giftCardCode).toUpperCase(), active: true } });
      if (!gc) return res.status(400).json({ error: 'Gift card inválida' });
      giftApplied = Math.min(gc.balance, total);
      total = total - giftApplied;
      giftCodeSaved = gc.code;
      // NOTE: Don't debit gift card yet — only on payment confirmation
    }

    // Create order with status 'pendiente_pago'
    const order = await Order.create({
      userId: req.user.id,
      userName, email, address, address2: address2 || '', department: department || '',
      postalCode: postalCode || '', cedula: cedula || '', phone,
      paymentMethod: 'mercadopago',
      items: orderItems,
      subtotal, discount, shippingCity, shippingCost: shipping,
      giftCardCode: giftCodeSaved, giftApplied, total,
      status: 'pendiente_pago',
      date: new Date(),
      invoiceNumber: `FAC-${Date.now()}`
    });

    // Add shipping as an item if present
    if (shipping > 0) {
      mpItems.push({
        id: 'shipping',
        title: `Envío a ${shippingCity}`,
        quantity: 1,
        unit_price: shipping,
        currency_id: 'COP',
      });
    }

    // Adjust for discount and gift card in MP items
    if (discount > 0) {
      mpItems.push({
        id: 'discount',
        title: `Descuento (${promoCode.toUpperCase()})`,
        quantity: 1,
        unit_price: -discount,
        currency_id: 'COP',
      });
    }
    if (giftApplied > 0) {
      mpItems.push({
        id: 'giftcard',
        title: `Gift Card (${giftCodeSaved})`,
        quantity: 1,
        unit_price: -giftApplied,
        currency_id: 'COP',
      });
    }

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:5502/index.html';
    const API_URL = process.env.API_URL || 'http://localhost:4000';

    const preferenceClient = new Preference(mpClient);
    const preference = await preferenceClient.create({
      body: {
        items: mpItems,
        payer: {
          name: userName || '',
          email: email || '',
        },
        back_urls: {
          success: `${FRONTEND_URL}?mp_status=approved&order_id=${order.id}`,
          failure: `${FRONTEND_URL}?mp_status=rejected&order_id=${order.id}`,
          pending: `${FRONTEND_URL}?mp_status=pending&order_id=${order.id}`,
        },
        auto_return: 'approved',
        external_reference: String(order.id),
        notification_url: `${API_URL}/payments/webhook`,
      }
    });

    res.json({
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
      orderId: order.id,
    });
  } catch (err) {
    console.error('MP preference error:', err);
    res.status(400).json({ error: err.message || 'Error creating payment' });
  }
});

// ── POST /payments/webhook ──
// Mercado Pago IPN webhook
router.post('/webhook', async (req, res) => {
  try {
    const { type, data } = req.body;
    if (type === 'payment' && data?.id) {
      const paymentClient = new Payment(mpClient);
      const payment = await paymentClient.get({ id: data.id });

      if (payment && payment.external_reference) {
        const orderId = payment.external_reference;
        const order = await Order.findByPk(orderId);
        if (!order) return res.sendStatus(200);

        if (payment.status === 'approved' && order.status === 'pendiente_pago') {
          order.status = 'confirmado';
          order.mpPaymentId = String(payment.id);
          order.mpStatus = payment.status;
          await order.save();

          // Decrement stock
          for (const item of order.items) {
            await decrementStock(item.productId, item.variant?.id, item.quantity);
          }

          // Debit gift card if used
          if (order.giftCardCode && order.giftApplied > 0) {
            const gc = await GiftCard.findOne({ where: { code: order.giftCardCode, active: true } });
            if (gc) {
              gc.balance = Math.max(0, gc.balance - order.giftApplied);
              if (gc.balance <= 0) gc.active = false;
              await gc.save();
            }
          }

          // Send emails
          if (order.email) {
            sendOrderConfirmation(order).catch(e => console.error('📧 MP order confirm email failed:', e.message));
            sendInvoiceEmail(order).catch(e => console.error('📧 MP invoice email failed:', e.message));
          }

          console.log(`✅ MP Payment approved for order ${orderId}`);
        } else if (payment.status === 'rejected') {
          order.mpStatus = 'rejected';
          order.mpPaymentId = String(payment.id);
          await order.save();
          console.log(`❌ MP Payment rejected for order ${orderId}`);
        } else if (payment.status === 'pending' || payment.status === 'in_process') {
          order.mpStatus = payment.status;
          order.mpPaymentId = String(payment.id);
          await order.save();
        }
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('MP webhook error:', err);
    res.sendStatus(200); // Always return 200 to MP
  }
});

// ── GET /payments/status/:orderId ──
// Check order payment status (used by frontend after redirect)
router.get('/status/:orderId', authRequired, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
    if (String(order.userId) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    res.json({
      orderId: order.id,
      status: order.status,
      mpStatus: order.mpStatus || null,
      total: order.total,
      invoiceNumber: order.invoiceNumber,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /payments/process ──
// Checkout API: receives a card token from the frontend, creates payment directly
router.post('/process', authRequired, async (req, res) => {
  try {
    const {
      token, installments, issuerId, paymentMethodId,
      items, promoCode, address, address2, department, postalCode,
      cedula, phone, userName, email,
      shippingCity, shippingCost, giftCardCode, payerEmail
    } = req.body;

    if (!token) return res.status(400).json({ error: 'Token de pago requerido' });

    // ── Validations ──
    const requester = await User.findByPk(req.user.id);
    if (!requester || !requester.emailVerified) {
      return res.status(403).json({ error: 'Debes verificar tu cuenta de correo antes de realizar pedidos.' });
    }
    if (!address || !address.trim()) return res.status(400).json({ error: 'La dirección de envío es obligatoria' });
    if (!phone || !phone.trim()) return res.status(400).json({ error: 'El número de teléfono es obligatorio' });
    if (!shippingCity || !shippingCity.trim()) return res.status(400).json({ error: 'La ciudad de envío es obligatoria' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'El carrito está vacío' });

    // Validate stock and compute subtotal
    const productIds = items.map(i => i.productId);
    const products = await Product.findAll({ where: { id: { [Op.in]: productIds } } });
    const map = new Map(products.map(p => [String(p.id), p]));

    let subtotal = 0;
    const orderItems = [];
    for (const it of items) {
      const p = map.get(String(it.productId));
      if (!p) throw new Error('Product not found');
      let unitPrice = p.price;
      if (it.variantId) {
        const v = (p.variants || []).find(v => String(v._id || v.id) === String(it.variantId));
        if (!v) throw new Error('Variant not found');
        if (v.stock < it.quantity) throw new Error(`Stock insuficiente para ${p.name} (${v.size}/${v.color})`);
        if (typeof v.priceOverride === 'number') unitPrice = v.priceOverride;
        orderItems.push({ productId: p.id, productName: p.name, productPrice: unitPrice, quantity: it.quantity, category: p.category, variant: { id: v._id || v.id, size: v.size, color: v.color } });
      } else {
        if (p.stock < it.quantity) throw new Error(`Stock insuficiente para ${p.name}`);
        orderItems.push({ productId: p.id, productName: p.name, productPrice: unitPrice, quantity: it.quantity, category: p.category });
      }
      subtotal += unitPrice * it.quantity;
    }

    let discount = 0;
    let total = subtotal;
    if (promoCode) {
      const promo = await Promotion.findOne({ where: { code: promoCode.toUpperCase(), active: true } });
      if (!promo) return res.status(400).json({ error: 'Código de promoción inválido' });
      discount = subtotal * (promo.discount / 100);
      total = subtotal - discount;
    }

    let shipping = 0;
    if (shippingCity) {
      const tariffs = { 'Bogotá': 12000, 'Medellín': 15000, 'Cali': 15000 };
      shipping = tariffs[shippingCity] ?? 18000;
      total += shipping;
    }

    let giftApplied = 0;
    let giftCodeSaved = undefined;
    if (giftCardCode) {
      const gc = await GiftCard.findOne({ where: { code: String(giftCardCode).toUpperCase(), active: true } });
      if (!gc) return res.status(400).json({ error: 'Gift card inválida' });
      giftApplied = Math.min(gc.balance, total);
      total = total - giftApplied;
      giftCodeSaved = gc.code;
    }

    // Create order first
    const order = await Order.create({
      userId: req.user.id,
      userName, email, address, address2: address2 || '', department: department || '',
      postalCode: postalCode || '', cedula: cedula || '', phone,
      paymentMethod: 'mercadopago',
      items: orderItems,
      subtotal, discount, shippingCity, shippingCost: shipping,
      giftCardCode: giftCodeSaved, giftApplied, total,
      status: 'pendiente_pago',
      date: new Date(),
      invoiceNumber: `FAC-${Date.now()}`
    });

    // Process payment with MP (or simulate in sandbox mode)
    const sandboxVal = (process.env.MP_SANDBOX || '').trim().toLowerCase();
    const isSandbox = sandboxVal === 'true' || sandboxVal === '1' || sandboxVal === 'yes';
    console.log('MP_SANDBOX env value:', JSON.stringify(process.env.MP_SANDBOX), '→ isSandbox:', isSandbox);
    let mpPayment;

    if (isSandbox) {
      // Simulate approved payment for testing
      console.log('🧪 MP_SANDBOX mode: simulating approved payment for order', order.invoiceNumber);
      mpPayment = {
        id: `SANDBOX-${Date.now()}`,
        status: 'approved',
        status_detail: 'accredited',
      };
    } else {
      const paymentClient = new Payment(mpClient);
      mpPayment = await paymentClient.create({
        body: {
          transaction_amount: total,
          token: token,
          description: `Pedido PuraLino #${order.invoiceNumber}`,
          installments: installments || 1,
          payment_method_id: paymentMethodId || undefined,
          issuer_id: issuerId || undefined,
          payer: { email: payerEmail || email },
          external_reference: String(order.id),
        }
      });
    }

    // Update order based on payment result
    order.mpPaymentId = String(mpPayment.id);
    order.mpStatus = mpPayment.status;

    if (mpPayment.status === 'approved') {
      order.status = 'confirmado';
      await order.save();

      // Decrement stock
      for (const item of order.items) {
        await decrementStock(item.productId, item.variant?.id, item.quantity);
      }

      // Debit gift card
      if (giftCodeSaved && giftApplied > 0) {
        const gc = await GiftCard.findOne({ where: { code: giftCodeSaved, active: true } });
        if (gc) {
          gc.balance = Math.max(0, gc.balance - giftApplied);
          if (gc.balance <= 0) gc.active = false;
          await gc.save();
        }
      }

      // Send emails
      if (order.email) {
        sendOrderConfirmation(order).catch(e => console.error('📧 MP order email failed:', e.message));
        sendInvoiceEmail(order).catch(e => console.error('📧 MP invoice email failed:', e.message));
      }

      res.json({ status: 'approved', order: order.toJSON() });
    } else if (mpPayment.status === 'rejected') {
      await order.save();
      const detail = mpPayment.status_detail || 'rejected';
      res.status(400).json({ status: 'rejected', error: `Pago rechazado: ${detail}`, detail });
    } else {
      // pending / in_process
      await order.save();
      res.json({ status: mpPayment.status, orderId: order.id, message: 'Pago pendiente de confirmación' });
    }
  } catch (err) {
    console.error('MP process payment error:', err);
    res.status(400).json({ error: err.message || 'Error processing payment' });
  }
});

// ── GET /payments/config ──
// Returns the MP public key for frontend SDK initialization
router.get('/config', (req, res) => {
  const sandboxVal = (process.env.MP_SANDBOX || '').trim().toLowerCase();
  const isSandbox = sandboxVal === 'true' || sandboxVal === '1' || sandboxVal === 'yes';
  res.json({ publicKey: process.env.MP_PUBLIC_KEY || '', sandbox: isSandbox });
});

export default router;
