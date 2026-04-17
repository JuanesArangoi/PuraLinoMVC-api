import express from 'express';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { Review } from '../models/index.js';
import { logActivity } from '../helpers/auditLog.js';

const router = express.Router();

// List all pending reviews (admin) — MUST be before /:id routes
router.get('/pending', authRequired, adminOnly, async (req,res)=>{
  const list = await Review.findAll({ where: { approved:false }, order: [['createdAt', 'DESC']] });
  res.json(list);
});

// Add a review (authenticated user)
router.post('/', authRequired, async (req,res)=>{
  try{
    const { productId, rating, comment } = req.body;
    if(!productId || !rating) return res.status(400).json({ error:'Producto y calificación requeridos' });
    const review = await Review.create({ userId:req.user.id, productId, rating, comment });
    logActivity({ action:'CREATE', entity:'review', entityId:review.id, entityName:`Rating ${rating}`, req, details:{ productId, rating, comment } });
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
  logActivity({ action:'APPROVE', entity:'review', entityId:review.id, entityName:`Review ${review.productId}`, req });
  res.json(review);
});

// Delete a review (admin)
router.delete('/:id', authRequired, adminOnly, async (req,res)=>{
  await Review.destroy({ where: { id: req.params.id } });
  logActivity({ action:'DELETE', entity:'review', entityId:req.params.id, req });
  res.json({ ok:true });
});

export default router;
