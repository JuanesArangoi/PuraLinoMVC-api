import express from 'express';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { Return } from '../models/Return.js';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { Coupon } from '../models/Coupon.js';
import { Warehouse } from '../models/Warehouse.js';
import {
  sendReturnApproved,
  sendReturnRejected,
  sendReturnReceived,
  sendReturnReviewResult
} from '../utils/emailService.js';

const router = express.Router();

// ── Helper: generate unique return number ──
async function nextReturnNumber() {
  const last = await Return.findOne().sort({ createdAt: -1 });
  if (!last || !last.returnNumber) return 'DEV-0001';
  const num = parseInt(last.returnNumber.replace('DEV-', '')) || 0;
  return `DEV-${String(num + 1).padStart(4, '0')}`;
}

// ── Helper: generate coupon code ──
function generateCouponCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'PL-DEV-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ══════════════════════════════════════════════════════════════
// GET /returns — Admin: list all returns
// ══════════════════════════════════════════════════════════════
router.get('/', authRequired, adminOnly, async (req, res) => {
  const list = await Return.find().sort({ createdAt: -1 });
  res.json(list);
});

// ══════════════════════════════════════════════════════════════
// GET /returns/me — Customer: my returns
// ══════════════════════════════════════════════════════════════
router.get('/me', authRequired, async (req, res) => {
  const list = await Return.find({ customerId: req.user.id }).sort({ createdAt: -1 });
  res.json(list);
});

// ══════════════════════════════════════════════════════════════
// GET /returns/:id — Get single return detail
// ══════════════════════════════════════════════════════════════
router.get('/:id', authRequired, async (req, res) => {
  const ret = await Return.findById(req.params.id);
  if (!ret) return res.status(404).json({ error: 'Devolución no encontrada' });
  if (req.user.role !== 'admin' && String(ret.customerId) !== String(req.user.id)) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  res.json(ret);
});

// ══════════════════════════════════════════════════════════════
// POST /returns — Customer creates return request
// ══════════════════════════════════════════════════════════════
router.post('/', authRequired, async (req, res) => {
  try {
    const { orderId, productId, variantId, type, reason } = req.body;

    if (!orderId || !productId || !type || !reason) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (String(order.userId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Este pedido no te pertenece' });
    }

    // Validate 30-day window
    const orderDate = order.date || order.createdAt;
    const daysSincePurchase = (Date.now() - new Date(orderDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePurchase > 30) {
      return res.status(400).json({ error: 'El plazo de 30 días para devoluciones ha expirado' });
    }

    // Only delivered orders
    if (order.status !== 'entregado') {
      return res.status(400).json({ error: 'Solo se pueden devolver pedidos que ya hayan sido entregados' });
    }

    // Find the item in the order
    const orderItem = order.items.find(it => {
      const matchProd = String(it.productId) === String(productId);
      if (variantId) return matchProd && it.variant && String(it.variant.id) === String(variantId);
      return matchProd;
    });
    if (!orderItem) return res.status(400).json({ error: 'Producto no encontrado en este pedido' });

    // Check not already returned
    const existing = await Return.findOne({
      orderId, productId,
      ...(variantId ? { variantId } : {}),
      status: { $nin: ['rechazada', 'revisada_no_apta'] }
    });
    if (existing) return res.status(400).json({ error: 'Ya existe una solicitud de devolución para este producto' });

    const returnNumber = await nextReturnNumber();
    const variantLabel = orderItem.variant ? `${orderItem.variant.size || ''}/${orderItem.variant.color || ''}` : '';

    const ret = await Return.create({
      returnNumber,
      orderId,
      orderNumber: order.invoiceNumber,
      customerId: req.user.id,
      customerName: order.userName,
      customerEmail: order.email,
      productId,
      productName: orderItem.productName,
      productPrice: orderItem.productPrice * orderItem.quantity,
      quantity: orderItem.quantity,
      variantId: variantId || null,
      variantLabel,
      type,
      reason,
      status: 'solicitada',
      customerPaysShipping: type !== 'garantia' && type !== 'defecto',
      orderDate
    });

    res.json(ret);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// PATCH /returns/:id/approve — Admin approves return + sends email with instructions
// ══════════════════════════════════════════════════════════════
router.patch('/:id/approve', authRequired, adminOnly, async (req, res) => {
  try {
    const ret = await Return.findById(req.params.id);
    if (!ret) return res.status(404).json({ error: 'Devolución no encontrada' });
    if (ret.status !== 'solicitada') return res.status(400).json({ error: 'Solo se pueden aprobar solicitudes pendientes' });

    const { warehouseId, adminNotes } = req.body;
    if (!warehouseId) return res.status(400).json({ error: 'Selecciona la bodega de destino' });

    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) return res.status(404).json({ error: 'Bodega no encontrada' });

    ret.status = 'aprobada';
    ret.warehouseId = warehouse._id;
    ret.warehouseName = warehouse.name;
    ret.warehouseAddress = warehouse.location || warehouse.name;
    ret.adminNotes = adminNotes || '';
    await ret.save();

    // Send email with return instructions
    if (ret.customerEmail) {
      sendReturnApproved(ret).catch(e => console.error('📧 Return approved email failed:', e.message));
    }

    res.json(ret);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// PATCH /returns/:id/reject — Admin rejects return request
// ══════════════════════════════════════════════════════════════
router.patch('/:id/reject', authRequired, adminOnly, async (req, res) => {
  try {
    const ret = await Return.findById(req.params.id);
    if (!ret) return res.status(404).json({ error: 'Devolución no encontrada' });
    if (ret.status !== 'solicitada') return res.status(400).json({ error: 'Solo se pueden rechazar solicitudes pendientes' });

    const { rejectionReason } = req.body;
    if (!rejectionReason) return res.status(400).json({ error: 'Debes indicar el motivo del rechazo' });

    ret.status = 'rechazada';
    ret.rejectionReason = rejectionReason;
    await ret.save();

    if (ret.customerEmail) {
      sendReturnRejected(ret).catch(e => console.error('📧 Return rejected email failed:', e.message));
    }

    res.json(ret);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// PATCH /returns/:id/received — Admin marks return as received in warehouse
// ══════════════════════════════════════════════════════════════
router.patch('/:id/received', authRequired, adminOnly, async (req, res) => {
  try {
    const ret = await Return.findById(req.params.id);
    if (!ret) return res.status(404).json({ error: 'Devolución no encontrada' });
    if (!['aprobada', 'enviada_cliente'].includes(ret.status)) {
      return res.status(400).json({ error: 'La devolución debe estar aprobada o enviada para marcar como recibida' });
    }

    ret.status = 'recibida';
    await ret.save();

    if (ret.customerEmail) {
      sendReturnReceived(ret).catch(e => console.error('📧 Return received email failed:', e.message));
    }

    res.json(ret);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// PATCH /returns/:id/review — Admin reviews product condition
// ══════════════════════════════════════════════════════════════
router.patch('/:id/review', authRequired, adminOnly, async (req, res) => {
  try {
    const ret = await Return.findById(req.params.id);
    if (!ret) return res.status(404).json({ error: 'Devolución no encontrada' });
    if (ret.status !== 'recibida') return res.status(400).json({ error: 'La devolución debe estar recibida para revisarla' });

    const { result, reviewNotes, reviewPhotos, reviewRejectionReason } = req.body;
    if (!result || !['apta', 'no_apta'].includes(result)) {
      return res.status(400).json({ error: 'Resultado de revisión inválido' });
    }

    ret.reviewResult = result;
    ret.reviewNotes = reviewNotes || '';
    if (Array.isArray(reviewPhotos)) ret.reviewPhotos = reviewPhotos;

    if (result === 'apta') {
      ret.status = 'revisada_apta';

      // Generate personal coupon
      const code = generateCouponCode();
      const couponValue = ret.productPrice || 0;
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 3); // 3 months validity

      const coupon = await Coupon.create({
        code,
        value: couponValue,
        customerId: ret.customerId,
        customerEmail: ret.customerEmail,
        returnId: ret._id,
        expiresAt,
        active: true
      });

      ret.couponCode = code;
      ret.couponValue = couponValue;

      // Restore stock
      if (ret.productId) {
        const product = await Product.findById(ret.productId);
        if (product) {
          if (ret.variantId) {
            const v = product.variants?.id(ret.variantId);
            if (v) v.stock = (v.stock || 0) + ret.quantity;
          } else {
            product.stock = (product.stock || 0) + ret.quantity;
          }
          await product.save();
        }
      }
    } else {
      ret.status = 'revisada_no_apta';
      ret.reviewRejectionReason = reviewRejectionReason || 'Producto no cumple condiciones de devolución';
    }

    await ret.save();

    // Send review result email with coupon if apt
    if (ret.customerEmail) {
      sendReturnReviewResult(ret).catch(e => console.error('📧 Return review email failed:', e.message));
    }

    res.json(ret);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /returns/coupon/:code — Validate coupon (used during checkout)
// ══════════════════════════════════════════════════════════════
router.get('/coupon/:code', authRequired, async (req, res) => {
  try {
    const coupon = await Coupon.findOne({ code: req.params.code.toUpperCase(), active: true, used: false });
    if (!coupon) return res.status(404).json({ error: 'Cupón no encontrado o ya usado' });
    if (new Date() > coupon.expiresAt) return res.status(400).json({ error: 'El cupón ha expirado' });
    if (String(coupon.customerId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Este cupón es personal y no puede ser usado por otra persona' });
    }
    res.json(coupon);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
