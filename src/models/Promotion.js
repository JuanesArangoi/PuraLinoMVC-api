import mongoose from 'mongoose';

const PromotionSchema = new mongoose.Schema({
  code: { type:String, unique:true, required:true },
  discount: { type:Number, required:true },
  active: { type:Boolean, default:true }
}, { timestamps:true });

export const Promotion = mongoose.model('Promotion', PromotionSchema);
