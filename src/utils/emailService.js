import dotenv from 'dotenv';

dotenv.config();

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@puralino.com';
const FROM_NAME = 'Pura Lino';

if (BREVO_API_KEY) console.log('📧 Brevo HTTP API ready — From:', FROM_EMAIL);
else console.warn('📧 BREVO_API_KEY not set — emails will not be sent');

// ─── Shared layout ───────────────────────────────────────────
function layout(title, body) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;">
    <div style="background:#8b7355;padding:24px 32px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:22px;letter-spacing:2px;">PURA LINO</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#333;margin-top:0;">${title}</h2>
      ${body}
    </div>
    <div style="background:#faf9f7;padding:20px 32px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#999;font-size:13px;margin:0;">Pura Lino — Lino Puro, Comodidad Pura</p>
      <p style="color:#bbb;font-size:11px;margin:6px 0 0;">Este es un correo automático, por favor no respondas.</p>
    </div>
  </div>
</body>
</html>`;
}

function btn(href, text, color = '#8b7355') {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${href}" style="background:${color};color:#fff;padding:14px 36px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;font-size:15px;">${text}</a>
  </div>`;
}

function copFmt(value) {
  return new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0, maximumFractionDigits:0 }).format(value);
}

// ─── Send helper (Brevo HTTP API) ────────────────────────────
async function send(to, subject, html) {
  if (!BREVO_API_KEY) { console.error('📧 No API key, skipping email'); return null; }
  try {
    console.log(`📧 Sending "${subject}" to ${to}`);
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    const data = await res.json();
    if (!res.ok) { console.error('📧 Brevo error:', data.message || JSON.stringify(data)); throw new Error(data.message || 'Email send failed'); }
    console.log('📧 Sent OK, messageId:', data.messageId);
    return data;
  } catch (err) {
    console.error('📧 Send failed:', err.message);
    throw err;
  }
}

// ─── 1. Verificación de email ────────────────────────────────
export async function sendVerificationEmail(email, token) {
  const url = `${process.env.API_URL || 'http://localhost:4000'}/auth/verify-email?token=${token}`;
  const html = layout('¡Bienvenido a Pura Lino!', `
    <p style="color:#555;line-height:1.6;">Gracias por registrarte. Para activar tu cuenta, haz clic en el siguiente botón:</p>
    ${btn(url, 'Verificar mi Cuenta')}
    <p style="color:#888;font-size:13px;">Si no creaste esta cuenta, puedes ignorar este correo. El enlace expira en 24 horas.</p>
  `);
  return send(email, 'Verifica tu cuenta — Pura Lino', html);
}

// ─── 2. Recuperación de contraseña ───────────────────────────
export async function sendPasswordResetEmail(email, token) {
  const url = `${process.env.API_URL || 'http://localhost:4000'}/auth/reset-password?token=${token}`;
  const html = layout('Recuperar Contraseña', `
    <p style="color:#555;line-height:1.6;">Recibimos una solicitud para restablecer tu contraseña.</p>
    ${btn(url, 'Restablecer Contraseña', '#c0392b')}
    <p style="color:#888;font-size:13px;">Si no solicitaste esto, ignora este correo. El enlace expira en 1 hora.</p>
  `);
  return send(email, 'Recuperar contraseña — Pura Lino', html);
}

// ─── 3. Confirmación de pedido ───────────────────────────────
export async function sendOrderConfirmation(order) {
  const itemsHtml = (order.items || []).map(i => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${i.productName || i.product?.name || 'Producto'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${i.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${copFmt((i.productPrice || i.product?.price || 0) * i.quantity)}</td>
    </tr>
  `).join('');

  const html = layout('¡Pedido Confirmado!', `
    <p style="color:#555;line-height:1.6;">Hola <strong>${order.userName}</strong>, tu pedido ha sido confirmado.</p>
    <div style="background:#faf9f7;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 4px;"><strong>Pedido #:</strong> ${order.invoiceNumber}</p>
      <p style="margin:0 0 4px;"><strong>Fecha:</strong> ${new Date(order.date).toLocaleDateString('es-CO')}</p>
      <p style="margin:0;"><strong>Dirección:</strong> ${order.address || 'N/A'}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <thead><tr style="background:#8b7355;color:#fff;">
        <th style="padding:10px 12px;text-align:left;">Producto</th>
        <th style="padding:10px 12px;text-align:center;">Cant.</th>
        <th style="padding:10px 12px;text-align:right;">Subtotal</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div style="text-align:right;margin-top:12px;">
      <p style="margin:4px 0;color:#555;">Subtotal: ${copFmt(order.subtotal)}</p>
      ${order.discount > 0 ? `<p style="margin:4px 0;color:#27ae60;">Descuento: -${copFmt(order.discount)}</p>` : ''}
      ${order.shippingCost > 0 ? `<p style="margin:4px 0;color:#555;">Envío (${order.shippingCity || ''}): ${copFmt(order.shippingCost)}</p>` : ''}
      ${order.giftApplied > 0 ? `<p style="margin:4px 0;color:#27ae60;">Gift Card: -${copFmt(order.giftApplied)}</p>` : ''}
      <p style="margin:8px 0 0;font-size:18px;color:#333;"><strong>Total: ${copFmt(order.total)}</strong></p>
    </div>
    <p style="color:#888;font-size:13px;margin-top:20px;">Te enviaremos otro correo cuando tu pedido sea despachado.</p>
  `);
  return send(order.email, `Pedido confirmado #${order.invoiceNumber} — Pura Lino`, html);
}

// ─── 4. Factura por email ────────────────────────────────────
export async function sendInvoiceEmail(order) {
  const itemsHtml = (order.items || []).map(i => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${i.productName || i.product?.name || 'Producto'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${i.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${copFmt(i.productPrice || i.product?.price || 0)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${copFmt((i.productPrice || i.product?.price || 0) * i.quantity)}</td>
    </tr>
  `).join('');

  const html = layout(`Factura ${order.invoiceNumber}`, `
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
      <div>
        <p style="margin:2px 0;color:#555;"><strong>Cliente:</strong> ${order.userName}</p>
        <p style="margin:2px 0;color:#555;"><strong>Email:</strong> ${order.email}</p>
        <p style="margin:2px 0;color:#555;"><strong>Teléfono:</strong> ${order.phone || 'N/A'}</p>
      </div>
      <div>
        <p style="margin:2px 0;color:#555;"><strong>Fecha:</strong> ${new Date(order.date).toLocaleDateString('es-CO')}</p>
        <p style="margin:2px 0;color:#555;"><strong>Dirección:</strong> ${order.address || 'N/A'}</p>
        ${order.shippingCity ? `<p style="margin:2px 0;color:#555;"><strong>Ciudad:</strong> ${order.shippingCity}</p>` : ''}
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#8b7355;color:#fff;">
        <th style="padding:10px 12px;text-align:left;">Producto</th>
        <th style="padding:10px 12px;text-align:center;">Cant.</th>
        <th style="padding:10px 12px;text-align:right;">P. Unit.</th>
        <th style="padding:10px 12px;text-align:right;">Subtotal</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div style="text-align:right;margin-top:16px;padding-top:12px;border-top:2px solid #8b7355;">
      <p style="margin:4px 0;color:#555;">Subtotal: ${copFmt(order.subtotal)}</p>
      ${order.discount > 0 ? `<p style="margin:4px 0;color:#27ae60;">Descuento: -${copFmt(order.discount)}</p>` : ''}
      ${order.shippingCost > 0 ? `<p style="margin:4px 0;color:#555;">Envío: ${copFmt(order.shippingCost)}</p>` : ''}
      ${order.giftApplied > 0 ? `<p style="margin:4px 0;color:#27ae60;">Gift Card (${order.giftCardCode || ''}): -${copFmt(order.giftApplied)}</p>` : ''}
      <p style="margin:12px 0 0;font-size:20px;color:#333;"><strong>TOTAL: ${copFmt(order.total)}</strong></p>
    </div>
  `);
  return send(order.email, `Factura ${order.invoiceNumber} — Pura Lino`, html);
}

// ─── 5. Actualización de estado de pedido ────────────────────
export async function sendOrderStatusUpdate(order, newStatus) {
  const statusMap = {
    'confirmado': { label: 'Confirmado ✅', color: '#27ae60', msg: 'Tu pedido ha sido confirmado y está siendo preparado.' },
    'enviado':    { label: 'Enviado 🚚', color: '#2980b9', msg: 'Tu pedido ha sido despachado y está en camino.' },
    'entregado':  { label: 'Entregado 📦', color: '#8b7355', msg: '¡Tu pedido ha sido entregado! Esperamos que lo disfrutes.' },
  };
  const info = statusMap[newStatus] || { label: newStatus, color: '#555', msg: 'El estado de tu pedido ha sido actualizado.' };

  const trackingHtml = order.trackingNumber
    ? `<div style="background:#faf9f7;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 4px;"><strong>Guía de envío:</strong> ${order.trackingNumber}</p>
        ${order.carrier ? `<p style="margin:0;"><strong>Transportadora:</strong> ${order.carrier}</p>` : ''}
      </div>`
    : '';

  const html = layout('Actualización de Pedido', `
    <p style="color:#555;line-height:1.6;">Hola <strong>${order.userName}</strong>,</p>
    <div style="text-align:center;margin:24px 0;">
      <span style="display:inline-block;background:${info.color};color:#fff;padding:10px 28px;border-radius:20px;font-size:16px;font-weight:600;">${info.label}</span>
    </div>
    <p style="color:#555;line-height:1.6;text-align:center;">${info.msg}</p>
    ${trackingHtml}
    <div style="background:#faf9f7;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 4px;"><strong>Pedido:</strong> ${order.invoiceNumber}</p>
      <p style="margin:0;"><strong>Total:</strong> ${copFmt(order.total)}</p>
    </div>
    <p style="color:#888;font-size:13px;">Si tienes alguna pregunta, no dudes en contactarnos.</p>
  `);
  return send(order.email, `Tu pedido ${order.invoiceNumber} — ${info.label}`, html);
}

// ─── 6. Notificación de tracking ─────────────────────────────
export async function sendTrackingUpdate(order, event) {
  const html = layout('Actualización de Envío', `
    <p style="color:#555;line-height:1.6;">Hola <strong>${order.userName}</strong>,</p>
    <p style="color:#555;line-height:1.6;">Hay una nueva actualización en el envío de tu pedido <strong>${order.invoiceNumber}</strong>:</p>
    <div style="background:#eaf4fc;border-left:4px solid #2980b9;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;">
      <p style="margin:0 0 4px;font-weight:600;color:#2980b9;">${event.status}</p>
      ${event.note ? `<p style="margin:0;color:#555;">${event.note}</p>` : ''}
      <p style="margin:8px 0 0;color:#999;font-size:12px;">${new Date(event.date || Date.now()).toLocaleString('es-CO')}</p>
    </div>
    ${order.trackingNumber ? `<p style="color:#555;">Guía: <strong>${order.trackingNumber}</strong> ${order.carrier ? `(${order.carrier})` : ''}</p>` : ''}
  `);
  return send(order.email, `Actualización de envío — Pedido ${order.invoiceNumber}`, html);
}

// ─── 7. Devolución aprobada — instrucciones de envío ─────────
export async function sendReturnApproved(ret) {
  const typeLabels = { garantia:'Garantía', cambio_talla:'Cambio de talla', cambio_color:'Cambio de color', defecto:'Defecto de fábrica', otro:'Otro' };
  const isWarranty = ret.type === 'garantia' || ret.type === 'defecto';
  const shippingNote = isWarranty
    ? '<p style="color:#27ae60;font-weight:600;">✅ Por tratarse de una garantía/defecto, los gastos de envío corren por nuestra cuenta.</p>'
    : '<p style="color:#e74c3c;font-weight:600;">⚠️ Al no tratarse de garantía, los gastos de envío (ida y vuelta) corren por tu cuenta.</p>';

  const html = layout('Devolución Aprobada', `
    <p style="color:#555;line-height:1.6;">Hola <strong>${ret.customerName}</strong>,</p>
    <p style="color:#555;line-height:1.6;">Tu solicitud de devolución <strong>${ret.returnNumber}</strong> ha sido <span style="color:#27ae60;font-weight:700;">aprobada</span>.</p>

    <div style="background:#faf9f7;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 4px;"><strong>Producto:</strong> ${ret.productName}${ret.variantLabel ? ` (${ret.variantLabel})` : ''}</p>
      <p style="margin:0 0 4px;"><strong>Tipo:</strong> ${typeLabels[ret.type] || ret.type}</p>
      <p style="margin:0 0 4px;"><strong>Pedido:</strong> ${ret.orderNumber}</p>
      <p style="margin:0;"><strong>Valor:</strong> ${copFmt(ret.productPrice || 0)}</p>
    </div>

    <h3 style="color:#333;margin-top:24px;">📦 Instrucciones de devolución</h3>
    <ol style="color:#555;line-height:1.8;">
      <li>Empaca el producto en su empaque original o en una caja adecuada.</li>
      <li>El producto debe estar en <strong>perfectas condiciones</strong>: sin uso, sin manchas, con etiquetas (si aplica).</li>
      <li>Incluye una nota con tu número de devolución: <strong>${ret.returnNumber}</strong></li>
      <li>Envía el paquete a la siguiente dirección:</li>
    </ol>

    <div style="background:#e8f5e9;border-left:4px solid #27ae60;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;">
      <p style="margin:0;font-weight:600;font-size:15px;">📍 Dirección de envío:</p>
      <p style="margin:8px 0 0;font-size:15px;">${ret.warehouseAddress || ret.warehouseName}</p>
      <p style="margin:4px 0 0;color:#555;">Bodega: ${ret.warehouseName}</p>
      <p style="margin:4px 0 0;color:#555;">Referencia: ${ret.returnNumber}</p>
    </div>

    ${shippingNote}

    <h3 style="color:#333;margin-top:24px;">📋 Políticas de cambios y devoluciones</h3>
    <ul style="color:#555;line-height:1.8;font-size:14px;">
      <li>Tienes <strong>7 días hábiles</strong> desde la aprobación para enviar el producto.</li>
      <li>No se realizan devoluciones de dinero. Se genera un <strong>cupón personal</strong> por el valor del producto para usar en la tienda.</li>
      <li>El producto debe estar en perfectas condiciones (sin uso, limpio, con etiquetas). De lo contrario, la devolución será rechazada.</li>
      <li>En caso de cambio de talla o color, podrás realizar un nuevo pedido utilizando el cupón generado.</li>
      <li>Los cupones de devolución son <strong>personales e intransferibles</strong> y tienen vigencia de 3 meses.</li>
      <li>Pura Lino se reserva el derecho de rechazar devoluciones que no cumplan con las condiciones establecidas.</li>
    </ul>

    ${ret.adminNotes ? `<div style="background:#fff3cd;border-radius:8px;padding:12px;margin:16px 0;"><p style="margin:0;color:#856404;"><strong>Nota del equipo:</strong> ${ret.adminNotes}</p></div>` : ''}

    <p style="color:#888;font-size:13px;margin-top:20px;">Si tienes alguna duda, no dudes en contactarnos.</p>
  `);
  return send(ret.customerEmail, `Devolución ${ret.returnNumber} aprobada — Pura Lino`, html);
}

// ─── 8. Devolución rechazada ─────────────────────────────────
export async function sendReturnRejected(ret) {
  const html = layout('Solicitud de Devolución Rechazada', `
    <p style="color:#555;line-height:1.6;">Hola <strong>${ret.customerName}</strong>,</p>
    <p style="color:#555;line-height:1.6;">Lamentamos informarte que tu solicitud de devolución <strong>${ret.returnNumber}</strong> ha sido <span style="color:#e74c3c;font-weight:700;">rechazada</span>.</p>

    <div style="background:#faf9f7;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 4px;"><strong>Producto:</strong> ${ret.productName}${ret.variantLabel ? ` (${ret.variantLabel})` : ''}</p>
      <p style="margin:0;"><strong>Pedido:</strong> ${ret.orderNumber}</p>
    </div>

    <div style="background:#f8d7da;border-left:4px solid #e74c3c;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;">
      <p style="margin:0;font-weight:600;color:#721c24;">Motivo del rechazo:</p>
      <p style="margin:8px 0 0;color:#721c24;">${ret.rejectionReason}</p>
    </div>

    <p style="color:#888;font-size:13px;">Si consideras que esto es un error, puedes contactarnos para revisar tu caso.</p>
  `);
  return send(ret.customerEmail, `Devolución ${ret.returnNumber} rechazada — Pura Lino`, html);
}

// ─── 9. Devolución recibida en bodega ────────────────────────
export async function sendReturnReceived(ret) {
  const html = layout('Devolución Recibida', `
    <p style="color:#555;line-height:1.6;">Hola <strong>${ret.customerName}</strong>,</p>
    <p style="color:#555;line-height:1.6;">Te confirmamos que hemos <strong>recibido</strong> tu devolución <strong>${ret.returnNumber}</strong> en nuestra bodega.</p>

    <div style="background:#faf9f7;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 4px;"><strong>Producto:</strong> ${ret.productName}${ret.variantLabel ? ` (${ret.variantLabel})` : ''}</p>
      <p style="margin:0;"><strong>Bodega:</strong> ${ret.warehouseName}</p>
    </div>

    <div style="background:#e3f2fd;border-left:4px solid #2196f3;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;">
      <p style="margin:0;font-weight:600;color:#1565c0;">🔍 Tu producto está en revisión</p>
      <p style="margin:8px 0 0;color:#555;">Nuestro equipo revisará el estado del producto y te notificaremos el resultado en los próximos días hábiles.</p>
    </div>

    <p style="color:#888;font-size:13px;">Gracias por tu paciencia.</p>
  `);
  return send(ret.customerEmail, `Devolución ${ret.returnNumber} recibida — Pura Lino`, html);
}

// ─── 10. Resultado de revisión (con cupón si apta) ──────────
export async function sendReturnReviewResult(ret) {
  if (ret.reviewResult === 'apta') {
    const html = layout('Devolución Aprobada — Tu Cupón', `
      <p style="color:#555;line-height:1.6;">Hola <strong>${ret.customerName}</strong>,</p>
      <p style="color:#555;line-height:1.6;">¡Buenas noticias! Tu devolución <strong>${ret.returnNumber}</strong> ha sido revisada y <span style="color:#27ae60;font-weight:700;">aprobada</span>.</p>

      <div style="background:#faf9f7;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 4px;"><strong>Producto:</strong> ${ret.productName}${ret.variantLabel ? ` (${ret.variantLabel})` : ''}</p>
        ${ret.reviewNotes ? `<p style="margin:0;color:#555;">Observaciones: ${ret.reviewNotes}</p>` : ''}
      </div>

      <div style="background:#e8f5e9;border:2px solid #27ae60;border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
        <p style="margin:0 0 8px;font-size:14px;color:#555;">Tu cupón personal:</p>
        <p style="margin:0;font-size:28px;font-weight:700;color:#27ae60;letter-spacing:3px;">${ret.couponCode}</p>
        <p style="margin:12px 0 0;font-size:20px;color:#333;font-weight:600;">Valor: ${copFmt(ret.couponValue || 0)}</p>
        <p style="margin:8px 0 0;font-size:13px;color:#888;">Vigencia: 3 meses desde hoy</p>
      </div>

      <h3 style="color:#333;">¿Cómo usar tu cupón?</h3>
      <ol style="color:#555;line-height:1.8;">
        <li>Ingresa a nuestra tienda y selecciona los productos que deseas.</li>
        <li>En el proceso de pago, ingresa el código del cupón <strong>${ret.couponCode}</strong>.</li>
        <li>El valor del cupón se descontará automáticamente de tu compra.</li>
      </ol>

      <p style="color:#888;font-size:13px;">Este cupón es personal e intransferible. Solo puede ser utilizado por la cuenta asociada a esta devolución.</p>
    `);
    return send(ret.customerEmail, `Tu cupón de devolución ${ret.couponCode} — Pura Lino`, html);
  } else {
    const html = layout('Revisión de Devolución — No Apta', `
      <p style="color:#555;line-height:1.6;">Hola <strong>${ret.customerName}</strong>,</p>
      <p style="color:#555;line-height:1.6;">Lamentamos informarte que después de revisar tu devolución <strong>${ret.returnNumber}</strong>, el producto <span style="color:#e74c3c;font-weight:700;">no cumple</span> con las condiciones para ser aceptado.</p>

      <div style="background:#faf9f7;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 4px;"><strong>Producto:</strong> ${ret.productName}${ret.variantLabel ? ` (${ret.variantLabel})` : ''}</p>
      </div>

      <div style="background:#f8d7da;border-left:4px solid #e74c3c;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;">
        <p style="margin:0;font-weight:600;color:#721c24;">Motivo:</p>
        <p style="margin:8px 0 0;color:#721c24;">${ret.reviewRejectionReason || 'El producto no se encuentra en las condiciones requeridas.'}</p>
        ${ret.reviewNotes ? `<p style="margin:8px 0 0;color:#555;">Observaciones: ${ret.reviewNotes}</p>` : ''}
      </div>

      <p style="color:#555;line-height:1.6;">El producto será devuelto a tu dirección. Si tienes alguna duda, contáctanos.</p>
    `);
    return send(ret.customerEmail, `Revisión de devolución ${ret.returnNumber} — Pura Lino`, html);
  }
}
