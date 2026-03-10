import mongoose from 'mongoose';

const SupplierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  contactPerson: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  city: { type: String, default: '' },
  notes: { type: String, default: '' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export const Supplier = mongoose.model('Supplier', SupplierSchema);
