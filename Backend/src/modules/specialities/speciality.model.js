import mongoose from 'mongoose';

const specialitySchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

export const Speciality = mongoose.model('Speciality', specialitySchema);
