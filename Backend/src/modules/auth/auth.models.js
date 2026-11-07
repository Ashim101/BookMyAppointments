import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: ['patient', 'doctor', 'admin'], required: true },
    family: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    ip: String,
  },
  { timestamps: true },
);
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
});
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

const passwordResetSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  role: { type: String, enum: ['patient', 'doctor'], required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
});
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
export const Otp = mongoose.model('Otp', otpSchema);
export const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);
