import { AppError, badRequest, unauthorized } from '../../utils/AppError.js';
import { Appointment } from '../appointments/appointment.model.js';
import { assertAllowed } from '../appointments/stateMachine.js';
import { Payment } from './payment.model.js';

export function createPaymentService({ provider, appointments, notifications, refunds, clock }) {
  const invalid = (message) => new AppError('PAYMENT_INVALID', message);

  async function createOrder(user, appointmentId) {
    const appointment = await appointments.findFor(user, appointmentId);
    assertAllowed('pay', await appointments.context(user, appointment));

    const { orderId } = await provider.createOrder({
      amount: appointment.fee,
      currency: appointment.currency,
      receipt: String(appointment._id),
    });
    await Payment.create({
      appointment: appointment._id,
      provider: provider.mode,
      orderId,
      amount: appointment.fee,
      currency: appointment.currency,
    });
    return {
      mode: provider.mode,
      orderId,
      amount: appointment.fee,
      currency: appointment.currency,
      keyId: provider.keyId,
    };
  }

  const markPaid = (appointmentId, orderId, paymentId) =>
    Appointment.findOneAndUpdate(
      { _id: appointmentId, status: 'booked', paymentStatus: 'unpaid' },
      {
        $set: {
          paymentStatus: 'paid',
          'payment.orderId': orderId,
          'payment.paymentId': paymentId,
          'payment.paidAt': new Date(clock.now()),
        },
      },
      { returnDocument: 'after' },
    );

  const notifyPaid = (appointment) =>
    notifications.notify(
      { id: appointment.patient, role: 'patient' },
      {
        type: 'payment_received',
        title: 'Payment received',
        message: `Your payment of ${appointment.fee} ${appointment.currency} for ${appointment.date} at ${appointment.time} was received.`,
        link: `/appointments/${appointment._id}`,
      },
    );

  async function verify(user, { appointmentId, orderId, paymentId, signature }) {
    const appointment = await appointments.findFor(user, appointmentId);
    assertAllowed('pay', await appointments.context(user, appointment));

    const order = await Payment.findOne({ orderId, appointment: appointment._id, status: 'created' });
    if (!order) throw invalid('Unknown or already used payment order');
    if (!provider.verifyPayment({ orderId, paymentId, signature }))
      throw invalid('Payment signature could not be verified');

    const claimed = await Payment.findOneAndUpdate(
      { _id: order._id, status: 'created' },
      { $set: { status: 'paid', paymentId } },
    );
    if (!claimed) throw invalid('This payment order was already used');
    const paid = await markPaid(appointment._id, orderId, paymentId);
    if (!paid) throw new AppError('INVALID_STATE', 'The appointment can no longer be paid');

    await notifyPaid(paid);
    return appointments.serialize(paid, user);
  }

  /** `payment.captured`: idempotent because only a `created` payment can be claimed. */
  async function onCaptured(orderId, paymentId) {
    const payment = await Payment.findOneAndUpdate(
      { orderId, status: 'created' },
      { $set: { status: 'paid', paymentId } },
    );
    if (!payment) return;
    const paid = await markPaid(payment.appointment, orderId, paymentId);
    if (paid) return void (await notifyPaid(paid));

    // Money arrived for an appointment that was cancelled in the meantime: refund it.
    const orphan = await Appointment.findOneAndUpdate(
      { _id: payment.appointment, status: { $in: ['cancelled', 'no_show'] }, paymentStatus: 'unpaid' },
      {
        $set: { paymentStatus: 'refund_pending', 'payment.orderId': orderId, 'payment.paymentId': paymentId },
      },
      { returnDocument: 'after' },
    );
    if (orphan) await refunds.settle(orphan);
  }

  async function onRefunded(paymentId, refundId) {
    const appointment = await Appointment.findOne({ 'payment.paymentId': paymentId });
    if (appointment) await refunds.markRefunded(appointment._id, refundId);
  }

  async function handleWebhook(rawBody, signature) {
    if (!provider.verifyWebhook(rawBody, signature)) throw unauthorized('Invalid webhook signature');
    let event;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw badRequest('Webhook body is not valid JSON');
    }
    const entity = (kind) => event.payload?.[kind]?.entity ?? {};

    if (event.event === 'payment.captured')
      await onCaptured(entity('payment').order_id, entity('payment').id);
    else if (event.event === 'payment.failed')
      await Payment.updateOne(
        { orderId: entity('payment').order_id, status: 'created' },
        { $set: { status: 'failed' } },
      );
    else if (event.event === 'refund.processed')
      await onRefunded(entity('refund').payment_id, entity('refund').id);
    return { received: true };
  }

  return { createOrder, verify, handleWebhook };
}
