import { Appointment } from '../appointments/appointment.model.js';
import { Payment } from './payment.model.js';

/**
 * Settles refunds for cancelled paid appointments. The appointment is already
 * `refund_pending`; the refund completes immediately with the mock provider, or
 * later through the provider's `refund.processed` webhook.
 */
const RETRY_AFTER_MS = 5 * 60_000;
const MAX_RETRIES_PER_SWEEP = 25;

export function createRefundService({ provider, clock, logger }) {
  async function markRefunded(appointmentId, refundId) {
    const now = new Date(clock.now());
    const updated = await Appointment.findOneAndUpdate(
      { _id: appointmentId, paymentStatus: 'refund_pending' },
      { $set: { paymentStatus: 'refunded', 'payment.refundId': refundId, 'payment.refundedAt': now } },
      { returnDocument: 'after' },
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

  /**
   * Retries refunds whose provider call failed (no refund id was ever recorded). Each appointment
   * is claimed atomically and at most once per RETRY_AFTER_MS, so concurrent sweeps never refund twice.
   */
  async function retryPending() {
    const now = new Date(clock.now());
    const stale = new Date(now.getTime() - RETRY_AFTER_MS);
    let retried = 0;
    while (retried < MAX_RETRIES_PER_SWEEP) {
      const claimed = await Appointment.findOneAndUpdate(
        {
          paymentStatus: 'refund_pending',
          'payment.refundId': null,
          'payment.paymentId': { $ne: null },
          $or: [{ 'payment.refundAttemptAt': null }, { 'payment.refundAttemptAt': { $lte: stale } }],
        },
        { $set: { 'payment.refundAttemptAt': now } },
        { returnDocument: 'after' },
      );
      if (!claimed) break;
      await settle(claimed);
      retried += 1;
    }
    return retried;
  }

  return { settle, markRefunded, retryPending };
}
