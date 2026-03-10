import express from 'express';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { GiftCard } from '../models/index.js';

const router = express.Router();

// Create a new gift card (admin)
router.post('/', authRequired, adminOnly, async (req,res)=>{
  const { code, balance } = req.body;
  const gc = await GiftCard.create({ code: code.toUpperCase(), balance });
  res.json(gc);
});

// Check a gift card by code
router.get('/:code', authRequired, async (req,res)=>{
  const gc = await GiftCard.findOne({ where: { code: req.params.code.toUpperCase(), active:true } });
  if(!gc) return res.status(404).json({ error:'Gift card no encontrada' });
  res.json({ code: gc.code, balance: gc.balance });
});

// List all gift cards (admin)
router.get('/', authRequired, adminOnly, async (req,res)=>{
  const list = await GiftCard.findAll({ order: [['createdAt', 'DESC']] });
  res.json(list);
});

export default router;
