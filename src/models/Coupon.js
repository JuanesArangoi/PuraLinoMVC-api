import mongoose from 'mongoose';

const CouponSchema = new mongoose.Schema({
  code: { type: String, unique: true, required: true },
  value: { type: Number, required: true },
  // Personal coupon — only this customer can use it
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerEmail: String,
  returnId: { type: mongoose.Schema.Types.ObjectId, ref: 'Return' },
  used: { type: Boolean, default: false },
  usedOnOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  expiresAt: { type: Date, required: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export const Coupon = mongoose.model('Coupon', CouponSchema);
