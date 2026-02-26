import mongoose from 'mongoose';

const OrderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: String,
  productPrice: Number,
  quantity: Number,
  category: String,
  variant: {
    id: String,
    size: String,
    color: String
  }
}, { _id: false });

const TrackingEventSchema = new mongoose.Schema({
  status: String,
  date: { type: Date, default: Date.now },
  note: String
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  email: String,
  address: String,
  address2: String,
  department: String,
  postalCode: String,
  cedula: String,
  phone: String,
  paymentMethod: { type: String, enum: ['credit','debit','paypal','pse','cod','mercadopago'] },
  items: [OrderItemSchema],
  subtotal: Number,
  discount: Number,
  shippingCity: String,
  shippingCost: { type: Number, default: 0 },
  giftCardCode: String,
  giftApplied: { type: Number, default: 0 },
  total: Number,
  status: { type: String, enum:['pendiente_pago','confirmado','enviado','entregado'], default:'confirmado' },
  date: Date,
  invoiceNumber: String
  ,trackingNumber: String
  ,carrier: String
  ,trackingEvents: { type: [TrackingEventSchema], default: [] }
  ,mpPaymentId: String
  ,mpStatus: String
}, { timestamps:true });

export const Order = mongoose.model('Order', OrderSchema);
