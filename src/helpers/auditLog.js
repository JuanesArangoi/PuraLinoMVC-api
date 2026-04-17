import { AuditLog } from '../models/index.js';

/**
 * Registra una acción en el log de auditoría.
 *
 * @param {object}  opts
 * @param {string}  opts.action      - CREATE | UPDATE | DELETE | LOGIN | LOGOUT | REGISTER | VERIFY_EMAIL | RESET_PASSWORD | ENABLE_2FA | APPROVE | REJECT | UPLOAD | STATUS_CHANGE | STOCK_MOVEMENT | PAYMENT …
 * @param {string}  opts.entity      - product | order | user | promotion | return | review | supplier | warehouse | purchase_order | inventory | setting | giftcard | coupon | payment | backlog
 * @param {string}  [opts.entityId]  - ID de la entidad afectada
 * @param {string}  [opts.entityName]- Nombre legible (ej: nombre del producto)
 * @param {object}  [opts.req]       - Express request (extrae user y IP automáticamente)
 * @param {string}  [opts.userId]    - Forzar userId (si no hay req.user)
 * @param {string}  [opts.userName]  - Forzar userName
 * @param {string}  [opts.userRole]  - Forzar userRole
 * @param {object}  [opts.details]   - Info extra: { before, after, changes, reason, … }
 */
export async function logActivity(opts) {
  try {
    const user = opts.req?.user || {};
    const ip = opts.req
      ? (opts.req.headers['x-forwarded-for'] || opts.req.socket?.remoteAddress || '')
      : '';

    await AuditLog.create({
      action:     opts.action,
      entity:     opts.entity,
      entityId:   opts.entityId   || null,
      entityName: opts.entityName || '',
      userId:     opts.userId     || user.id   || null,
      userName:   opts.userName   || user.name  || user.username || '',
      userRole:   opts.userRole   || user.role  || '',
      details:    opts.details    || {},
      ipAddress:  typeof ip === 'string' ? ip.split(',')[0].trim() : ''
    });
  } catch (err) {
    console.error('AuditLog write error:', err.message);
  }
}
