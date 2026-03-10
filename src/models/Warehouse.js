import mongoose from 'mongoose';

const ShelfSchema = new mongoose.Schema({
  code: { type: String, required: true },
  label: { type: String, default: '' }
}, { _id: true });

const WarehouseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, default: '' },
  shelves: { type: [ShelfSchema], default: [] },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export const Warehouse = mongoose.model('Warehouse', WarehouseSchema);
