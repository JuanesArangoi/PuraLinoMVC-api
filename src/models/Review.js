import mongoose from 'mongoose';

const ReviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  rating: { type: Number, min:1, max:5, required: true },
  comment: { type: String, default: '' },
  approved: { type: Boolean, default: false }
}, { timestamps: true });

ReviewSchema.index({ userId: 1, productId: 1 }, { unique: true });

export const Review = mongoose.model('Review', ReviewSchema);
