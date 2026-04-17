import express from 'express';
import { Op } from 'sequelize';
import { Product, Review } from '../models/index.js';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { logActivity } from '../helpers/auditLog.js';

const router = express.Router();

router.get('/', async (req,res)=>{
  const { size, color, minPrice, maxPrice, inStock, supplier } = req.query;
  
  const where = {};
  if(supplier){
    const ids = supplier.split(',').filter(Boolean);
    if(ids.length === 1) where.supplierId = ids[0];
    else if(ids.length > 1) where.supplierId = { [Op.in]: ids };
  }

  // Fetch all matching products, then filter in-app for JSONB variant conditions
  let list = await Product.findAll({ where, order: [['createdAt', 'DESC']] });

  // Apply price filter (base price or variant priceOverride)
  if(minPrice || maxPrice){
    const min = minPrice ? Number(minPrice) : -Infinity;
    const max = maxPrice ? Number(maxPrice) : Infinity;
    list = list.filter(p => {
      if(p.price >= min && p.price <= max) return true;
      return (p.variants||[]).some(v => typeof v.priceOverride === 'number' && v.priceOverride >= min && v.priceOverride <= max);
    });
  }
  // Apply size/color filter on variants
  if(size || color){
    list = list.filter(p => (p.variants||[]).some(v =>
      (!size || v.size === size) && (!color || v.color === color)
    ));
  }
  // Apply inStock filter
  if(inStock==="true"){
    list = list.filter(p => (p.stock||0) > 0 || (p.variants||[]).some(v => (v.stock||0) > 0));
  }
  
  res.json(list);
});

router.post('/', authRequired, adminOnly, async (req,res)=>{
  const body = req.body || {};
  // allow creating with or without variants
  const created = await Product.create(body);
  logActivity({ action:'CREATE', entity:'product', entityId:created.id, entityName:created.name, req, details:{ price:created.price, category:created.category, stock:created.stock } });
  res.json(created);
});

router.put('/:id', authRequired, adminOnly, async (req,res)=>{
  const { id } = req.params;
  const body = req.body || {};
  const product = await Product.findByPk(id);
  if(!product) return res.status(404).json({ error:'Not found' });
  await product.update(body);
  logActivity({ action:'UPDATE', entity:'product', entityId:product.id, entityName:product.name, req, details:{ changes: Object.keys(body) } });
  res.json(product);
});

router.delete('/:id', authRequired, adminOnly, async (req,res)=>{
  const { id } = req.params;
  const prod = await Product.findByPk(id);
  const prodName = prod?.name || id;
  await Product.destroy({ where: { id } });
  logActivity({ action:'DELETE', entity:'product', entityId:id, entityName:prodName, req });
  res.json({ ok:true });
});

// ── Product reviews sub-routes (frontend calls /products/:id/reviews) ──
router.get('/:id/reviews', async (req,res)=>{
  const { id } = req.params;
  const isAdmin = req.headers.authorization;
  const where = { productId: id };
  if(!isAdmin) where.approved = true;
  const list = await Review.findAll({ where, order: [['createdAt', 'DESC']] });
  res.json(list);
});

router.post('/:id/reviews', authRequired, async (req,res)=>{
  try{
    const { rating, comment } = req.body;
    if(!rating) return res.status(400).json({ error:'Calificación requerida' });
    const review = await Review.create({ userId:req.user.id, productId:req.params.id, rating, comment });
    logActivity({ action:'CREATE', entity:'review', entityId:review.id, entityName:`Rating ${rating}`, req, details:{ productId:req.params.id, rating, comment } });
    res.json(review);
  }catch(err){
    if(err.name==='SequelizeUniqueConstraintError') return res.status(400).json({ error:'Ya has dejado una reseña para este producto' });
    res.status(400).json({ error:err.message });
  }
});

export default router;
