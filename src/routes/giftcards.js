import express from 'express';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { GiftCard } from '../models/GiftCard.js';

const router = express.Router();

// Create a new gift card (admin)
router.post('/', authRequired, adminOnly, async (req,res)=>{
  try{
    const { code, balance, active=true } = req.body||{};
    if(!code || typeof balance !== 'number') return res.status(400).json({ error: 'code and balance required' });
    const gc = await GiftCard.create({ code: code.toUpperCase(), balance, active: !!active });
    res.json(gc);
  }catch(err){ res.status(400).json({ error: err.message||'Error' }); }
});

// Check a gift card by code
router.get('/:code', authRequired, async (req,res)=>{
  const { code } = req.params;
  const gc = await GiftCard.findOne({ code: code.toUpperCase(), active:true });
  if(!gc) return res.status(404).json({ error: 'Not found' });
  res.json({ code: gc.code, balance: gc.balance, active: gc.active });
});

export default router;
