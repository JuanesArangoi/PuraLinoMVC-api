import express from 'express';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { Supplier } from '../models/index.js';
import { logActivity } from '../helpers/auditLog.js';

const router = express.Router();

// List all suppliers
router.get('/', authRequired, adminOnly, async (req, res) => {
  try {
    const list = await Supplier.findAll({ order: [['createdAt', 'DESC']] });
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get one supplier
router.get('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(supplier);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create supplier
router.post('/', authRequired, adminOnly, async (req, res) => {
  try {
    const { name, contactPerson, email, phone, address, city, notes } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });
    const supplier = await Supplier.create({ name: name.trim(), contactPerson: contactPerson||'', email: email||'', phone: phone||'', address: address||'', city: city||'', notes: notes||'' });
    logActivity({ action:'CREATE', entity:'supplier', entityId:supplier.id, entityName:supplier.name, req });
    res.json(supplier);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Update supplier
router.put('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const { name, contactPerson, email, phone, address, city, notes, active } = req.body;
    if (name !== undefined && !name.trim()) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Proveedor no encontrado' });
    await supplier.update({ name, contactPerson, email, phone, address, city, notes, active });
    logActivity({ action:'UPDATE', entity:'supplier', entityId:supplier.id, entityName:supplier.name, req, details:{ changes: Object.keys(req.body) } });
    res.json(supplier);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Delete supplier
router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Proveedor no encontrado' });
    const sName = supplier.name;
    await supplier.destroy();
    logActivity({ action:'DELETE', entity:'supplier', entityId:req.params.id, entityName:sName, req });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
