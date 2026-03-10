import express from 'express';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { Promotion } from '../models/index.js';

const router = express.Router();

router.get('/', async (req,res)=>{
  const list = await Promotion.findAll();
  res.json(list);
});

router.post('/', authRequired, adminOnly, async (req,res)=>{
  const { code, discount } = req.body;
  const promo = await Promotion.create({ code: code.toUpperCase(), discount });
  res.json(promo);
});

router.patch('/:id/toggle', authRequired, adminOnly, async (req,res)=>{
  const promo = await Promotion.findByPk(req.params.id);
  if(!promo) return res.status(404).json({ error:'Not found' });
  promo.active = !promo.active;
  await promo.save();
  res.json(promo);
});

export default router;
