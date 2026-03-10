import { Sequelize, DataTypes } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://puralino:puralino@127.0.0.1:5432/puralino';

const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  define: {
    timestamps: true,
    underscored: false,
    freezeTableName: true
  }
});

// ─── Helper: adds virtual _id so JSON responses keep the same shape as MongoDB ───
function withMongoId(attributes) {
  return {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    ...attributes
  };
}

// ─── Hook: adds _id = id to every toJSON() output ───
function addIdHook(model) {
  model.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());
    values._id = values.id;
    return values;
  };
  return model;
}

// ══════════════════════════════════════════════════════════════
// USER
// ══════════════════════════════════════════════════════════════
const User = addIdHook(sequelize.define('User', withMongoId({
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, defaultValue: 'client' },
  name: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING, unique: true },
  address: { type: DataTypes.STRING },
  phone: { type: DataTypes.STRING },
  emailVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
  emailVerificationToken: { type: DataTypes.STRING },
  emailVerificationExpires: { type: DataTypes.DATE },
  passwordResetToken: { type: DataTypes.STRING },
  passwordResetExpires: { type: DataTypes.DATE }
}), { tableName: 'users' }));

// ══════════════════════════════════════════════════════════════
// PRODUCT  (variants & images stored as JSONB arrays)
// ══════════════════════════════════════════════════════════════
const Product = addIdHook(sequelize.define('Product', withMongoId({
  name: { type: DataTypes.STRING, allowNull: false },
  price: { type: DataTypes.DOUBLE, allowNull: false },
  category: { type: DataTypes.STRING, allowNull: false },
  stock: { type: DataTypes.INTEGER, defaultValue: 0 },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  supplierId: { type: DataTypes.UUID },
  supplierName: { type: DataTypes.STRING, defaultValue: '' },
  variants: { type: DataTypes.JSONB, defaultValue: [] },
  images: { type: DataTypes.JSONB, defaultValue: [] }
}), { tableName: 'products' }));

// ══════════════════════════════════════════════════════════════
// ORDER  (items & trackingEvents stored as JSONB arrays)
// ══════════════════════════════════════════════════════════════
const Order = addIdHook(sequelize.define('Order', withMongoId({
  userId: { type: DataTypes.UUID },
  userName: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
  address: { type: DataTypes.STRING },
  address2: { type: DataTypes.STRING, defaultValue: '' },
  department: { type: DataTypes.STRING, defaultValue: '' },
  postalCode: { type: DataTypes.STRING, defaultValue: '' },
  cedula: { type: DataTypes.STRING, defaultValue: '' },
  phone: { type: DataTypes.STRING },
  paymentMethod: { type: DataTypes.STRING },
  items: { type: DataTypes.JSONB, defaultValue: [] },
  subtotal: { type: DataTypes.DOUBLE },
  discount: { type: DataTypes.DOUBLE, defaultValue: 0 },
  shippingCity: { type: DataTypes.STRING },
  shippingCost: { type: DataTypes.DOUBLE, defaultValue: 0 },
  giftCardCode: { type: DataTypes.STRING },
  giftApplied: { type: DataTypes.DOUBLE, defaultValue: 0 },
  total: { type: DataTypes.DOUBLE },
  status: { type: DataTypes.STRING, defaultValue: 'confirmado' },
  date: { type: DataTypes.DATE },
  invoiceNumber: { type: DataTypes.STRING },
  trackingNumber: { type: DataTypes.STRING },
  carrier: { type: DataTypes.STRING },
  trackingEvents: { type: DataTypes.JSONB, defaultValue: [] },
  mpPaymentId: { type: DataTypes.STRING },
  mpStatus: { type: DataTypes.STRING }
}), { tableName: 'orders' }));

// ══════════════════════════════════════════════════════════════
// PROMOTION
// ══════════════════════════════════════════════════════════════
const Promotion = addIdHook(sequelize.define('Promotion', withMongoId({
  code: { type: DataTypes.STRING, unique: true, allowNull: false },
  discount: { type: DataTypes.DOUBLE, allowNull: false },
  active: { type: DataTypes.BOOLEAN, defaultValue: true }
}), { tableName: 'promotions' }));

// ══════════════════════════════════════════════════════════════
// RETURN  (reviewPhotos stored as JSONB)
// ══════════════════════════════════════════════════════════════
const Return = addIdHook(sequelize.define('Return', withMongoId({
  returnNumber: { type: DataTypes.STRING, unique: true },
  orderId: { type: DataTypes.UUID, allowNull: false },
  orderNumber: { type: DataTypes.STRING },
  customerId: { type: DataTypes.UUID, allowNull: false },
  customerName: { type: DataTypes.STRING },
  customerEmail: { type: DataTypes.STRING },
  productId: { type: DataTypes.UUID },
  productName: { type: DataTypes.STRING },
  productPrice: { type: DataTypes.DOUBLE },
  quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
  variantId: { type: DataTypes.STRING },
  variantLabel: { type: DataTypes.STRING },
  type: { type: DataTypes.STRING, allowNull: false },
  reason: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: 'solicitada' },
  adminNotes: { type: DataTypes.TEXT },
  rejectionReason: { type: DataTypes.TEXT },
  warehouseId: { type: DataTypes.UUID },
  warehouseName: { type: DataTypes.STRING },
  warehouseAddress: { type: DataTypes.STRING },
  customerPaysShipping: { type: DataTypes.BOOLEAN, defaultValue: true },
  reviewNotes: { type: DataTypes.TEXT },
  reviewPhotos: { type: DataTypes.JSONB, defaultValue: [] },
  reviewResult: { type: DataTypes.STRING },
  reviewRejectionReason: { type: DataTypes.TEXT },
  couponCode: { type: DataTypes.STRING },
  couponValue: { type: DataTypes.DOUBLE },
  orderDate: { type: DataTypes.DATE }
}), { tableName: 'returns' }));

// ══════════════════════════════════════════════════════════════
// REVIEW
// ══════════════════════════════════════════════════════════════
const Review = addIdHook(sequelize.define('Review', withMongoId({
  userId: { type: DataTypes.UUID, allowNull: false },
  productId: { type: DataTypes.UUID, allowNull: false },
  rating: { type: DataTypes.INTEGER, allowNull: false },
  comment: { type: DataTypes.TEXT, defaultValue: '' },
  approved: { type: DataTypes.BOOLEAN, defaultValue: false }
}), { tableName: 'reviews' }));

// ══════════════════════════════════════════════════════════════
// WISHLIST  (items stored as JSONB array of product UUIDs)
// ══════════════════════════════════════════════════════════════
const Wishlist = addIdHook(sequelize.define('Wishlist', withMongoId({
  userId: { type: DataTypes.UUID, allowNull: false },
  items: { type: DataTypes.JSONB, defaultValue: [] }
}), { tableName: 'wishlists' }));

// ══════════════════════════════════════════════════════════════
// COUPON
// ══════════════════════════════════════════════════════════════
const Coupon = addIdHook(sequelize.define('Coupon', withMongoId({
  code: { type: DataTypes.STRING, unique: true, allowNull: false },
  value: { type: DataTypes.DOUBLE, allowNull: false },
  customerId: { type: DataTypes.UUID, allowNull: false },
  customerEmail: { type: DataTypes.STRING },
  returnId: { type: DataTypes.UUID },
  used: { type: DataTypes.BOOLEAN, defaultValue: false },
  usedOnOrder: { type: DataTypes.UUID },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  active: { type: DataTypes.BOOLEAN, defaultValue: true }
}), { tableName: 'coupons' }));

// ══════════════════════════════════════════════════════════════
// GIFT CARD
// ══════════════════════════════════════════════════════════════
const GiftCard = addIdHook(sequelize.define('GiftCard', withMongoId({
  code: { type: DataTypes.STRING, unique: true, allowNull: false },
  balance: { type: DataTypes.DOUBLE, allowNull: false },
  active: { type: DataTypes.BOOLEAN, defaultValue: true }
}), { tableName: 'gift_cards' }));

// ══════════════════════════════════════════════════════════════
// SUPPLIER
// ══════════════════════════════════════════════════════════════
const Supplier = addIdHook(sequelize.define('Supplier', withMongoId({
  name: { type: DataTypes.STRING, allowNull: false },
  contactPerson: { type: DataTypes.STRING, defaultValue: '' },
  email: { type: DataTypes.STRING, defaultValue: '' },
  phone: { type: DataTypes.STRING, defaultValue: '' },
  address: { type: DataTypes.STRING, defaultValue: '' },
  city: { type: DataTypes.STRING, defaultValue: '' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  active: { type: DataTypes.BOOLEAN, defaultValue: true }
}), { tableName: 'suppliers' }));

// ══════════════════════════════════════════════════════════════
// WAREHOUSE  (shelves stored as JSONB)
// ══════════════════════════════════════════════════════════════
const Warehouse = addIdHook(sequelize.define('Warehouse', withMongoId({
  name: { type: DataTypes.STRING, allowNull: false },
  location: { type: DataTypes.STRING, defaultValue: '' },
  shelves: { type: DataTypes.JSONB, defaultValue: [] },
  active: { type: DataTypes.BOOLEAN, defaultValue: true }
}), { tableName: 'warehouses' }));

// ══════════════════════════════════════════════════════════════
// PURCHASE ORDER  (items stored as JSONB)
// ══════════════════════════════════════════════════════════════
const PurchaseOrder = addIdHook(sequelize.define('PurchaseOrder', withMongoId({
  poNumber: { type: DataTypes.STRING, unique: true, allowNull: false },
  supplierId: { type: DataTypes.UUID, allowNull: false },
  supplierName: { type: DataTypes.STRING, allowNull: false },
  items: { type: DataTypes.JSONB, defaultValue: [] },
  status: { type: DataTypes.STRING, defaultValue: 'borrador' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  expectedDate: { type: DataTypes.DATE },
  totalCost: { type: DataTypes.DOUBLE, defaultValue: 0 }
}), { tableName: 'purchase_orders' }));

// ══════════════════════════════════════════════════════════════
// STOCK MOVEMENT
// ══════════════════════════════════════════════════════════════
const StockMovement = addIdHook(sequelize.define('StockMovement', withMongoId({
  productId: { type: DataTypes.UUID, allowNull: false },
  productName: { type: DataTypes.STRING, allowNull: false },
  variantId: { type: DataTypes.STRING },
  variantLabel: { type: DataTypes.STRING, defaultValue: '' },
  type: { type: DataTypes.STRING, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  reason: { type: DataTypes.TEXT, defaultValue: '' },
  referenceType: { type: DataTypes.STRING, defaultValue: 'manual' },
  referenceId: { type: DataTypes.UUID },
  warehouseId: { type: DataTypes.UUID },
  warehouseName: { type: DataTypes.STRING, defaultValue: '' },
  shelfCode: { type: DataTypes.STRING, defaultValue: '' },
  userId: { type: DataTypes.UUID },
  userName: { type: DataTypes.STRING, defaultValue: '' }
}), { tableName: 'stock_movements' }));

// ══════════════════════════════════════════════════════════════
// SETTING  (value stored as JSONB)
// ══════════════════════════════════════════════════════════════
const Setting = addIdHook(sequelize.define('Setting', withMongoId({
  key: { type: DataTypes.STRING, unique: true, allowNull: false },
  value: { type: DataTypes.JSONB, allowNull: false }
}), { tableName: 'settings' }));

// ══════════════════════════════════════════════════════════════
// ASSOCIATIONS (optional FK constraints)
// ══════════════════════════════════════════════════════════════
// We keep them light to avoid cascade issues — the JSONB approach already handles embedded data

export {
  sequelize,
  User, Product, Order, Promotion, Return, Review,
  Wishlist, Coupon, GiftCard, Supplier, Warehouse,
  PurchaseOrder, StockMovement, Setting
};
