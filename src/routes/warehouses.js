import express from 'express';
import crypto from 'crypto';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { Warehouse } from '../models/index.js';

const router = express.Router();

// List all warehouses
router.get('/', authRequired, adminOnly, async (req, res) => {
  try {
    const list = await Warehouse.findAll({ order: [['createdAt', 'DESC']] });
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get one warehouse
router.get('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const w = await Warehouse.findByPk(req.params.id);
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
    const w = await Warehouse.findByPk(req.params.id);
    if (!w) return res.status(404).json({ error: 'Almacén no encontrado' });
    await w.update({ name, location, shelves, active });
    res.json(w);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Add shelf to warehouse
router.post('/:id/shelves', authRequired, adminOnly, async (req, res) => {
  try {
    const { code, label } = req.body;
    if (!code || !code.trim()) return res.status(400).json({ error: 'El código de estantería es obligatorio' });
    const w = await Warehouse.findByPk(req.params.id);
    if (!w) return res.status(404).json({ error: 'Almacén no encontrado' });
    const shelves = [...(w.shelves || [])];
    const exists = shelves.find(s => s.code === code.trim());
    if (exists) return res.status(400).json({ error: 'Ya existe una estantería con ese código' });
    shelves.push({ _id: crypto.randomUUID(), code: code.trim(), label: label || '' });
    w.shelves = shelves;
    w.changed('shelves', true);
    await w.save();
    res.json(w);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Remove shelf from warehouse
router.delete('/:id/shelves/:shelfId', authRequired, adminOnly, async (req, res) => {
  try {
    const w = await Warehouse.findByPk(req.params.id);
    if (!w) return res.status(404).json({ error: 'Almacén no encontrado' });
    w.shelves = (w.shelves || []).filter(s => String(s._id) !== req.params.shelfId);
    w.changed('shelves', true);
    await w.save();
    res.json(w);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Delete warehouse
router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const w = await Warehouse.findByPk(req.params.id);
    if (!w) return res.status(404).json({ error: 'Almacén no encontrado' });
    await w.destroy();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
