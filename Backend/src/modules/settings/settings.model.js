import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    cancellationCutoffHours: Number,
    bookingWindowDays: Number,
    defaultSlotMinutes: Number,
    currency: String,
  },
  { timestamps: true },
);

export const SettingsDoc = mongoose.model('Settings', settingsSchema);
