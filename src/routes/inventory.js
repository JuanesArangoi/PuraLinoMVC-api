import express from 'express';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { StockMovement, Product } from '../models/index.js';

const router = express.Router();

// List stock movements (with optional filters)
router.get('/movements', authRequired, adminOnly, async (req, res) => {
  try {
    const { productId, type, limit: lim } = req.query;
    const where = {};
    if (productId) where.productId = productId;
    if (type) where.type = type;
    const list = await StockMovement.findAll({ where, order: [['createdAt', 'DESC']], limit: parseInt(lim) || 100 });
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Low-stock alerts (products below a threshold)
router.get('/low-stock', authRequired, adminOnly, async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 5;
    const products = await Product.findAll();
    const alerts = [];
    for (const p of products) {
      const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
      if (hasVariants) {
        for (const v of p.variants) {
          if ((v.stock || 0) <= threshold) {
            alerts.push({
              productId: p.id,
              productName: p.name,
              variantId: v._id || v.id,
              variantLabel: `${v.size} / ${v.color}`,
              currentStock: v.stock || 0,
              threshold
            });
          }
        }
      } else {
        if ((p.stock || 0) <= threshold) {
          alerts.push({
            productId: p.id,
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

    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    let variantLabel = '';
    if (variantId) {
      const variants = [...(product.variants || [])];
      const idx = variants.findIndex(v => String(v._id || v.id) === String(variantId));
      if (idx < 0) return res.status(404).json({ error: 'Variante no encontrada' });
      const v = variants[idx];
      variantLabel = `${v.size} / ${v.color}`;
      if (type === 'entrada') variants[idx] = { ...v, stock: (v.stock || 0) + quantity };
      else if (type === 'salida') variants[idx] = { ...v, stock: Math.max(0, (v.stock || 0) - quantity) };
      else variants[idx] = { ...v, stock: quantity }; // ajuste = set absolute
      product.variants = variants;
      product.changed('variants', true);
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
