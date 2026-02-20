import express from 'express';
import { Promotion } from '../models/Promotion.js';
import { authRequired, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.get('/', async (req,res)=>{
  const list = await Promotion.find().sort({ createdAt:-1 });
  res.json(list);
});

router.post('/', authRequired, adminOnly, async (req,res)=>{
  const { code, discount } = req.body;
  const created = await Promotion.create({ code: code.toUpperCase(), discount, active:true });
  res.json(created);
});

router.patch('/:id/toggle', authRequired, adminOnly, async (req,res)=>{
  const { id } = req.params;
  const promo = await Promotion.findById(id);
  if(!promo) return res.status(404).json({ error:'Not found' });
  promo.active = !promo.active;
  await promo.save();
  res.json(promo);
});

export default router;
