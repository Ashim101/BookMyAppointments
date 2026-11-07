import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const reviewSchema = new mongoose.Schema(
  {
    appointment: { type: ObjectId, ref: 'Appointment', required: true, unique: true },
    doctor: { type: ObjectId, ref: 'Doctor', required: true },
    patient: { type: ObjectId, ref: 'Patient', required: true },
    patientName: { type: String, required: true },
    patientImage: { type: String, default: null },
    doctorName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

reviewSchema.index({ doctor: 1, createdAt: -1 });
reviewSchema.index({ rating: 1, createdAt: -1 });

export const Review = mongoose.model('Review', reviewSchema);
