import express from 'express';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { StockMovement } from '../models/StockMovement.js';
import { Product } from '../models/Product.js';

const router = express.Router();

// List stock movements (with optional filters)
router.get('/movements', authRequired, adminOnly, async (req, res) => {
  try {
    const { productId, type, limit: lim } = req.query;
    const filter = {};
    if (productId) filter.productId = productId;
    if (type) filter.type = type;
    const list = await StockMovement.find(filter).sort({ createdAt: -1 }).limit(parseInt(lim) || 100);
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Low-stock alerts (products below a threshold)
router.get('/low-stock', authRequired, adminOnly, async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 5;
    const products = await Product.find();
    const alerts = [];
    for (const p of products) {
      const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
      if (hasVariants) {
        for (const v of p.variants) {
          if ((v.stock || 0) <= threshold) {
            alerts.push({
              productId: p._id,
              productName: p.name,
              variantId: v._id,
              variantLabel: `${v.size} / ${v.color}`,
              currentStock: v.stock || 0,
              threshold
            });
          }
        }
      } else {
        if ((p.stock || 0) <= threshold) {
          alerts.push({
            productId: p._id,
            productName: p.name,
            variantId: null,
            variantLabel: '',
            currentStock: p.stock || 0,
            threshold
          });
        }
      }
    }
    res.json(alerts);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Manual stock adjustment
router.post('/adjust', authRequired, adminOnly, async (req, res) => {
  try {
    const { productId, variantId, quantity, type, reason } = req.body;
    if (!productId) return res.status(400).json({ error: 'Producto requerido' });
    if (!quantity || quantity <= 0) return res.status(400).json({ error: 'Cantidad debe ser mayor a 0' });
    if (!['entrada', 'salida', 'ajuste'].includes(type)) return res.status(400).json({ error: 'Tipo inválido' });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    let variantLabel = '';
    if (variantId) {
      const v = product.variants.id(variantId);
      if (!v) return res.status(404).json({ error: 'Variante no encontrada' });
      variantLabel = `${v.size} / ${v.color}`;
      if (type === 'entrada') v.stock = (v.stock || 0) + quantity;
      else if (type === 'salida') v.stock = Math.max(0, (v.stock || 0) - quantity);
      else v.stock = quantity; // ajuste = set absolute
    } else {
      if (type === 'entrada') product.stock = (product.stock || 0) + quantity;
      else if (type === 'salida') product.stock = Math.max(0, (product.stock || 0) - quantity);
      else product.stock = quantity;
    }
    await product.save();

    const movement = await StockMovement.create({
      productId,
      productName: product.name,
      variantId: variantId || null,
      variantLabel,
      type,
      quantity,
      reason: reason || 'Ajuste manual',
      referenceType: 'manual',
      userId: req.user.id,
      userName: req.user.name || ''
    });

    res.json({ product, movement });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

export default router;
