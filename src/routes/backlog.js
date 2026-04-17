import { Router } from 'express';
import { Op } from 'sequelize';
import { sequelize, BacklogItem, AuditLog } from '../models/index.js';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { logActivity } from '../helpers/auditLog.js';

const router = Router();

// ══════════════════════════════════════════════════════════════
// AUDIT LOG — registro de cada movimiento en la aplicación
// ══════════════════════════════════════════════════════════════

// GET /backlog/audit — list audit logs with filters (admin only)
router.get('/audit', authRequired, adminOnly, async (req, res) => {
  try {
    const { entity, action, userId, from, to, search, limit: lim, offset: off } = req.query;
    const where = {};

    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(from);
      if (to) where.createdAt[Op.lte] = new Date(to);
    }
    if (search) {
      where[Op.or] = [
        { entityName: { [Op.iLike]: `%${search}%` } },
        { userName: { [Op.iLike]: `%${search}%` } },
        { action: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const limit = Math.min(parseInt(lim) || 100, 500);
    const offset = parseInt(off) || 0;

    const { rows, count } = await AuditLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    res.json({ logs: rows, total: count, limit, offset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /backlog/audit/stats — summary stats for dashboard
router.get('/audit/stats', authRequired, adminOnly, async (req, res) => {
  try {
    const total = await AuditLog.count();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayCount = await AuditLog.count({ where: { createdAt: { [Op.gte]: today } } });

    // Count by entity
    const [byEntity] = await AuditLog.sequelize.query(
      'SELECT entity, COUNT(*)::int as count FROM audit_logs GROUP BY entity ORDER BY count DESC'
    );
    // Count by action
    const [byAction] = await AuditLog.sequelize.query(
      'SELECT action, COUNT(*)::int as count FROM audit_logs GROUP BY action ORDER BY count DESC LIMIT 10'
    );

    res.json({ total, todayCount, byEntity, byAction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// DB CHANGELOG — auditoría a nivel de base de datos (triggers)
// ══════════════════════════════════════════════════════════════

// GET /backlog/db-changelog — list database-level changes
router.get('/db-changelog', authRequired, adminOnly, async (req, res) => {
  try {
    const { table_name, operation, record_id, from, to, limit: lim, offset: off } = req.query;
    const conditions = [];
    const replacements = {};

    if (table_name) { conditions.push('table_name = :table_name'); replacements.table_name = table_name; }
    if (operation)  { conditions.push('operation = :operation');   replacements.operation = operation.toUpperCase(); }
    if (record_id)  { conditions.push('record_id = :record_id');  replacements.record_id = record_id; }
    if (from)       { conditions.push('executed_at >= :from');     replacements.from = new Date(from); }
    if (to)         { conditions.push('executed_at <= :to');       replacements.to = new Date(to); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const limit = Math.min(parseInt(lim) || 100, 500);
    const offset = parseInt(off) || 0;

    const [rows] = await sequelize.query(
      `SELECT id, table_name, operation, record_id, changed_fields, db_user, app_user_id, app_user_name, app_user_role, executed_at FROM db_changelog ${where} ORDER BY executed_at DESC LIMIT :limit OFFSET :offset`,
      { replacements: { ...replacements, limit, offset } }
    );
    const [[{ count }]] = await sequelize.query(
      `SELECT COUNT(*)::int as count FROM db_changelog ${where}`,
      { replacements }
    );

    res.json({ logs: rows, total: count, limit, offset });
  } catch (err) {
    if (err.message.includes('does not exist')) {
      return res.status(404).json({ error: 'Tabla db_changelog no existe. Ejecuta el script de migración primero.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /backlog/db-changelog/stats — summary stats
router.get('/db-changelog/stats', authRequired, adminOnly, async (req, res) => {
  try {
    const [[{ total }]] = await sequelize.query('SELECT COUNT(*)::int as total FROM db_changelog');

    const [byTable] = await sequelize.query(
      'SELECT table_name, COUNT(*)::int as count FROM db_changelog GROUP BY table_name ORDER BY count DESC'
    );
    const [byOperation] = await sequelize.query(
      'SELECT operation, COUNT(*)::int as count FROM db_changelog GROUP BY operation ORDER BY count DESC'
    );
    const [recent] = await sequelize.query(
      `SELECT id, table_name, operation, record_id, changed_fields, app_user_id, app_user_name, app_user_role, executed_at FROM db_changelog ORDER BY executed_at DESC LIMIT 10`
    );

    res.json({ total, byTable, byOperation, recent });
  } catch (err) {
    if (err.message.includes('does not exist')) {
      return res.status(404).json({ error: 'Tabla db_changelog no existe. Ejecuta el script de migración primero.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /backlog/db-changelog/:recordId — history of a specific record
router.get('/db-changelog/:recordId', authRequired, adminOnly, async (req, res) => {
  try {
    const [rows] = await sequelize.query(
      'SELECT * FROM db_changelog WHERE record_id = :recordId ORDER BY executed_at ASC',
      { replacements: { recordId: req.params.recordId } }
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// BACKLOG ITEMS — tareas del backlog del proyecto
// ══════════════════════════════════════════════════════════════

// GET /backlog — list all backlog items (admin only)
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
    logActivity({ action:'CREATE', entity:'backlog', entityId:item.id, entityName:item.title, req });
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
    logActivity({ action:'UPDATE', entity:'backlog', entityId:item.id, entityName:item.title, req, details:{ changes: Object.keys(req.body) } });
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
    const itemTitle = item.title;
    await item.destroy();
    logActivity({ action:'DELETE', entity:'backlog', entityId:req.params.id, entityName:itemTitle, req });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
