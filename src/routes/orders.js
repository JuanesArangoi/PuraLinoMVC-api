import express from 'express';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { User } from '../models/User.js';
import { Promotion } from '../models/Promotion.js';
import { GiftCard } from '../models/GiftCard.js';
import { sendOrderConfirmation, sendInvoiceEmail, sendOrderStatusUpdate, sendTrackingUpdate } from '../utils/emailService.js';

const router = express.Router();

router.get('/', authRequired, adminOnly, async (req,res)=>{
  const list = await Order.find().sort({ createdAt:-1 });
  res.json(list);
});

router.get('/me', authRequired, async (req,res)=>{
  const list = await Order.find({ userId: req.user.id }).sort({ createdAt:-1 });
  res.json(list);
});

// Tracking endpoints
router.get('/:id/tracking', authRequired, async (req,res)=>{
  const { id } = req.params;
  const o = await Order.findById(id);
  if(!o) return res.status(404).json({ error:'Not found' });
  // allow only owner or admin
  if(String(o.userId)!==String(req.user.id) && req.user.role!=='admin') return res.status(403).json({ error:'Forbidden' });
  res.json({ trackingNumber: o.trackingNumber||'', carrier: o.carrier||'', events: o.trackingEvents||[] });
});

router.patch('/:id/tracking/meta', authRequired, adminOnly, async (req,res)=>{
  const { id } = req.params; const { trackingNumber, carrier } = req.body||{};
  const o = await Order.findByIdAndUpdate(id, { trackingNumber, carrier }, { new:true });
  if(!o) return res.status(404).json({ error:'Not found' });
  res.json({ trackingNumber: o.trackingNumber||'', carrier: o.carrier||'' });
});

router.post('/:id/tracking', authRequired, adminOnly, async (req,res)=>{
  const { id } = req.params; const { status, note } = req.body||{};
  if(!status) return res.status(400).json({ error:'status required' });
  const o = await Order.findById(id);
  if(!o) return res.status(404).json({ error:'Not found' });
  o.trackingEvents.push({ status, note });
  await o.save();
  if (o.email) {
    sendTrackingUpdate(o, { status, note, date: new Date() }).catch(e => console.error('📧 Tracking email failed:', e.message));
  }
  res.json({ events: o.trackingEvents });
});

router.post('/', authRequired, async (req,res)=>{
  try{
    const { items, promoCode, address, phone, paymentMethod, userName, email, shippingCity, shippingCost, giftCardCode } = req.body;

    // ── Business rules ──────────────────────────────────
    // 1. Account must be verified
    const requester = await User.findById(req.user.id);
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
    const products = await Product.find({ _id: { $in: productIds } });
    const map = new Map(products.map(p=>[String(p._id), p]));

    let subtotal = 0;
    const orderItems = [];
    for(const it of items){
      const p = map.get(String(it.productId));
      if(!p) throw new Error('Product not found');
      let unitPrice = p.price;
      if(it.variantId){
        const v = (p.variants||[]).find(v=>String(v._id)===String(it.variantId));
        if(!v) throw new Error('Variant not found');
        if(v.stock < it.quantity) throw new Error(`Stock insuficiente para ${p.name} (${v.size}/${v.color})`);
        if(typeof v.priceOverride==='number') unitPrice = v.priceOverride;
        orderItems.push({
          productId: p._id,
          productName: p.name,
          productPrice: unitPrice,
          quantity: it.quantity,
          category: p.category,
          variant: { id: v._id, size: v.size, color: v.color }
        });
        subtotal += unitPrice * it.quantity;
      } else {
        if(p.stock < it.quantity) throw new Error(`Stock insuficiente para ${p.name}`);
        orderItems.push({
          productId: p._id,
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
      const promo = await Promotion.findOne({ code: promoCode.toUpperCase(), active:true });
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
      const gc = await GiftCard.findOne({ code: String(giftCardCode).toUpperCase(), active:true });
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
      if(it.variantId){
        await Product.updateOne({ _id: it.productId, 'variants._id': it.variantId, 'variants.stock': { $gte: it.quantity } }, { $inc: { 'variants.$.stock': -it.quantity } });
      } else {
        await Product.updateOne({ _id: it.productId, stock: { $gte: it.quantity } }, { $inc: { stock: -it.quantity } });
      }
    }

    const order = await Order.create({
      userId: req.user.id,
      userName, email, address, phone,
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
  const updated = await Order.findByIdAndUpdate(id, { status }, { new:true });
  if (updated && updated.email) {
    sendOrderStatusUpdate(updated, status).catch(e => console.error('📧 Status update email failed:', e.message));
  }
  res.json(updated);
});

export default router;
