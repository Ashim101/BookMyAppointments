import mongoose from 'mongoose';

const auditSchema = new mongoose.Schema(
  {
    actor: {
      role: { type: String, required: true },
      id: { type: String, required: true },
      name: { type: String, default: '' },
    },
    action: { type: String, required: true },
    target: {
      type: new mongoose.Schema({ type: String, id: String }, { _id: false }),
      default: null,
    },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditSchema.index({ createdAt: -1 });
auditSchema.index({ createdAt: 1 }, { expireAfterSeconds: 400 * 86_400 });
auditSchema.index({ action: 1, createdAt: -1 });
auditSchema.index({ 'actor.role': 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditSchema);
