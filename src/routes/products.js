import express from 'express';
import { Op } from 'sequelize';
import { Product } from '../models/index.js';
import { authRequired, adminOnly } from '../middleware/auth.js';

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
  res.json(created);
});

router.put('/:id', authRequired, adminOnly, async (req,res)=>{
  const { id } = req.params;
  const body = req.body || {};
  const product = await Product.findByPk(id);
  if(!product) return res.status(404).json({ error:'Not found' });
  await product.update(body);
  res.json(product);
});

router.delete('/:id', authRequired, adminOnly, async (req,res)=>{
  const { id } = req.params;
  await Product.destroy({ where: { id } });
  res.json({ ok:true });
});

export default router;
