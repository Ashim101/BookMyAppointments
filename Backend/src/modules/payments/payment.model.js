import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },
    provider: { type: String, enum: ['mock', 'razorpay'], required: true },
    orderId: { type: String, required: true, unique: true },
    paymentId: { type: String, default: null },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: { type: String, enum: ['created', 'paid', 'failed', 'refunded'], default: 'created' },
  },
  { timestamps: true },
);

export const Payment = mongoose.model('Payment', paymentSchema);
