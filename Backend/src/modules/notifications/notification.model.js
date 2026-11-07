import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    role: { type: String, enum: ['patient', 'doctor'], required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String, default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, role: 1, read: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 120 * 86_400 });

export const Notification = mongoose.model('Notification', notificationSchema);
