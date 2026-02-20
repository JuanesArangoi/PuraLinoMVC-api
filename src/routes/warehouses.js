import express from 'express';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { Warehouse } from '../models/Warehouse.js';

const router = express.Router();

// List all warehouses
router.get('/', authRequired, adminOnly, async (req, res) => {
  try {
    const list = await Warehouse.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get one warehouse
router.get('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const w = await Warehouse.findById(req.params.id);
    if (!w) return res.status(404).json({ error: 'Almacén no encontrado' });
    res.json(w);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create warehouse
router.post('/', authRequired, adminOnly, async (req, res) => {
  try {
    const { name, location, shelves } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre del almacén es obligatorio' });
    const warehouse = await Warehouse.create({ name: name.trim(), location, shelves: shelves || [] });
    res.json(warehouse);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Update warehouse
router.put('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const { name, location, shelves, active } = req.body;
    const updated = await Warehouse.findByIdAndUpdate(req.params.id, { name, location, shelves, active }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Almacén no encontrado' });
    res.json(updated);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Add shelf to warehouse
router.post('/:id/shelves', authRequired, adminOnly, async (req, res) => {
  try {
    const { code, label } = req.body;
    if (!code || !code.trim()) return res.status(400).json({ error: 'El código de estantería es obligatorio' });
    const w = await Warehouse.findById(req.params.id);
    if (!w) return res.status(404).json({ error: 'Almacén no encontrado' });
    const exists = w.shelves.find(s => s.code === code.trim());
    if (exists) return res.status(400).json({ error: 'Ya existe una estantería con ese código' });
    w.shelves.push({ code: code.trim(), label: label || '' });
    await w.save();
    res.json(w);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Remove shelf from warehouse
router.delete('/:id/shelves/:shelfId', authRequired, adminOnly, async (req, res) => {
  try {
    const w = await Warehouse.findById(req.params.id);
    if (!w) return res.status(404).json({ error: 'Almacén no encontrado' });
    w.shelves = w.shelves.filter(s => String(s._id) !== req.params.shelfId);
    await w.save();
    res.json(w);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Delete warehouse
router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const deleted = await Warehouse.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Almacén no encontrado' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
