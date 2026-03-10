import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin','client'], default: 'client' },
  name: String,
  email: { type: String, unique: true, sparse: true },
  address: String,
  phone: String,
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date
}, { timestamps: true });

export const User = mongoose.model('User', UserSchema);
