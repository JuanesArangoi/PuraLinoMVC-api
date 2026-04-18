import client from 'prom-client';

// Registro por defecto con métricas del sistema (CPU, memoria, event loop, etc.)
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// ══════════════════════════════════════════════════════════════
// Métricas HTTP
// ══════════════════════════════════════════════════════════════
export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total de peticiones HTTP recibidas',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duración de las peticiones HTTP en segundos',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10],
  registers: [register]
});

export const activeConnections = new client.Gauge({
  name: 'http_active_connections',
  help: 'Conexiones HTTP activas',
  registers: [register]
});

// ══════════════════════════════════════════════════════════════
// Métricas de negocio
// ══════════════════════════════════════════════════════════════
export const loginAttemptsTotal = new client.Counter({
  name: 'login_attempts_total',
  help: 'Total de intentos de inicio de sesión',
  labelNames: ['status'], // success, failed, 2fa_required
  registers: [register]
});

export const ordersTotal = new client.Counter({
  name: 'orders_total',
  help: 'Total de órdenes creadas',
  labelNames: ['status'],
  registers: [register]
});

export const registrationsTotal = new client.Counter({
  name: 'registrations_total',
  help: 'Total de registros de usuarios',
  registers: [register]
});

export const dbChangelogTotal = new client.Counter({
  name: 'db_changelog_operations_total',
  help: 'Total de operaciones registradas en db_changelog',
  labelNames: ['table_name', 'operation'],
  registers: [register]
});

// ══════════════════════════════════════════════════════════════
// Middleware Express para métricas HTTP
// ══════════════════════════════════════════════════════════════
export function metricsMiddleware(req, res, next) {
  activeConnections.inc();
  const end = httpRequestDuration.startTimer();

  res.on('finish', () => {
    const route = req.route?.path || req.path || 'unknown';
    const labels = { method: req.method, route, status_code: res.statusCode };
    httpRequestsTotal.inc(labels);
    end(labels);
    activeConnections.dec();
  });

  next();
}

// Endpoint /metrics para Prometheus
export async function metricsEndpoint(req, res) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}

export { register };
