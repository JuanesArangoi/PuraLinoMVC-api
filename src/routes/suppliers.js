import express from 'express';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { Supplier } from '../models/Supplier.js';

const router = express.Router();

// List all suppliers
router.get('/', authRequired, adminOnly, async (req, res) => {
  try {
    const list = await Supplier.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get one supplier
router.get('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const s = await Supplier.findById(req.params.id);
    if (!s) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(s);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create supplier
router.post('/', authRequired, adminOnly, async (req, res) => {
  try {
    const { name, contactPerson, email, phone, address, city, notes } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });
    const supplier = await Supplier.create({ name: name.trim(), contactPerson, email, phone, address, city, notes });
    res.json(supplier);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Update supplier
router.put('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const { name, contactPerson, email, phone, address, city, notes, active } = req.body;
    if (name !== undefined && !name.trim()) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
    const updated = await Supplier.findByIdAndUpdate(req.params.id, { name, contactPerson, email, phone, address, city, notes, active }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(updated);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Delete supplier
router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const deleted = await Supplier.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
