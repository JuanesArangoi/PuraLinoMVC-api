import mongoose from 'mongoose';

const ReviewPhotoSchema = new mongoose.Schema({
  url: String,
  public_id: String
}, { _id: false });

const ReturnSchema = new mongoose.Schema({
  returnNumber: { type: String, unique: true },

  // Order & customer
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  orderNumber: String,
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerName: String,
  customerEmail: String,

  // Product being returned
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: String,
  productPrice: Number,
  quantity: { type: Number, default: 1 },
  variantId: String,
  variantLabel: String,

  // Return reason
  type: { type: String, enum: ['garantia', 'cambio_talla', 'cambio_color', 'defecto', 'otro'], required: true },
  reason: { type: String, required: true },

  // Status workflow: solicitada → aprobada/rechazada → enviada_cliente → recibida → revisada → completada/rechazada_revision
  status: {
    type: String,
    enum: ['solicitada', 'aprobada', 'rechazada', 'enviada_cliente', 'recibida', 'revisada_apta', 'revisada_no_apta', 'completada'],
    default: 'solicitada'
  },

  // Admin decision on request
  adminNotes: String,
  rejectionReason: String,

  // Warehouse info (where customer must send the product back)
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
  warehouseName: String,
  warehouseAddress: String,

  // Whether customer must pay shipping (true if NOT warranty)
  customerPaysShipping: { type: Boolean, default: true },

  // Review after receiving
  reviewNotes: String,
  reviewPhotos: [ReviewPhotoSchema],
  reviewResult: { type: String, enum: ['apta', 'no_apta'] },
  reviewRejectionReason: String,

  // Coupon generated
  couponCode: String,
  couponValue: Number,

  // Purchase date (to validate 30-day window)
  orderDate: Date

}, { timestamps: true });

export const Return = mongoose.model('Return', ReturnSchema);
