import mongoose from 'mongoose';

const POItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  productName: { type: String, required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
  variantLabel: { type: String, default: '' },
  quantityOrdered: { type: Number, required: true, min: 1 },
  quantityReceived: { type: Number, default: 0 },
  unitCost: { type: Number, default: 0 },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  shelfId: { type: mongoose.Schema.Types.ObjectId, default: null },
  receivedAt: { type: Date, default: null },
  isNewProduct: { type: Boolean, default: false },
  newProductData: {
    price: { type: Number, default: 0 },
    category: { type: String, default: 'ropa' },
    description: { type: String, default: '' },
    variants: { type: Array, default: [] }
  }
}, { _id: true });

const PurchaseOrderSchema = new mongoose.Schema({
  poNumber: { type: String, unique: true, required: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  supplierName: { type: String, required: true },
  items: { type: [POItemSchema], default: [] },
  status: { type: String, enum: ['borrador', 'enviado', 'parcial', 'completo', 'cancelado'], default: 'borrador' },
  notes: { type: String, default: '' },
  expectedDate: { type: Date, default: null },
  totalCost: { type: Number, default: 0 }
}, { timestamps: true });

export const PurchaseOrder = mongoose.model('PurchaseOrder', PurchaseOrderSchema);
