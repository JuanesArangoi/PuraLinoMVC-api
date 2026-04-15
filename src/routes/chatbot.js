import { Router } from 'express';
import { Product, Order, Promotion } from '../models/index.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// Contextual responses database
const FAQ = [
  { keys: ['envio','envío','despacho','shipping','entreg','llega','demora','cuánto tarda','cuando llega','tiempo de entrega'],
    answer: 'Realizamos envíos a toda Colombia. El tiempo de entrega es de 3 a 7 días hábiles dependiendo de tu ciudad. Los envíos a las principales ciudades (Bogotá, Medellín, Cali, Barranquilla) suelen llegar en 2-3 días hábiles.' },
  { keys: ['devoluci','cambio','cambiar','devolver','return','garantía','garantia'],
    answer: 'Tienes 7 días hábiles desde la entrega para solicitar una devolución. El producto debe estar sin uso, limpio y con etiquetas. No realizamos devoluciones de dinero; se genera un cupón personal por el valor del producto para usar en la tienda. Puedes solicitarlo desde tu panel de cliente en "Historial de Compras".' },
  { keys: ['pago','pagar','mercado pago','tarjeta','efectivo','contra','nequi','daviplata','método de pago','metodo de pago'],
    answer: 'Aceptamos pagos a través de Mercado Pago, que incluye tarjetas de crédito/débito, PSE, efectivo en puntos Efecty/Baloto, y más. El pago se procesa de forma segura.' },
  { keys: ['talla','size','medida','tabla de tallas','guía de tallas','guia de tallas','cómo me queda'],
    answer: 'Manejamos tallas S, M, L y XL. Te recomendamos revisar la descripción de cada producto para medidas específicas. Si tienes dudas, puedes contactarnos por WhatsApp al +57 300 000 0000.' },
  { keys: ['cuenta','perfil','datos','actualizar','contraseña','password','correo'],
    answer: 'Puedes actualizar tus datos personales desde "Mi Cuenta" en tu panel de cliente. Allí podrás cambiar tu nombre, correo, dirección, teléfono y nombre de usuario. También puedes activar la autenticación en 2 pasos para mayor seguridad.' },
  { keys: ['cupón','cupon','descuento','promoción','promocion','oferta','código','codigo'],
    answer: 'Puedes aplicar códigos de cupón o promoción en el carrito de compras antes de proceder al pago. Los cupones de devolución son personales e intransferibles y tienen vigencia de 3 meses.' },
  { keys: ['marca','monastery','clemont','undergold','fear of god'],
    answer: 'Trabajamos con las mejores marcas: Monastery, Clemont, Undergold, Fear of God y más. Todas nuestras prendas son 100% auténticas.' },
  { keys: ['contacto','contactar','whatsapp','teléfono','telefono','soporte','ayuda','email'],
    answer: 'Puedes contactarnos por: 📧 contacto@puralino.com | 📱 WhatsApp: +57 300 000 0000 | También síguenos en Instagram @puralino.' },
  { keys: ['pedido','order','seguimiento','tracking','rastreo','estado del pedido','dónde está','donde esta'],
    answer: 'Puedes ver el estado de tus pedidos en "Historial de Compras" dentro de tu panel de cliente. Cuando tu pedido sea despachado, recibirás un correo con el número de guía para rastrearlo.' },
  { keys: ['segur','2fa','dos pasos','verificación','verificacion','autenticación','autenticacion'],
    answer: 'Puedes activar la autenticación en 2 pasos desde "Mi Cuenta". Cada vez que inicies sesión, recibirás un código de 6 dígitos por correo que deberás ingresar para acceder. Esto agrega una capa extra de seguridad a tu cuenta.' },
  { keys: ['desactivar','eliminar cuenta','cerrar cuenta','borrar cuenta','dar de baja'],
    answer: 'Puedes desactivar tu cuenta desde "Mi Cuenta" en la opción "Desactivar cuenta". Tu información se conserva por temas de trazabilidad pero no podrás iniciar sesión. Si deseas reactivarla, contacta a soporte.' },
  { keys: ['hola','hey','buenos días','buenas tardes','buenas noches','saludos'],
    answer: '¡Hola! 👋 Soy el asistente virtual de Pura Lino. ¿En qué puedo ayudarte hoy? Puedes preguntarme sobre envíos, devoluciones, métodos de pago, tallas, tu cuenta y más.' },
  { keys: ['gracias','thanks','genial','perfecto','excelente'],
    answer: '¡Con gusto! Si necesitas algo más, no dudes en preguntar. 😊' }
];

function findBestResponse(message) {
  const lower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let bestMatch = null;
  let bestScore = 0;
  for (const faq of FAQ) {
    let score = 0;
    for (const key of faq.keys) {
      const normalKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (lower.includes(normalKey)) score += normalKey.length;
    }
    if (score > bestScore) { bestScore = score; bestMatch = faq; }
  }
  return bestMatch;
}

// POST /chatbot — public (no auth required for basic FAQ, auth for personalized)
router.post('/', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Mensaje vacío' });

    const lower = message.toLowerCase();
    const responses = [];

    // Check for product search intent
    const productKeywords = ['busco','quiero','tiene','hay','producto','prenda','ropa','camiseta','camisa','pantalón','pantalon','chaqueta','hoodie'];
    const isProductSearch = productKeywords.some(k => lower.includes(k));

    if (isProductSearch) {
      try {
        const products = await Product.findAll({ limit: 5, order: [['createdAt', 'DESC']] });
        if (products.length > 0) {
          const list = products.map(p => `• ${p.name} — $${new Intl.NumberFormat('es-CO').format(p.price)} (${p.stock > 0 ? 'Disponible' : 'Agotado'})`).join('\n');
          responses.push(`Aquí tienes algunos de nuestros productos recientes:\n${list}\n\nPuedes ver toda nuestra colección en la sección "Productos".`);
        }
      } catch (e) { /* ignore */ }
    }

    // Check for promotion intent
    const promoKeywords = ['promoci','oferta','descuento','rebaja','sale'];
    if (promoKeywords.some(k => lower.includes(k))) {
      try {
        const promos = await Promotion.findAll({ where: { active: true }, limit: 3 });
        if (promos.length > 0) {
          const list = promos.map(p => `• ${p.name}: ${p.discountPercent}% de descuento${p.code ? ` (código: ${p.code})` : ''}`).join('\n');
          responses.push(`🎉 Promociones activas:\n${list}`);
        } else {
          responses.push('Actualmente no hay promociones activas, pero revisa frecuentemente porque tenemos ofertas especiales.');
        }
      } catch (e) { /* ignore */ }
    }

    // FAQ matching
    const faqMatch = findBestResponse(message);
    if (faqMatch) responses.push(faqMatch.answer);

    // Default response
    if (responses.length === 0) {
      responses.push('No estoy seguro de cómo ayudarte con eso. Puedes preguntarme sobre:\n• 📦 Envíos y entregas\n• 🔄 Devoluciones y cambios\n• 💳 Métodos de pago\n• 📏 Tallas y medidas\n• 👤 Tu cuenta y seguridad\n• 🏷️ Promociones y cupones\n• 📞 Contacto y soporte\n\nO contacta a nuestro equipo por WhatsApp: +57 300 000 0000');
    }

    res.json({ reply: responses.join('\n\n') });
  } catch (err) {
    console.error('Chatbot error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;
