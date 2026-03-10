import mongoose from 'mongoose';

const GiftCardSchema = new mongoose.Schema({
  code: { type:String, unique:true, required:true },
  balance: { type:Number, required:true },
  active: { type:Boolean, default:true }
}, { timestamps:true });

export const GiftCard = mongoose.model('GiftCard', GiftCardSchema);
