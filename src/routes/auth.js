import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/emailService.js';

const router = express.Router();

router.post('/register', async (req,res)=>{
  try{
    const { username, password, name, email } = req.body;
    
    // ── Input validations ──
    if (!name || !name.trim()) return res.status(400).json({ error:'El nombre es obligatorio' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error:'Ingresa un correo electrónico válido' });
    if (!username || username.trim().length < 3) return res.status(400).json({ error:'El usuario debe tener al menos 3 caracteres' });
    if (!password || password.length < 6) return res.status(400).json({ error:'La contraseña debe tener al menos 6 caracteres' });
    if (!/[A-Z]/.test(password)) return res.status(400).json({ error:'La contraseña debe tener al menos una mayúscula' });
    if (!/[0-9]/.test(password)) return res.status(400).json({ error:'La contraseña debe tener al menos un número' });
    
    // Check if username already exists
    const usernameExists = await User.findOne({ username });
    if(usernameExists) return res.status(400).json({ error:'El usuario ya existe' });
    
    // Check if email already exists
    const emailExists = await User.findOne({ email });
    if(emailExists) return res.status(400).json({ error:'El correo electrónico ya está registrado' });
    
    const passwordHash = await bcrypt.hash(password, 10);
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    const user = await User.create({ 
      username, 
      passwordHash, 
      role:'client', 
      name, 
      email,
      emailVerificationToken,
      emailVerificationExpires
    });
    
    // Send verification email (fire-and-forget)
    sendVerificationEmail(email, emailVerificationToken)
      .catch(e => console.error('📧 Verification email failed:', e.message));
    
    return res.json({ 
      id:user._id, 
      username, 
      role:user.role, 
      name:user.name, 
      email:user.email, 
      address:user.address, 
      phone:user.phone,
      message: 'Registro exitoso. Por favor revisa tu correo para verificar tu cuenta.'
    });
  }catch(err){ 
    console.error('Registration error:', err);
    res.status(500).json({ error:'Error del servidor' }); 
  }
});

router.get('/me', authRequired, async (req,res)=>{
  try{
    const user = await User.findById(req.user.id);
    if(!user) return res.status(404).json({ error:'Not found' });
    const { passwordHash, ...safe } = user.toObject();
    res.json(safe);
  }catch(err){ res.status(500).json({ error:'Server error' }); }
});

router.post('/login', async (req,res)=>{
  try{
    const { username, password } = req.body;
    
    // Find user by username or email
    const user = await User.findOne({ 
      $or: [
        { username },
        { email: username }
      ]
    });
    
    if(!user) return res.status(401).json({ error:'Credenciales inválidas' });
    
    const ok = await bcrypt.compare(password, user.passwordHash);
    if(!ok) return res.status(401).json({ error:'Credenciales inválidas' });
    
    const token = jwt.sign({ 
      id:String(user._id), 
      role:user.role, 
      name:user.name 
    }, process.env.JWT_SECRET || 'dev_secret', { expiresIn:'7d' });
    
    res.json({ 
      token, 
      user: { 
        id:String(user._id), 
        username:user.username, 
        role:user.role, 
        name:user.name, 
        email:user.email, 
        address:user.address, 
        phone:user.phone,
        emailVerified: user.emailVerified
      } 
    });
  }catch(err){ 
    console.error('Login error:', err);
    res.status(500).json({ error:'Error del servidor' }); 
  }
});

// Email verification endpoint
router.get('/verify-email', async (req, res) => {
  const FRONTEND = process.env.FRONTEND_URL || 'http://127.0.0.1:5502/index.html';
  const page = (icon, title, msg, redirect) => `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Pura Lino</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f5f0;font-family:'Segoe UI',Arial,sans-serif}
  .card{background:#fff;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.1);max-width:440px;width:90%;text-align:center;overflow:hidden}
  .header{background:#8b7355;padding:24px;color:#fff;font-size:20px;letter-spacing:2px;font-weight:700}
  .body{padding:40px 32px}
  .icon{font-size:4rem;margin-bottom:16px}
  h2{color:#333;margin:0 0 12px}
  p{color:#666;line-height:1.6;margin:8px 0}
  .countdown{color:#8b7355;font-weight:600;font-size:1.1rem}
  .btn{display:inline-block;margin-top:20px;padding:14px 36px;background:#8b7355;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;transition:background .2s}
  .btn:hover{background:#74604a}
</style>
</head>
<body>
<div class="card">
  <div class="header">PURA LINO</div>
  <div class="body">
    <div class="icon">${icon}</div>
    <h2>${title}</h2>
    <p>${msg}</p>
    ${redirect ? `<p class="countdown">Serás redirigido en <span id="sec">5</span> segundos...</p>
    <a href="${FRONTEND}" class="btn">Ir ahora</a>
    <script>
      let s=5; const el=document.getElementById('sec');
      const t=setInterval(()=>{s--;el.textContent=s;if(s<=0){clearInterval(t);location.href='${FRONTEND}';}},1000);
    </script>` : `<a href="${FRONTEND}" class="btn">Volver al inicio</a>`}
  </div>
</div>
</body></html>`;

  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).send(page('⚠️', 'Token Inválido', 'No se proporcionó un token de verificación.', false));
    }
    
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() }
    });
    
    if (!user) {
      return res.status(400).send(page('❌', 'Enlace Expirado', 'Este enlace de verificación es inválido o ha expirado. Por favor solicita uno nuevo desde la aplicación.', false));
    }
    
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    
    res.send(page('✅', '¡Cuenta Verificada!', `Tu cuenta <strong>${user.email}</strong> ha sido activada exitosamente. Ya puedes iniciar sesión.`, true));
  } catch (err) {
    console.error('Email verification error:', err);
    res.status(500).send(page('❌', 'Error', 'Ocurrió un error al verificar tu cuenta. Inténtalo de nuevo.', false));
  }
});

// Forgot password endpoint
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Correo electrónico requerido' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists for security
      return res.json({ message: 'Si el correo está registrado, recibirás un enlace de recuperación.' });
    }
    
    const passwordResetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    user.passwordResetToken = passwordResetToken;
    user.passwordResetExpires = passwordResetExpires;
    await user.save();
    
    // Fire-and-forget
    sendPasswordResetEmail(email, passwordResetToken)
      .catch(e => console.error('📧 Reset email failed:', e.message));
    
    res.json({ message: 'Si el correo está registrado, recibirás un enlace de recuperación.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Reset password page (GET)
router.get('/reset-password', async (req, res) => {
  const FRONTEND = process.env.FRONTEND_URL || 'http://127.0.0.1:5502/index.html';
  const baseStyle = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Restablecer Contraseña — Pura Lino</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f5f0;font-family:Inter,'Segoe UI',Arial,sans-serif;padding:1rem}
  .card{background:#fff;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.1);max-width:440px;width:100%;overflow:hidden}
  .header{background:#8b7355;padding:24px;text-align:center;color:#fff;font-size:20px;letter-spacing:2px;font-weight:700}
  .body{padding:40px 32px}
  .icon{font-size:4rem;text-align:center;margin-bottom:16px}
  h2{color:#333;margin:0 0 12px;text-align:center}
  p{color:#666;line-height:1.6;margin:8px 0;text-align:center}
  .form-group{margin-bottom:1rem}
  .form-group label{display:block;margin-bottom:.4rem;font-size:.9rem;font-weight:500;color:#333}
  .form-group input{width:100%;padding:.75rem .9rem;border:1px solid #eaeaea;border-radius:10px;font-size:1rem;transition:border-color .2s;outline:none;font-family:inherit}
  .form-group input:focus{border-color:#8b7355}
  .btn{display:block;width:100%;margin-top:1.25rem;padding:14px;background:#111;color:#fff;border:none;border-radius:999px;font-size:1rem;font-weight:600;cursor:pointer;transition:background .2s;font-family:inherit}
  .btn:hover{background:#333}
  .btn-link{display:inline-block;margin-top:20px;padding:14px 36px;background:#8b7355;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;transition:background .2s}
  .btn-link:hover{background:#74604a}
  .error{color:#dc3545;margin-top:.75rem;font-size:.88rem;text-align:center;min-height:1.2em}
  .countdown{color:#8b7355;font-weight:600;font-size:1.1rem;text-align:center}
  .hint{font-size:.8rem;color:#999;margin-top:.3rem}
  @media(max-width:480px){.body{padding:28px 20px} h2{font-size:1.15rem}}
</style>
</head>
<body>
<div class="card">
  <div class="header">PURA LINO</div>
  <div class="body">`;
  const endCard = `</div></div></body></html>`;

  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).send(`${baseStyle}
    <div class="icon">⚠️</div>
    <h2>Token No Proporcionado</h2>
    <p>No se encontró un token de recuperación en el enlace.</p>
    <a href="${FRONTEND}" class="btn-link" style="display:block;text-align:center;margin-top:20px;">Volver al inicio</a>
${endCard}`);
    }
    
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() }
    });
    
    if (!user) {
      return res.status(400).send(`${baseStyle}
    <div class="icon">❌</div>
    <h2>Enlace Inválido o Expirado</h2>
    <p>Este enlace de recuperación ya no es válido o ha expirado.</p>
    <p>Por favor solicita un nuevo enlace desde la aplicación.</p>
    <a href="${FRONTEND}" class="btn-link" style="display:block;text-align:center;margin-top:20px;">Volver al inicio</a>
${endCard}`);
    }
    
    // Send HTML form for password reset
    res.send(`${baseStyle}
    <div class="icon">🔒</div>
    <h2>Restablecer Contraseña</h2>
    <p style="margin-bottom:1.5rem;">Ingresa tu nueva contraseña para recuperar el acceso a tu cuenta.</p>
    <form id="resetForm" onsubmit="resetPassword(event)">
      <input type="hidden" id="token" value="${token}">
      <div class="form-group">
        <label for="newPassword">Nueva Contraseña</label>
        <input type="password" id="newPassword" required placeholder="Mínimo 8 caracteres" minlength="8">
        <p class="hint">Debe contener al menos una mayúscula, una minúscula y un número.</p>
      </div>
      <div class="form-group">
        <label for="confirmPassword">Confirmar Contraseña</label>
        <input type="password" id="confirmPassword" required placeholder="Repite tu contraseña">
      </div>
      <button class="btn" type="submit">Restablecer Contraseña</button>
      <div id="error" class="error"></div>
    </form>
    
    <script>
      async function resetPassword(event) {
        event.preventDefault();
        const btn = event.target.querySelector('.btn');
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const token = document.getElementById('token').value;
        const errorDiv = document.getElementById('error');
        errorDiv.textContent = '';
        
        if (newPassword.length < 8) { errorDiv.textContent = 'La contraseña debe tener al menos 8 caracteres'; return; }
        if (!/[A-Z]/.test(newPassword)) { errorDiv.textContent = 'Debe contener al menos una letra mayúscula'; return; }
        if (!/[a-z]/.test(newPassword)) { errorDiv.textContent = 'Debe contener al menos una letra minúscula'; return; }
        if (!/[0-9]/.test(newPassword)) { errorDiv.textContent = 'Debe contener al menos un número'; return; }
        if (newPassword !== confirmPassword) { errorDiv.textContent = 'Las contraseñas no coinciden'; return; }
        
        btn.disabled = true; btn.textContent = 'Procesando...';
        try {
          const response = await fetch('/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Error al restablecer contraseña');
          
          document.querySelector('.body').innerHTML = 
            '<div class="icon">✅</div>' +
            '<h2>¡Contraseña Actualizada!</h2>' +
            '<p>Tu contraseña ha sido restablecida exitosamente.</p>' +
            '<p class="countdown">Serás redirigido en <span id="sec">5</span> segundos...</p>' +
            '<a href="${FRONTEND}" class="btn-link" style="display:block;text-align:center;margin-top:20px;">Ir a Iniciar Sesión</a>';
          let s = 5; const el = document.getElementById('sec');
          const t = setInterval(() => { s--; el.textContent = s; if (s <= 0) { clearInterval(t); location.href = '${FRONTEND}'; } }, 1000);
        } catch (error) {
          btn.disabled = false; btn.textContent = 'Restablecer Contraseña';
          errorDiv.textContent = error.message;
        }
      }
    </script>
${endCard}`);
  } catch (err) {
    console.error('Reset password page error:', err);
    res.status(500).send('Error del servidor');
  }
});

// Reset password endpoint
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token y nueva contraseña requeridos' });
    }
    
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() }
    });
    
    if (!user) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }
    
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    
    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Correo electrónico requerido' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    if (user.emailVerified) {
      return res.status(400).json({ error: 'El correo ya está verificado' });
    }
    
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    user.emailVerificationToken = emailVerificationToken;
    user.emailVerificationExpires = emailVerificationExpires;
    await user.save();
    
    // Fire-and-forget
    sendVerificationEmail(email, emailVerificationToken)
      .catch(e => console.error('📧 Resend verification email failed:', e.message));
    
    res.json({ message: 'Correo de verificación reenviado' });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;
