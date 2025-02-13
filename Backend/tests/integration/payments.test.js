import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Appointment } from '../../src/modules/appointments/appointment.model.js';
import { Notification } from '../../src/modules/notifications/notification.model.js';
import { Payment } from '../../src/modules/payments/payment.model.js';
import { createRazorpayProvider } from '../../src/modules/payments/providers.js';
import { BASE_NOW, startHarness } from '../helpers/harness.js';

const hmac = (secret, value) => createHmac('sha256', secret).update(value).digest('hex');

describe('payments in mock mode', () => {
  let h;
  let doctor;
  let patient;
  const as = (who) => h.bearer(who.token);

  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => h.stop());
  beforeEach(async () => {
    h.clock.set(BASE_NOW);
    doctor = await h.doctorSession();
    patient = await h.patientSession();
  });

  const bookAndOrder = async (time = '10:00') => {
    const appointment = (await h.book(patient, doctor.id, { time })).body.data;
    const order = await h.request.post('/api/payments/order').set(as(patient)).send({ appointmentId: appointment.id });
    return { appointment, order };
  };
  const verify = (appointment, order, extra = {}) =>
    h.request
      .post('/api/payments/verify')
      .set(as(patient))
      .send({ appointmentId: appointment.id, orderId: order.body.data.orderId, paymentId: 'mock_pay_1', signature: 'mock', ...extra });

  it('creates a mock order for the appointment fee', async () => {
    const { order } = await bookAndOrder();
    expect(order.status).toBe(200);
    expect(order.body.data).toMatchObject({ mode: 'mock', amount: 500, currency: 'INR', keyId: null });
    expect(order.body.data.orderId).toMatch(/^mock_order_/);
  });

  it('marks the appointment paid on verification and notifies the patient', async () => {
    const { appointment, order } = await bookAndOrder();
    const res = await verify(appointment, order);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: appointment.id, paymentStatus: 'paid', status: 'booked' });
    expect(res.body.data.actions.canPay).toBe(false);
    expect(await Payment.findOne({ orderId: order.body.data.orderId })).toMatchObject({ status: 'paid', paymentId: 'mock_pay_1' });
    expect(await Notification.findOne({ userId: patient.id, type: 'payment_received' })).toBeTruthy();
  });

  it('rejects invalid mock credentials and does not consume the order', async () => {
    const { appointment, order } = await bookAndOrder();
    for (const extra of [{ signature: 'wrong' }, { paymentId: 'pay_real_looking' }]) {
      const res = await verify(appointment, order, extra);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('PAYMENT_INVALID');
    }
    expect((await Appointment.findById(appointment.id)).paymentStatus).toBe('unpaid');
    expect((await verify(appointment, order)).status).toBe(200);
  });

  it('rejects unknown orders, replayed orders and orders of other appointments', async () => {
    const { appointment, order } = await bookAndOrder('10:00');
    const other = await bookAndOrder('10:30');
    expect((await verify(appointment, order, { orderId: 'mock_order_nope' })).body.error.code).toBe('PAYMENT_INVALID');
    expect((await verify(appointment, other.order)).body.error.code).toBe('PAYMENT_INVALID');

    await verify(appointment, order).then((r) => expect(r.status).toBe(200));
    const replay = await verify(appointment, order);
    expect(replay.status).toBe(422);
    expect(replay.body.error.code).toBe('INVALID_STATE');
  });

  it('only lets the owning patient order and verify, and only for payable appointments', async () => {
    const { appointment, order } = await bookAndOrder();
    const stranger = await h.patientSession();
    expect((await h.request.post('/api/payments/order').set(as(stranger)).send({ appointmentId: appointment.id })).status).toBe(404);
    expect((await h.request.post('/api/payments/order').set(as(doctor)).send({ appointmentId: appointment.id })).status).toBe(403);
    expect((await h.request.post('/api/payments/order').send({ appointmentId: appointment.id })).status).toBe(401);
    const hijack = await h.request
      .post('/api/payments/verify')
      .set(as(stranger))
      .send({ appointmentId: appointment.id, orderId: order.body.data.orderId, paymentId: 'mock_x', signature: 'mock' });
    expect(hijack.status).toBe(404);

    await h.request.patch(`/api/appointments/${appointment.id}/cancel`).set(as(patient)).send({ reason: 'x' }).expect(200);
    const cancelled = await h.request.post('/api/payments/order').set(as(patient)).send({ appointmentId: appointment.id });
    expect(cancelled.status).toBe(422);
    expect(cancelled.body.error.code).toBe('INVALID_STATE');
    expect((await h.request.post('/api/payments/order').set(as(patient)).send({ appointmentId: 'bad' })).status).toBe(400);
  });

  it('refuses to order for an appointment that is already paid', async () => {
    const { appointment, order } = await bookAndOrder();
    await verify(appointment, order).then((r) => expect(r.status).toBe(200));
    const again = await h.request.post('/api/payments/order').set(as(patient)).send({ appointmentId: appointment.id });
    expect(again.body.error.code).toBe('INVALID_STATE');
  });

  it('refunds immediately in mock mode when a paid appointment is cancelled', async () => {
    const { appointment, order } = await bookAndOrder();
    await verify(appointment, order);
    const res = await h.request.patch(`/api/appointments/${appointment.id}/cancel`).set(as(doctor)).send({ reason: 'Emergency' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'cancelled', paymentStatus: 'refunded' });
    const stored = await Appointment.findById(appointment.id).lean();
    expect(stored.payment.refundId).toMatch(/^mock_refund_/);
    expect(await Payment.findOne({ orderId: order.body.data.orderId })).toMatchObject({ status: 'refunded' });
  });

  it('leaves unpaid appointments unpaid when cancelled', async () => {
    const { appointment } = await bookAndOrder();
    const res = await h.request.patch(`/api/appointments/${appointment.id}/cancel`).set(as(patient)).send({ reason: 'x' });
    expect(res.body.data.paymentStatus).toBe('unpaid');
  });

  it('answers webhooks with 401 because no webhook secret exists in mock mode', async () => {
    const res = await h.request.post('/api/payments/webhook').set('Content-Type', 'application/json').send('{}');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('payments with Razorpay', () => {
  const keySecret = 'rzp_secret_value';
  const webhookSecret = 'whsec_value';
  let h;
  let doctor;
  let patient;
  let refundStatus;
  const refunds = [];
  const as = (who) => h.bearer(who.token);

  const client = {
    orders: { create: async (payload) => ({ id: `order_${payload.receipt.slice(-8)}`, ...payload }) },
    payments: {
      refund: async (paymentId, payload) => {
        refunds.push({ paymentId, ...payload });
        return { id: `rfnd_${refunds.length}`, status: refundStatus };
      },
    },
  };

  beforeAll(async () => {
    const provider = createRazorpayProvider({ keyId: 'rzp_test_key', keySecret, webhookSecret, client });
    h = await startHarness({
      env: { PAYMENTS_MODE: 'razorpay', RAZORPAY_KEY_ID: 'rzp_test_key', RAZORPAY_KEY_SECRET: keySecret, RAZORPAY_WEBHOOK_SECRET: webhookSecret },
      overrides: { payments: provider },
    });
  });
  afterAll(() => h.stop());
  beforeEach(async () => {
    h.clock.set(BASE_NOW);
    refundStatus = 'processed';
    refunds.length = 0;
    doctor = await h.doctorSession();
    patient = await h.patientSession();
  });

  const bookAndOrder = async (time = '10:00') => {
    const appointment = (await h.book(patient, doctor.id, { time })).body.data;
    const order = (await h.request.post('/api/payments/order').set(as(patient)).send({ appointmentId: appointment.id })).body.data;
    return { appointment, order };
  };
  const pay = async (appointment, order, paymentId = 'pay_123') =>
    h.request
      .post('/api/payments/verify')
      .set(as(patient))
      .send({ appointmentId: appointment.id, orderId: order.orderId, paymentId, signature: hmac(keySecret, `${order.orderId}|${paymentId}`) });
  const webhook = (event, { secret = webhookSecret, raw } = {}) => {
    const body = raw ?? JSON.stringify(event);
    return h.request.post('/api/payments/webhook').set('Content-Type', 'application/json').set('X-Razorpay-Signature', hmac(secret, body)).send(body);
  };
  const captured = (order, paymentId = 'pay_123') => ({
    event: 'payment.captured',
    payload: { payment: { entity: { id: paymentId, order_id: order.orderId } } },
  });

  it('creates orders through the SDK and exposes the public key id', async () => {
    const { order } = await bookAndOrder();
    expect(order).toMatchObject({ mode: 'razorpay', amount: 500, currency: 'INR', keyId: 'rzp_test_key' });
    expect(order.orderId).toMatch(/^order_/);
  });

  it('verifies the HMAC signature and rejects forged or mock signatures', async () => {
    const { appointment, order } = await bookAndOrder();
    const send = (body) => h.request.post('/api/payments/verify').set(as(patient)).send({ appointmentId: appointment.id, orderId: order.orderId, ...body });
    const forged = await send({ paymentId: 'pay_123', signature: hmac('other-secret', `${order.orderId}|pay_123`) });
    expect(forged.status).toBe(422);
    expect(forged.body.error.code).toBe('PAYMENT_INVALID');
    expect((await send({ paymentId: 'mock_abc', signature: 'mock' })).body.error.code).toBe('PAYMENT_INVALID');
    expect((await send({ paymentId: 'pay_999', signature: hmac(keySecret, `${order.orderId}|pay_123`) })).body.error.code).toBe('PAYMENT_INVALID');

    const ok = await pay(appointment, order);
    expect(ok.status).toBe(200);
    expect(ok.body.data.paymentStatus).toBe('paid');
  });

  it('marks refund_pending when the provider has not finished the refund yet', async () => {
    refundStatus = 'pending';
    const { appointment, order } = await bookAndOrder();
    await pay(appointment, order, 'pay_pending');
    const res = await h.request.patch(`/api/appointments/${appointment.id}/cancel`).set(as(patient)).send({ reason: 'x' });
    expect(res.body.data.paymentStatus).toBe('refund_pending');
    expect(refunds).toEqual([{ paymentId: 'pay_pending', amount: 50_000 }]);

    const processed = await webhook({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_done', payment_id: 'pay_pending' } } } });
    expect(processed.body).toEqual({ success: true, data: { received: true } });
    expect(await Appointment.findById(appointment.id)).toMatchObject({ paymentStatus: 'refunded' });
    const again = await webhook({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_done', payment_id: 'pay_pending' } } } });
    expect(again.status).toBe(200);
    expect((await Appointment.findById(appointment.id)).payment.refundId).toBe('rfnd_done');
  });

  it('completes the refund immediately when the provider reports it processed', async () => {
    const { appointment, order } = await bookAndOrder();
    await pay(appointment, order);
    const res = await h.request.patch(`/api/appointments/${appointment.id}/cancel`).set(as(doctor)).send({ reason: 'x' });
    expect(res.body.data.paymentStatus).toBe('refunded');
  });

  it('keeps refund_pending when the provider call fails', async () => {
    const { appointment, order } = await bookAndOrder();
    await pay(appointment, order, 'pay_boom');
    const original = client.payments.refund;
    client.payments.refund = async () => {
      throw new Error('gateway down');
    };
    const res = await h.request.patch(`/api/appointments/${appointment.id}/cancel`).set(as(patient)).send({ reason: 'x' });
    client.payments.refund = original;
    expect(res.status).toBe(200);
    expect(res.body.data.paymentStatus).toBe('refund_pending');
  });

  it('processes payment.captured webhooks idempotently', async () => {
    const { appointment, order } = await bookAndOrder();
    const first = await webhook(captured(order));
    expect(first.status).toBe(200);
    expect((await Appointment.findById(appointment.id)).paymentStatus).toBe('paid');
    await webhook(captured(order));
    await webhook(captured(order));
    expect(await Notification.countDocuments({ userId: patient.id, type: 'payment_received' })).toBe(1);
    expect(await Payment.countDocuments({ orderId: order.orderId, status: 'paid' })).toBe(1);

    // A verify call arriving after the webhook cannot pay twice.
    const late = await pay(appointment, order);
    expect(late.status).toBe(422);
  });

  it('refunds money captured for an appointment that was cancelled in the meantime', async () => {
    const { appointment, order } = await bookAndOrder();
    await h.request.patch(`/api/appointments/${appointment.id}/cancel`).set(as(patient)).send({ reason: 'x' }).expect(200);
    await webhook(captured(order, 'pay_orphan'));
    const stored = await Appointment.findById(appointment.id);
    expect(stored.paymentStatus).toBe('refunded');
    expect(refunds[0]).toMatchObject({ paymentId: 'pay_orphan' });
  });

  it('records failed payments and ignores unknown events', async () => {
    const { order } = await bookAndOrder();
    await webhook({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_f', order_id: order.orderId } } } }).then((r) => expect(r.status).toBe(200));
    expect(await Payment.findOne({ orderId: order.orderId })).toMatchObject({ status: 'failed' });
    expect((await webhook({ event: 'order.paid', payload: {} })).status).toBe(200);
  });

  it('rejects webhooks with a missing, wrong or body-mismatched signature', async () => {
    const { order } = await bookAndOrder();
    const body = JSON.stringify(captured(order));
    const missing = await h.request.post('/api/payments/webhook').set('Content-Type', 'application/json').send(body);
    expect(missing.status).toBe(401);
    expect((await webhook(captured(order), { secret: 'wrong' })).status).toBe(401);
    const tampered = await h.request
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', hmac(webhookSecret, body))
      .send(body.replace('pay_123', 'pay_666'));
    expect(tampered.status).toBe(401);
    expect(await Payment.countDocuments({ orderId: order.orderId, status: 'paid' })).toBe(0);
  });

  it('rejects a correctly signed body that is not JSON', async () => {
    const res = await webhook(null, { raw: 'not json at all' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});
