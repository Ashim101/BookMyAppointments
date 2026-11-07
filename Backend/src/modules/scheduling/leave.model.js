import mongoose from 'mongoose';

const leaveSchema = new mongoose.Schema(
  {
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    date: { type: String, required: true },
    reason: { type: String, default: '', trim: true, maxlength: 200 },
  },
  { timestamps: true },
);

leaveSchema.index({ doctor: 1, date: 1 }, { unique: true });

export const Leave = mongoose.model('Leave', leaveSchema);
