import { Router } from 'express';
import { BacklogItem } from '../models/index.js';
import { authRequired, adminOnly } from '../middleware/auth.js';

const router = Router();

// GET /backlog — list all items (admin only)
router.get('/', authRequired, adminOnly, async (req, res) => {
  try {
    const items = await BacklogItem.findAll({ order: [['createdAt', 'DESC']] });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /backlog/:id — get single item
router.get('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const item = await BacklogItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item no encontrado' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /backlog — create item
router.post('/', authRequired, adminOnly, async (req, res) => {
  try {
    const { title, description, priority, status, category, assignee, dueDate } = req.body;
    if (!title) return res.status(400).json({ error: 'El título es obligatorio' });
    const item = await BacklogItem.create({
      title,
      description: description || '',
      priority: priority || 'media',
      status: status || 'pendiente',
      category: category || 'general',
      assignee: assignee || '',
      dueDate: dueDate || null,
      createdBy: req.user.id
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /backlog/:id — update item
router.put('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const item = await BacklogItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item no encontrado' });
    const { title, description, priority, status, category, assignee, dueDate } = req.body;
    if (title !== undefined) item.title = title;
    if (description !== undefined) item.description = description;
    if (priority !== undefined) item.priority = priority;
    if (status !== undefined) {
      item.status = status;
      if (status === 'completada' && !item.completedAt) item.completedAt = new Date();
      if (status !== 'completada') item.completedAt = null;
    }
    if (category !== undefined) item.category = category;
    if (assignee !== undefined) item.assignee = assignee;
    if (dueDate !== undefined) item.dueDate = dueDate || null;
    await item.save();
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /backlog/:id — delete item
router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const item = await BacklogItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item no encontrado' });
    await item.destroy();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
