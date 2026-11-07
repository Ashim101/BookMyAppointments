import mongoose from 'mongoose';
import { addressDefinition } from '../../utils/schemas.js';

const weeklyEntry = new mongoose.Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true },
    start: { type: String, required: true },
    end: { type: String, required: true },
    breaks: { type: [new mongoose.Schema({ start: String, end: String }, { _id: false })], default: [] },
  },
  { _id: false },
);

const scheduleSchema = new mongoose.Schema(
  {
    slotMinutes: { type: Number, enum: [15, 20, 30, 45, 60], default: 30 },
    weekly: { type: [weeklyEntry], default: [] },
  },
  { _id: false },
);

const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    image: { type: String, default: null },
    speciality: { type: String, required: true, index: true },
    degree: { type: String, default: '', trim: true, maxlength: 120 },
    experienceYears: { type: Number, default: 0, min: 0, max: 80 },
    about: { type: String, default: '', trim: true, maxlength: 2000 },
    fees: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    available: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    address: { type: new mongoose.Schema(addressDefinition, { _id: false }), default: () => ({}) },
    schedule: { type: scheduleSchema, default: () => ({}) },
    rating: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

doctorSchema.index({ active: 1, speciality: 1, fees: 1 });
doctorSchema.index({ active: 1, 'rating.average': -1, 'rating.count': -1 });
doctorSchema.index({ name: 1 });

export const Doctor = mongoose.model('Doctor', doctorSchema);
