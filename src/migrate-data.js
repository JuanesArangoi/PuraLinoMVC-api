/**
 * Script de migración: MongoDB (pura-lino-2) → PostgreSQL
 * 
 * Lee todos los documentos de cada colección en MongoDB y los inserta
 * en las tablas PostgreSQL correspondientes, preservando los _id originales.
 * 
 * Uso: node src/migrate-data.js
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import {
  sequelize, User, Product, Order, Promotion, Return, Review,
  Wishlist, Coupon, GiftCard, Supplier, Warehouse,
  PurchaseOrder, StockMovement, Setting
} from './models/index.js';

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('❌ MONGODB_URI no definida en .env');
  process.exit(1);
}

// ── Helper: convert MongoDB doc to plain object with id = _id.toString() ──
function toPlain(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  const plain = { ...obj };
  if (plain._id) {
    plain.id = plain._id.toString();
    delete plain._id;
  }
  delete plain.__v;
  // Convert nested ObjectIds to strings
  for (const [key, val] of Object.entries(plain)) {
    if (val && typeof val === 'object' && val._bsontype === 'ObjectId') {
      plain[key] = val.toString();
    }
  }
  return plain;
}

// ── Helper: safely convert a value that might be ObjectId ──
function oid(val) {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (val._bsontype === 'ObjectId') return val.toString();
  if (val.toString) return val.toString();
  return null;
}

// ── Helper: convert items/variants arrays, turning sub-doc _id to string ──
function convertSubDocs(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => {
    const obj = item.toObject ? item.toObject() : { ...item };
    if (obj._id) {
      obj._id = obj._id.toString ? obj._id.toString() : String(obj._id);
    }
    // Convert any nested ObjectId fields
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === 'object' && v._bsontype === 'ObjectId') {
        obj[k] = v.toString();
      }
    }
    delete obj.__v;
    return obj;
  });
}

async function migrate() {
  console.log('🔌 Conectando a MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ MongoDB conectado');

  console.log('🔌 Conectando a PostgreSQL...');
  await sequelize.authenticate();
  // Recreate tables (drop + create) for clean migration
  await sequelize.sync({ force: true });
  console.log('✅ PostgreSQL conectado y tablas recreadas');

  const db = mongoose.connection.db;

  // ── 1. USERS ──
  console.log('\n📦 Migrando users...');
  const users = await db.collection('users').find({}).toArray();
  let count = 0;
  for (const u of users) {
    try {
      await User.create({
        id: u._id.toString(),
        username: u.username,
        passwordHash: u.passwordHash,
        role: u.role || 'client',
        name: u.name || null,
        email: u.email || null,
        address: u.address || null,
        phone: u.phone || null,
        emailVerified: u.emailVerified || false,
        emailVerificationToken: u.emailVerificationToken || null,
        emailVerificationExpires: u.emailVerificationExpires || null,
        passwordResetToken: u.passwordResetToken || null,
        passwordResetExpires: u.passwordResetExpires || null,
        createdAt: u.createdAt || new Date(),
        updatedAt: u.updatedAt || new Date()
      });
      count++;
    } catch (err) {
      console.error(`  ⚠️ User ${u.username}: ${err.message}`);
    }
  }
  console.log(`  ✅ ${count}/${users.length} users migrados`);

  // ── 2. SUPPLIERS ──
  console.log('\n📦 Migrando suppliers...');
  const suppliers = await db.collection('suppliers').find({}).toArray();
  count = 0;
  for (const s of suppliers) {
    try {
      await Supplier.create({
        id: s._id.toString(),
        name: s.name,
        contactPerson: s.contactPerson || '',
        email: s.email || '',
        phone: s.phone || '',
        address: s.address || '',
        city: s.city || '',
        notes: s.notes || '',
        active: s.active !== false,
        createdAt: s.createdAt || new Date(),
        updatedAt: s.updatedAt || new Date()
      });
      count++;
    } catch (err) {
      console.error(`  ⚠️ Supplier ${s.name}: ${err.message}`);
    }
  }
  console.log(`  ✅ ${count}/${suppliers.length} suppliers migrados`);

  // ── 3. PRODUCTS ──
  console.log('\n📦 Migrando products...');
  const products = await db.collection('products').find({}).toArray();
  count = 0;
  for (const p of products) {
    try {
      await Product.create({
        id: p._id.toString(),
        name: p.name,
        price: p.price,
        category: p.category,
        stock: p.stock || 0,
        description: p.description || '',
        supplierId: oid(p.supplierId),
        supplierName: p.supplierName || '',
        variants: convertSubDocs(p.variants || []),
        images: convertSubDocs(p.images || []),
        createdAt: p.createdAt || new Date(),
        updatedAt: p.updatedAt || new Date()
      });
      count++;
    } catch (err) {
      console.error(`  ⚠️ Product ${p.name}: ${err.message}`);
    }
  }
  console.log(`  ✅ ${count}/${products.length} products migrados`);

  // ── 4. ORDERS ──
  console.log('\n📦 Migrando orders...');
  const orders = await db.collection('orders').find({}).toArray();
  count = 0;
  for (const o of orders) {
    try {
      await Order.create({
        id: o._id.toString(),
        userId: oid(o.userId),
        userName: o.userName || null,
        email: o.email || null,
        address: o.address || null,
        address2: o.address2 || '',
        department: o.department || '',
        postalCode: o.postalCode || '',
        cedula: o.cedula || '',
        phone: o.phone || null,
        paymentMethod: o.paymentMethod || null,
        items: convertSubDocs(o.items || []),
        subtotal: o.subtotal || 0,
        discount: o.discount || 0,
        shippingCity: o.shippingCity || null,
        shippingCost: o.shippingCost || 0,
        giftCardCode: o.giftCardCode || null,
        giftApplied: o.giftApplied || 0,
        total: o.total || 0,
        status: o.status || 'confirmado',
        date: o.date || o.createdAt || new Date(),
        invoiceNumber: o.invoiceNumber || null,
        trackingNumber: o.trackingNumber || null,
        carrier: o.carrier || null,
        trackingEvents: convertSubDocs(o.trackingEvents || []),
        mpPaymentId: o.mpPaymentId ? String(o.mpPaymentId) : null,
        mpStatus: o.mpStatus || null,
        createdAt: o.createdAt || new Date(),
        updatedAt: o.updatedAt || new Date()
      });
      count++;
    } catch (err) {
      console.error(`  ⚠️ Order ${o._id}: ${err.message}`);
    }
  }
  console.log(`  ✅ ${count}/${orders.length} orders migrados`);

  // ── 5. PROMOTIONS ──
  console.log('\n📦 Migrando promotions...');
  const promotions = await db.collection('promotions').find({}).toArray();
  count = 0;
  for (const p of promotions) {
    try {
      await Promotion.create({
        id: p._id.toString(),
        code: p.code,
        discount: p.discount,
        active: p.active !== false,
        createdAt: p.createdAt || new Date(),
        updatedAt: p.updatedAt || new Date()
      });
      count++;
    } catch (err) {
      console.error(`  ⚠️ Promotion ${p.code}: ${err.message}`);
    }
  }
  console.log(`  ✅ ${count}/${promotions.length} promotions migrados`);

  // ── 6. GIFT CARDS ──
  console.log('\n📦 Migrando giftcards...');
  const giftcards = await db.collection('giftcards').find({}).toArray();
  count = 0;
  for (const g of giftcards) {
    try {
      await GiftCard.create({
        id: g._id.toString(),
        code: g.code,
        balance: g.balance,
        active: g.active !== false,
        createdAt: g.createdAt || new Date(),
        updatedAt: g.updatedAt || new Date()
      });
      count++;
    } catch (err) {
      console.error(`  ⚠️ GiftCard ${g.code}: ${err.message}`);
    }
  }
  console.log(`  ✅ ${count}/${giftcards.length} giftcards migrados`);

  // ── 7. REVIEWS ──
  console.log('\n📦 Migrando reviews...');
  const reviews = await db.collection('reviews').find({}).toArray();
  count = 0;
  for (const r of reviews) {
    try {
      await Review.create({
        id: r._id.toString(),
        userId: oid(r.userId),
        productId: oid(r.productId),
        rating: r.rating,
        comment: r.comment || '',
        approved: r.approved || false,
        createdAt: r.createdAt || new Date(),
        updatedAt: r.updatedAt || new Date()
      });
      count++;
    } catch (err) {
      console.error(`  ⚠️ Review ${r._id}: ${err.message}`);
    }
  }
  console.log(`  ✅ ${count}/${reviews.length} reviews migrados`);

  // ── 8. WISHLISTS ──
  console.log('\n📦 Migrando wishlists...');
  const wishlists = await db.collection('wishlists').find({}).toArray();
  count = 0;
  for (const w of wishlists) {
    try {
      const items = (w.items || []).map(i => i.toString ? i.toString() : String(i));
      await Wishlist.create({
        id: w._id.toString(),
        userId: oid(w.userId),
        items,
        createdAt: w.createdAt || new Date(),
        updatedAt: w.updatedAt || new Date()
      });
      count++;
    } catch (err) {
      console.error(`  ⚠️ Wishlist ${w._id}: ${err.message}`);
    }
  }
  console.log(`  ✅ ${count}/${wishlists.length} wishlists migrados`);

  // ── 9. RETURNS ──
  console.log('\n📦 Migrando returns...');
  const returns = await db.collection('returns').find({}).toArray();
  count = 0;
  for (const r of returns) {
    try {
      await Return.create({
        id: r._id.toString(),
        returnNumber: r.returnNumber,
        orderId: oid(r.orderId),
        orderNumber: r.orderNumber || null,
        customerId: oid(r.customerId),
        customerName: r.customerName || null,
        customerEmail: r.customerEmail || null,
        productId: oid(r.productId),
        productName: r.productName || null,
        productPrice: r.productPrice || null,
        quantity: r.quantity || 1,
        variantId: r.variantId ? String(r.variantId) : null,
        variantLabel: r.variantLabel || null,
        type: r.type,
        reason: r.reason,
        status: r.status || 'solicitada',
        adminNotes: r.adminNotes || null,
        rejectionReason: r.rejectionReason || null,
        warehouseId: oid(r.warehouseId),
        warehouseName: r.warehouseName || null,
        warehouseAddress: r.warehouseAddress || null,
        customerPaysShipping: r.customerPaysShipping !== false,
        reviewNotes: r.reviewNotes || null,
        reviewPhotos: r.reviewPhotos || [],
        reviewResult: r.reviewResult || null,
        reviewRejectionReason: r.reviewRejectionReason || null,
        couponCode: r.couponCode || null,
        couponValue: r.couponValue || null,
        orderDate: r.orderDate || null,
        createdAt: r.createdAt || new Date(),
        updatedAt: r.updatedAt || new Date()
      });
      count++;
    } catch (err) {
      console.error(`  ⚠️ Return ${r._id}: ${err.message}`);
    }
  }
  console.log(`  ✅ ${count}/${returns.length} returns migrados`);

  // ── 10. COUPONS ──
  console.log('\n📦 Migrando coupons...');
  const coupons = await db.collection('coupons').find({}).toArray();
  count = 0;
  for (const c of coupons) {
    try {
      await Coupon.create({
        id: c._id.toString(),
        code: c.code,
        value: c.value,
        customerId: oid(c.customerId),
        customerEmail: c.customerEmail || null,
        returnId: oid(c.returnId),
        used: c.used || false,
        usedOnOrder: oid(c.usedOnOrder),
        expiresAt: c.expiresAt,
        active: c.active !== false,
        createdAt: c.createdAt || new Date(),
        updatedAt: c.updatedAt || new Date()
      });
      count++;
    } catch (err) {
      console.error(`  ⚠️ Coupon ${c.code}: ${err.message}`);
    }
  }
  console.log(`  ✅ ${count}/${coupons.length} coupons migrados`);

  // ── 11. WAREHOUSES ──
  console.log('\n📦 Migrando warehouses...');
  const warehouses = await db.collection('warehouses').find({}).toArray();
  count = 0;
  for (const w of warehouses) {
    try {
      await Warehouse.create({
        id: w._id.toString(),
        name: w.name,
        location: w.location || '',
        shelves: convertSubDocs(w.shelves || []),
        active: w.active !== false,
        createdAt: w.createdAt || new Date(),
        updatedAt: w.updatedAt || new Date()
      });
      count++;
    } catch (err) {
      console.error(`  ⚠️ Warehouse ${w.name}: ${err.message}`);
    }
  }
  console.log(`  ✅ ${count}/${warehouses.length} warehouses migrados`);

  // ── 12. PURCHASE ORDERS ──
  console.log('\n📦 Migrando purchaseorders...');
  const pos = await db.collection('purchaseorders').find({}).toArray();
  count = 0;
  for (const p of pos) {
    try {
      await PurchaseOrder.create({
        id: p._id.toString(),
        poNumber: p.poNumber,
        supplierId: oid(p.supplierId),
        supplierName: p.supplierName,
        items: convertSubDocs(p.items || []),
        status: p.status || 'borrador',
        notes: p.notes || '',
        expectedDate: p.expectedDate || null,
        totalCost: p.totalCost || 0,
        createdAt: p.createdAt || new Date(),
        updatedAt: p.updatedAt || new Date()
      });
      count++;
    } catch (err) {
      console.error(`  ⚠️ PO ${p.poNumber}: ${err.message}`);
    }
  }
  console.log(`  ✅ ${count}/${pos.length} purchase orders migrados`);

  // ── 13. STOCK MOVEMENTS ──
  console.log('\n📦 Migrando stockmovements...');
  const movements = await db.collection('stockmovements').find({}).toArray();
  count = 0;
  for (const m of movements) {
    try {
      await StockMovement.create({
        id: m._id.toString(),
        productId: oid(m.productId),
        productName: m.productName,
        variantId: m.variantId ? String(m.variantId) : null,
        variantLabel: m.variantLabel || '',
        type: m.type,
        quantity: m.quantity,
        reason: m.reason || '',
        referenceType: m.referenceType || 'manual',
        referenceId: oid(m.referenceId),
        warehouseId: oid(m.warehouseId),
        warehouseName: m.warehouseName || '',
        shelfCode: m.shelfCode || '',
        userId: oid(m.userId),
        userName: m.userName || '',
        createdAt: m.createdAt || new Date(),
        updatedAt: m.updatedAt || new Date()
      });
      count++;
    } catch (err) {
      console.error(`  ⚠️ Movement ${m._id}: ${err.message}`);
    }
  }
  console.log(`  ✅ ${count}/${movements.length} stock movements migrados`);

  // ── 14. SETTINGS ──
  console.log('\n📦 Migrando settings...');
  const settings = await db.collection('settings').find({}).toArray();
  count = 0;
  for (const s of settings) {
    try {
      await Setting.create({
        id: s._id.toString(),
        key: s.key,
        value: s.value || {},
        createdAt: s.createdAt || new Date(),
        updatedAt: s.updatedAt || new Date()
      });
      count++;
    } catch (err) {
      console.error(`  ⚠️ Setting ${s.key}: ${err.message}`);
    }
  }
  console.log(`  ✅ ${count}/${settings.length} settings migrados`);

  // ── Done ──
  console.log('\n══════════════════════════════════════');
  console.log('✅ MIGRACIÓN COMPLETADA');
  console.log('══════════════════════════════════════');

  await mongoose.disconnect();
  await sequelize.close();
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Error fatal en migración:', err);
  process.exit(1);
});
