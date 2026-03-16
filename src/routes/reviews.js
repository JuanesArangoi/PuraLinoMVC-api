import express from 'express';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { Review } from '../models/index.js';

const router = express.Router();

// List all pending reviews (admin) — MUST be before /:productId
router.get('/admin/pending', authRequired, adminOnly, async (req,res)=>{
  const list = await Review.findAll({ where: { approved:false }, order: [['createdAt', 'DESC']] });
  res.json(list);
});

// List reviews for a product (approved only for public, all for admin)
router.get('/:productId', async (req,res)=>{
  const { productId } = req.params;
  const isAdmin = req.headers.authorization; // simple check
  const where = { productId };
  if(!isAdmin) where.approved = true;
  const list = await Review.findAll({ where, order: [['createdAt', 'DESC']] });
  res.json(list);
});

// Add a review (authenticated user)
router.post('/', authRequired, async (req,res)=>{
  try{
    const { productId, rating, comment } = req.body;
    if(!productId || !rating) return res.status(400).json({ error:'Producto y calificación requeridos' });
    const review = await Review.create({ userId:req.user.id, productId, rating, comment });
    res.json(review);
  }catch(err){
    if(err.name==='SequelizeUniqueConstraintError') return res.status(400).json({ error:'Ya has dejado una reseña para este producto' });
    res.status(400).json({ error:err.message });
  }
});

// Approve a review (admin)
router.patch('/:id/approve', authRequired, adminOnly, async (req,res)=>{
  const review = await Review.findByPk(req.params.id);
  if(!review) return res.status(404).json({ error:'Not found' });
  await review.update({ approved:true });
  res.json(review);
});

// Delete a review (admin)
router.delete('/:id', authRequired, adminOnly, async (req,res)=>{
  await Review.destroy({ where: { id: req.params.id } });
  res.json({ ok:true });
});

export default router;
