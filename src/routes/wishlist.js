import express from 'express';
import { authRequired } from '../middleware/auth.js';
import { Wishlist } from '../models/index.js';

const router = express.Router();

router.get('/', authRequired, async (req,res)=>{
  const w = await Wishlist.findOne({ where: { userId: req.user.id } });
  res.json(w ? w.items : []);
});

router.post('/:productId', authRequired, async (req,res)=>{
  let w = await Wishlist.findOne({ where: { userId: req.user.id } });
  if (!w) {
    w = await Wishlist.create({ userId: req.user.id, items: [req.params.productId] });
  } else {
    const items = [...(w.items || [])];
    if (!items.includes(req.params.productId)) items.push(req.params.productId);
    w.items = items;
    w.changed('items', true);
    await w.save();
  }
  res.json(w.items);
});

router.delete('/:productId', authRequired, async (req,res)=>{
  const w = await Wishlist.findOne({ where: { userId: req.user.id } });
  if(!w) return res.json([]);
  const items = (w.items || []).filter(id => String(id) !== String(req.params.productId));
  if(items.length===0){
    await w.destroy();
    return res.json([]);
  }
  w.items = items;
  w.changed('items', true);
  await w.save();
  res.json(w.items);
});

export default router;
