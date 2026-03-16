import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { sequelize } from './models/index.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import promotionRoutes from './routes/promotions.js';
import orderRoutes from './routes/orders.js';
import returnRoutes from './routes/returns.js';
import userRoutes from './routes/users.js';
import wishlistRoutes from './routes/wishlist.js';
import shippingRoutes from './routes/shipping.js';
import giftcardRoutes from './routes/giftcards.js';
import reviewsRoutes from './routes/reviews.js';
import uploadRoutes from './routes/cloudinary.js';
import supplierRoutes from './routes/suppliers.js';
import warehouseRoutes from './routes/warehouses.js';
import purchaseOrderRoutes from './routes/purchaseOrders.js';
import inventoryRoutes from './routes/inventory.js';
import paymentRoutes from './routes/payments.js';
import manualUploadRoutes from './routes/manual-upload.js';
import settingsRoutes from './routes/settings.js';
import { seedIfEmpty } from './seed.js';

dotenv.config();

const app = express();
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    const allowed = process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.replace(/\/index\.html$/, '').replace(/\/$/, '')
      : null;
    if (!allowed || origin.replace(/\/$/, '') === allowed) return callback(null, true);
    callback(null, true); // allow all for now — tighten later if needed
  },
  credentials: true
}));
app.use(express.json());

const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:5502/index.html';

console.log('Connecting to PostgreSQL...');
sequelize.authenticate().then(async ()=>{
  console.log('PostgreSQL connected successfully');
  await sequelize.sync({ alter: true });
  console.log('Database tables synchronized');
  try {
    await seedIfEmpty();
    console.log('Seed check complete');
  } catch(seedErr) {
    console.error('Seed error (non-fatal):', seedErr.message);
  }
  app.listen(PORT, "0.0.0.0", ()=> console.log(`API on http://localhost:${PORT}`));
}).catch(err=>{
  console.error('PostgreSQL connection error:', err.message);
  process.exit(1);
});

app.get('/health', (req,res)=>res.json({ ok:true }));

// Serve frontend at root
app.get('/', (req, res) => {
  res.redirect(FRONTEND_URL);
});

// Redirect to frontend app
app.get('/login', (req, res) => {
  res.redirect(FRONTEND_URL);
});

app.get('/reset-success', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Contraseña Restablecida - Pura Lino</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
        .success-icon { font-size: 4rem; color: #28a745; margin-bottom: 20px; }
        .btn { display: inline-block; padding: 15px 30px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        .btn:hover { background: #0056b3; }
      </style>
    </head>
    <body>
      <div class="success-icon">✅</div>
      <h1>¡Contraseña Restablecida!</h1>
      <p>Tu contraseña ha sido actualizada exitosamente.</p>
      <a href="${FRONTEND_URL}" class="btn">Ir a Iniciar Sesión</a>
    </body>
    </html>
  `);
});

// API documentation page (keep existing)
app.get('/api-docs', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Pura Lino - API Documentation</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; margin-bottom: 30px; }
        .links { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px; }
        .link-btn { display: block; padding: 15px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; text-align: center; transition: background 0.3s; }
        .link-btn:hover { background: #0056b3; }
        .info { background: #e7f3ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🌿 Pura Lino - API Server</h1>
        
        <div class="info">
          <strong>📧 Sistema de Autenticación Implementado:</strong>
          <ul>
            <li>✅ Login con usuario o email</li>
            <li>✅ Verificación de cuenta por email</li>
            <li>✅ Recuperación de contraseña</li>
            <li>✅ Reenvío de verificación</li>
          </ul>
        </div>
        
        <h3>🔗 Enlaces Rápidos:</h3>
        <div class="links">
          <a href="${FRONTEND_URL}" class="link-btn" target="_blank">
            🏠 Abrir Frontend
          </a>
          <a href="/health" class="link-btn" target="_blank">
            💚 Health Check
          </a>
          <a href="https://resend.com" class="link-btn" target="_blank">
            📬 Resend (Servicio de Email)
          </a>
        </div>
        
        <div style="margin-top: 30px; padding: 15px; background: #f8f9fa; border-radius: 5px;">
          <h4>📋 Endpoints de Autenticación:</h4>
          <ul style="margin: 0; padding-left: 20px;">
            <li><code>POST /auth/register</code> - Registro</li>
            <li><code>POST /auth/login</code> - Login</li>
            <li><code>GET /auth/me</code> - Perfil de usuario</li>
            <li><code>GET /auth/verify-email?token=...</code> - Verificar email</li>
            <li><code>POST /auth/forgot-password</code> - Olvidé contraseña</li>
            <li><code>GET /auth/reset-password?token=...</code> - Página reset</li>
            <li><code>POST /auth/reset-password</code> - Reset contraseña</li>
            <li><code>POST /auth/resend-verification</code> - Reenviar verificación</li>
          </ul>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/promotions', promotionRoutes);
app.use('/orders', orderRoutes);
app.use('/returns', returnRoutes);
app.use('/users', userRoutes);
app.use('/wishlist', wishlistRoutes);
app.use('/shipping', shippingRoutes);
app.use('/giftcards', giftcardRoutes);
app.use('/reviews', reviewsRoutes);
app.use('/upload', uploadRoutes);
app.use('/upload', manualUploadRoutes);
app.use('/suppliers', supplierRoutes);
app.use('/warehouses', warehouseRoutes);
app.use('/purchase-orders', purchaseOrderRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/payments', paymentRoutes);
app.use('/settings', settingsRoutes);
