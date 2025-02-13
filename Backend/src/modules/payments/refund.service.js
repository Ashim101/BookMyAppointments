import { Appointment } from '../appointments/appointment.model.js';
import { Payment } from './payment.model.js';

/**
 * Settles refunds for cancelled paid appointments. The appointment is already
 * `refund_pending`; the refund completes immediately with the mock provider, or
 * later through the provider's `refund.processed` webhook.
 */
export function createRefundService({ provider, clock, logger }) {
  async function markRefunded(appointmentId, refundId) {
    const now = new Date(clock.now());
    const updated = await Appointment.findOneAndUpdate(
      { _id: appointmentId, paymentStatus: 'refund_pending' },
      { $set: { paymentStatus: 'refunded', 'payment.refundId': refundId, 'payment.refundedAt': now } },
      { new: true },
    );
    if (updated) await Payment.updateOne({ appointment: appointmentId, status: 'paid' }, { $set: { status: 'refunded' } });
    return updated;
  }

  async function settle(appointment) {
    try {
      const result = await provider.refund({
        paymentId: appointment.payment.paymentId,
        amount: appointment.fee,
        currency: appointment.currency,
      });
      if (result.status === 'completed') return (await markRefunded(appointment._id, result.refundId)) ?? appointment;
      await Appointment.updateOne({ _id: appointment._id }, { $set: { 'payment.refundId': result.refundId } });
    } catch (err) {
      logger.error({ err, appointmentId: String(appointment._id) }, 'refund request failed; left as refund_pending');
    }
    return appointment;
  }

  return { settle, markRefunded };
}
