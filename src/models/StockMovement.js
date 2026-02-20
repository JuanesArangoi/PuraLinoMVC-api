import mongoose from 'mongoose';

const StockMovementSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
  variantLabel: { type: String, default: '' },
  type: { type: String, enum: ['entrada', 'salida', 'ajuste'], required: true },
  quantity: { type: Number, required: true },
  reason: { type: String, default: '' },
  referenceType: { type: String, enum: ['purchase_order', 'customer_order', 'manual', 'return'], default: 'manual' },
  referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  warehouseName: { type: String, default: '' },
  shelfCode: { type: String, default: '' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String, default: '' }
}, { timestamps: true });

export const StockMovement = mongoose.model('StockMovement', StockMovementSchema);
