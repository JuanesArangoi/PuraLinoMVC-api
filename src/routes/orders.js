import express from 'express';
import { Op } from 'sequelize';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { Order, Product, User, Promotion, GiftCard } from '../models/index.js';
import { sendOrderConfirmation, sendInvoiceEmail, sendOrderStatusUpdate, sendTrackingUpdate } from '../utils/emailService.js';
import { logActivity } from '../helpers/auditLog.js';

const router = express.Router();

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

router.get('/', authRequired, adminOnly, async (req,res)=>{
  const list = await Order.findAll({ order: [['createdAt', 'DESC']] });
  res.json(list);
});

router.get('/me', authRequired, async (req,res)=>{
  const list = await Order.findAll({ where: { userId: req.user.id }, order: [['createdAt', 'DESC']] });
  res.json(list);
});

// Tracking endpoints
router.get('/:id/tracking', authRequired, async (req,res)=>{
  const { id } = req.params;
  const o = await Order.findByPk(id);
  if(!o) return res.status(404).json({ error:'Not found' });
  // allow only owner or admin
  if(String(o.userId)!==String(req.user.id) && req.user.role!=='admin') return res.status(403).json({ error:'Forbidden' });
  res.json({ trackingNumber: o.trackingNumber||'', carrier: o.carrier||'', events: o.trackingEvents||[] });
});

router.patch('/:id/tracking/meta', authRequired, adminOnly, async (req,res)=>{
  const { id } = req.params; const { trackingNumber, carrier } = req.body||{};
  const o = await Order.findByPk(id);
  if(!o) return res.status(404).json({ error:'Not found' });
  await o.update({ trackingNumber, carrier });
  logActivity({ action:'UPDATE', entity:'order', entityId:o.id, entityName:o.invoiceNumber||id, req, details:{ trackingNumber, carrier } });
  res.json({ trackingNumber: o.trackingNumber||'', carrier: o.carrier||'' });
});

router.post('/:id/tracking', authRequired, adminOnly, async (req,res)=>{
  const { id } = req.params; const { status, note } = req.body||{};
  if(!status) return res.status(400).json({ error:'status required' });
  const o = await Order.findByPk(id);
  if(!o) return res.status(404).json({ error:'Not found' });
  const events = [...(o.trackingEvents || []), { status, note, date: new Date() }];
  o.trackingEvents = events;
  o.changed('trackingEvents', true);
  await o.save();
  if (o.email) {
    sendTrackingUpdate(o, { status, note, date: new Date() }).catch(e => console.error('📧 Tracking email failed:', e.message));
  }
  logActivity({ action:'ADD_TRACKING', entity:'order', entityId:o.id, entityName:o.invoiceNumber||id, req, details:{ status, note } });
  res.json({ events: o.trackingEvents });
});

router.post('/', authRequired, async (req,res)=>{
  try{
    const { items, promoCode, address, address2, department, postalCode, cedula, phone, paymentMethod, userName, email, shippingCity, shippingCost, giftCardCode } = req.body;

    // ── Business rules ──────────────────────────────────
    // 1. Account must be verified
    const requester = await User.findByPk(req.user.id);
    if(!requester || !requester.emailVerified){
      return res.status(403).json({ error:'Debes verificar tu cuenta de correo antes de realizar pedidos. Revisa tu bandeja de entrada.' });
    }
    // 2. Required fields
    if(!address || !address.trim()) return res.status(400).json({ error:'La dirección de envío es obligatoria' });
    if(!phone || !phone.trim()) return res.status(400).json({ error:'El número de teléfono es obligatorio' });
    if(!shippingCity || !shippingCity.trim()) return res.status(400).json({ error:'La ciudad de envío es obligatoria' });
    if(!paymentMethod) return res.status(400).json({ error:'Selecciona un método de pago' });
    // 3. Items
    if(!Array.isArray(items) || items.length===0) return res.status(400).json({ error:'El carrito está vacío' });

    // Validate stock and compute subtotal
    const productIds = items.map(i=>i.productId);
    const products = await Product.findAll({ where: { id: { [Op.in]: productIds } } });
    const map = new Map(products.map(p=>[String(p.id), p]));

    let subtotal = 0;
    const orderItems = [];
    for(const it of items){
      const p = map.get(String(it.productId));
      if(!p) throw new Error('Product not found');
      let unitPrice = p.price;
      if(it.variantId){
        const v = (p.variants||[]).find(v=>String(v._id || v.id)===String(it.variantId));
        if(!v) throw new Error('Variant not found');
        if(v.stock < it.quantity) throw new Error(`Stock insuficiente para ${p.name} (${v.size}/${v.color})`);
        if(typeof v.priceOverride==='number') unitPrice = v.priceOverride;
        orderItems.push({
          productId: p.id,
          productName: p.name,
          productPrice: unitPrice,
          quantity: it.quantity,
          category: p.category,
          variant: { id: v._id || v.id, size: v.size, color: v.color }
        });
        subtotal += unitPrice * it.quantity;
      } else {
        if(p.stock < it.quantity) throw new Error(`Stock insuficiente para ${p.name}`);
        orderItems.push({
          productId: p.id,
          productName: p.name,
          productPrice: unitPrice,
          quantity: it.quantity,
          category: p.category
        });
        subtotal += unitPrice * it.quantity;
      }
    }

    let discount = 0; let total = subtotal;
    if(promoCode){
      const promo = await Promotion.findOne({ where: { code: promoCode.toUpperCase(), active:true } });
      if(!promo) return res.status(400).json({ error:'Código de promoción inválido' });
      discount = subtotal * (promo.discount/100);
      total = subtotal - discount;
    }

    // Shipping validation (simple re-quote)
    let shipping = 0;
    if(shippingCity){
      const tariffs = { 'Bogotá':12000, 'Medellín':15000, 'Cali':15000 };
      const expected = tariffs[shippingCity] ?? 18000;
      shipping = expected;
      if(typeof shippingCost === 'number' && Math.abs(shippingCost - expected) > 0.01){
        // ignore provided shippingCost if tampered
      }
      total += shipping;
    }

    // Gift card application
    let giftApplied = 0;
    let giftCodeSaved = undefined;
    if(giftCardCode){
      const gc = await GiftCard.findOne({ where: { code: String(giftCardCode).toUpperCase(), active:true } });
      if(!gc) return res.status(400).json({ error:'Gift card inválida' });
      giftApplied = Math.min(gc.balance, total);
      gc.balance = gc.balance - giftApplied;
      if(gc.balance<=0) gc.active=false;
      await gc.save();
      total = total - giftApplied;
      giftCodeSaved = gc.code;
    }

    // Decrement stock sequentially
    for(const it of items){
      await decrementStock(it.productId, it.variantId, it.quantity);
    }

    const order = await Order.create({
      userId: req.user.id,
      userName, email, address, address2: address2||'', department: department||'', postalCode: postalCode||'', cedula: cedula||'', phone,
      paymentMethod,
      items: orderItems,
      subtotal, discount, shippingCity, shippingCost: shipping, giftCardCode: giftCodeSaved, giftApplied, total,
      status: 'confirmado',
      date: new Date(),
      invoiceNumber: `FAC-${Date.now()}`
    });

    // Send confirmation + invoice emails (non-blocking)
    if (order.email) {
      sendOrderConfirmation(order).catch(e => console.error('📧 Order confirm email failed:', e.message));
      sendInvoiceEmail(order).catch(e => console.error('📧 Invoice email failed:', e.message));
    }

    logActivity({ action:'CREATE', entity:'order', entityId:order.id, entityName:order.invoiceNumber, req, details:{ total:order.total, items:orderItems.length, paymentMethod, shippingCity } });
    res.json(order);
  }catch(err){
    res.status(400).json({ error: err.message || 'Order error' });
  }
});

router.patch('/:id/status', authRequired, adminOnly, async (req,res)=>{
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['confirmado','enviado','entregado'];
  if(!allowed.includes(status)) return res.status(400).json({ error:'Invalid status' });
  const updated = await Order.findByPk(id);
  if(!updated) return res.status(404).json({ error:'Not found' });
  const prevStatus = updated.status;
  await updated.update({ status });
  logActivity({ action:'STATUS_CHANGE', entity:'order', entityId:updated.id, entityName:updated.invoiceNumber, req, details:{ from:prevStatus, to:status } });
  if (updated.email) {
    sendOrderStatusUpdate(updated, status).catch(e => console.error('📧 Status update email failed:', e.message));
  }
  res.json(updated);
});

export default router;
