import express from 'express';
import { authRequired } from '../middleware/auth.js';
import { Wishlist } from '../models/Wishlist.js';

const router = express.Router();

router.get('/', authRequired, async (req,res)=>{
  const wl = await Wishlist.findOne({ userId: req.user.id });
  res.json(wl || { userId: req.user.id, items: [] });
});

router.post('/:productId', authRequired, async (req,res)=>{
  const { productId } = req.params;
  const wl = await Wishlist.findOneAndUpdate(
    { userId: req.user.id },
    { $addToSet: { items: productId } },
    { upsert:true, new:true }
  );
  res.json(wl);
});

router.delete('/:productId', authRequired, async (req,res)=>{
  const { productId } = req.params;
  const wl = await Wishlist.findOneAndUpdate(
    { userId: req.user.id },
    { $pull: { items: productId } },
    { new:true }
  );
  res.json(wl || { ok:true });
});

export default router;
