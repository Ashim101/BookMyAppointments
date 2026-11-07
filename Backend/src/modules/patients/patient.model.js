import mongoose from 'mongoose';
import { addressDefinition } from '../../utils/schemas.js';

const patientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    googleId: { type: String, unique: true, sparse: true },
    image: { type: String, default: null },
    phone: { type: String, default: '', trim: true, maxlength: 30 },
    gender: { type: String, enum: ['male', 'female', 'other', 'unspecified'], default: 'unspecified' },
    dob: { type: String, default: null },
    address: { type: new mongoose.Schema(addressDefinition, { _id: false }), default: () => ({}) },
    blocked: { type: Boolean, default: false },
  },
  { timestamps: true },
);

patientSchema.index({ name: 1 });
patientSchema.index({ blocked: 1, createdAt: -1 });

export const Patient = mongoose.model('Patient', patientSchema);
