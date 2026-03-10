import mongoose from 'mongoose';

const VariantSchema = new mongoose.Schema({
  size: { type:String, enum:['S','M','L','XL'], required:true },
  color: { type:String, enum:['Blanco','Negro','Beige'], required:true },
  stock: { type:Number, default:0 },
  sku: { type:String },
  priceOverride: { type:Number }
}, { _id: true });

const ProductSchema = new mongoose.Schema({
  name: { type:String, required:true },
  price: { type:Number, required:true }, // precio base (si no hay priceOverride en la variante)
  category: { type:String, enum:['ropa','hogar'], required:true },
  stock: { type:Number, default:0 }, // stock general (si no hay variantes)
  description: { type:String, default:'' },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
  supplierName: { type: String, default: '' },
  variants: { type:[VariantSchema], default: [] },
  images: [{ url: String, public_id: String }]
}, { timestamps:true });

export const Product = mongoose.model('Product', ProductSchema);
