import { sequelize } from '../models/index.js';

/**
 * Registra un evento de aplicación directamente en db_changelog (PostgreSQL).
 * Usa la función fn_log_app_event() creada en la migración.
 * 
 * @param {Object} params
 * @param {string} params.tableName  - Tabla o contexto (ej: 'session', 'auth', 'users')
 * @param {string} params.operation  - Tipo de evento (LOGIN, LOGOUT, LOGIN_FAILED, 2FA_SENT, 2FA_VERIFIED, REGISTER, PASSWORD_RESET, etc.)
 * @param {string} [params.recordId] - ID del registro afectado (ej: userId)
 * @param {Object} [params.details]  - Detalles adicionales en JSON
 * @param {Object} [params.req]      - Express request (para extraer IP)
 * @param {string} [params.userId]   - ID del usuario que realiza la acción
 * @param {string} [params.userName] - Nombre del usuario
 * @param {string} [params.userRole] - Rol del usuario
 */
export async function dbLog({ tableName, operation, recordId, details, req, userId, userName, userRole }) {
  try {
    const ip = req
      ? (req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '').split(',')[0].trim()
      : '';

    await sequelize.query(
      `SELECT fn_log_app_event(:tableName, :operation, :recordId, :details::jsonb, :ip, :userId, :userName, :userRole)`,
      {
        replacements: {
          tableName: tableName || 'app',
          operation: operation || 'UNKNOWN',
          recordId: recordId || null,
          details: JSON.stringify(details || {}),
          ip,
          userId: userId || '',
          userName: userName || '',
          userRole: userRole || ''
        }
      }
    );
  } catch (err) {
    // Silenciar errores para no afectar el flujo principal
    console.error('dbLog error:', err.message);
  }
}
