import express from 'express';
import { Product } from '../models/Product.js';
import { authRequired, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.get('/', async (req,res)=>{
  const { size, color, minPrice, maxPrice, inStock, supplier } = req.query;
  
  const q = {};
  if(supplier){
    const ids = supplier.split(',').filter(Boolean);
    if(ids.length === 1) q.supplierId = ids[0];
    else if(ids.length > 1) q.supplierId = { $in: ids };
  }
  if(minPrice || maxPrice){
    q.$or = [
      { price: { ...(minPrice? { $gte: Number(minPrice) }:{}), ...(maxPrice? { $lte: Number(maxPrice) }:{}) } },
      { variants: { $elemMatch: { priceOverride: { ...(minPrice? { $gte: Number(minPrice) }:{}), ...(maxPrice? { $lte: Number(maxPrice) }:{}) } } } }
    ];
  }
  if(size || color){
    q.variants = q.variants || {};
    q.variants.$elemMatch = { ...(q.variants.$elemMatch||{}), ...(size? { size }:{}), ...(color? { color }:{}) };
  }
  if(inStock==="true"){ // productos con stock general o con alguna variante con stock
    q.$or = [...(q.$or||[]), { stock: { $gt: 0 } }, { variants: { $elemMatch: { stock: { $gt: 0 } } } }];
  }
  
  const list = await Product.find(Object.keys(q).length? q: {}).sort({ createdAt:-1 });
  res.json(list);
});

router.post('/', authRequired, adminOnly, async (req,res)=>{
  const body = req.body || {};
  // allow creating with or without variants
  const created = await Product.create(body);
  res.json(created);
});

router.put('/:id', authRequired, adminOnly, async (req,res)=>{
  const { id } = req.params;
  const body = req.body || {};
  const updated = await Product.findByIdAndUpdate(id, body, { new:true });
  res.json(updated);
});

router.delete('/:id', authRequired, adminOnly, async (req,res)=>{
  const { id } = req.params;
  await Product.findByIdAndDelete(id);
  res.json({ ok:true });
});

export default router;
