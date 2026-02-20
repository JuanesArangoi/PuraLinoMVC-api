import express from 'express';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { Review } from '../models/Review.js';

const router = express.Router();

// List approved reviews for a product
router.get('/products/:productId/reviews', async (req,res)=>{
  const { productId } = req.params;
  const list = await Review.find({ productId, approved:true }).sort({ createdAt:-1 });
  res.json(list);
});

// Add a review for a product (requires auth)
router.post('/products/:productId/reviews', authRequired, async (req,res)=>{
  const { productId } = req.params; const { rating, comment } = req.body||{};
  if(typeof rating !== 'number' || rating<1 || rating>5) return res.status(400).json({ error:'rating 1-5 required' });
  const doc = await Review.create({ userId: req.user.id, productId, rating, comment: comment||'', approved:false });
  res.json(doc);
});

// Approve a review (admin)
router.patch('/reviews/:id/approve', authRequired, adminOnly, async (req,res)=>{
  const { id } = req.params;
  const r = await Review.findByIdAndUpdate(id, { approved:true }, { new:true });
  if(!r) return res.status(404).json({ error:'Not found' });
  res.json(r);
});

// Reject (delete) a review (admin)
router.delete('/reviews/:id', authRequired, adminOnly, async (req,res)=>{
  const { id } = req.params;
  const r = await Review.findByIdAndDelete(id);
  if(!r) return res.status(404).json({ error:'Not found' });
  res.json({ ok:true });
});

// Pending reviews (admin)
router.get('/reviews/pending', authRequired, adminOnly, async (req,res)=>{
  const list = await Review.find({ approved:false }).sort({ createdAt:-1 });
  res.json(list);
});

export default router;
