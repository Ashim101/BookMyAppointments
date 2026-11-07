import { createHmac } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AuditLog } from '../../src/modules/audit/audit.model.js';
import { Appointment } from '../../src/modules/appointments/appointment.model.js';
import { IdempotencyKey } from '../../src/middlewares/idempotency.js';
import { createRazorpayProvider } from '../../src/modules/payments/providers.js';
import { ADMIN, BASE_NOW, PASSWORD, startHarness } from '../helpers/harness.js';

const MINUTE = 60_000;

describe('login lockout', () => {
  let h;
  beforeAll(async () => {
    h = await startHarness({ env: { LOGIN_MAX_FAILURES: '3', LOGIN_LOCKOUT_MINUTES: '10' } });
  });
  afterAll(() => h.stop());
  beforeEach(() => h.clock.set(BASE_NOW));

  const login = (email, password, role = 'patient') =>
    h.request.post('/api/auth/login').send({ email, password, role });

  it('locks an account after repeated failures, even for the right password, then releases it', async () => {
    const patient = await h.patientSession('lock@example.com');
    for (let i = 0; i < 3; i += 1)
      expect((await login(patient.email, 'Wrong-pass1')).body.error.code).toBe('INVALID_CREDENTIALS');

    const locked = await login(patient.email, PASSWORD);
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('RATE_LIMITED');
    expect(locked.body.error.message).toMatch(/10 minute/);

    expect(Number(locked.headers['retry-after'])).toBe(600);
    h.clock.advance(9 * MINUTE);
    const stillLocked = await login(patient.email, PASSWORD);
    expect(stillLocked.status).toBe(429);
    expect(Number(stillLocked.headers['retry-after'])).toBe(60);
    h.clock.advance(2 * MINUTE);
    expect((await login(patient.email, PASSWORD)).status).toBe(200);
  });

  it('counts failures per account and role, and a success clears the counter', async () => {
    const patient = await h.patientSession('count@example.com');
    await login(patient.email, 'Wrong-pass1');
    await login(patient.email, 'Wrong-pass1');
    expect((await login(patient.email, PASSWORD)).status).toBe(200);
    await login(patient.email, 'Wrong-pass1');
    await login(patient.email, 'Wrong-pass1');
    expect((await login(patient.email, PASSWORD)).status).toBe(200);

    for (let i = 0; i < 3; i += 1) await login(patient.email, 'Wrong-pass1', 'doctor');
    expect((await login(patient.email, 'Wrong-pass1', 'doctor')).status).toBe(429);
    expect((await login(patient.email, PASSWORD)).status).toBe(200);
  });

  it('protects the admin login and never reveals whether an email exists', async () => {
    for (let i = 0; i < 3; i += 1) await login(ADMIN.email, 'nope-nope-1', 'admin');
    expect((await login(ADMIN.email, ADMIN.password, 'admin')).status).toBe(429);
    expect(await AuditLog.countDocuments({ action: 'admin.login_failed' })).toBe(3);
    for (let i = 0; i < 3; i += 1) await login('ghost@example.com', PASSWORD);
    const ghost = await login('ghost@example.com', PASSWORD);
    expect(ghost.status).toBe(429);
    expect(ghost.body.error.message).not.toMatch(/exist/i);
  });
});

describe('idempotent booking', () => {
  let h;
  let doctor;
  let patient;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => h.stop());
  beforeEach(async () => {
    h.clock.set(BASE_NOW);
    doctor = await h.doctor();
    patient = await h.patientSession();
  });

  const post = (key, body) =>
    h.request
      .post('/api/appointments')
      .set(h.bearer(patient.token))
      .set(key ? { 'Idempotency-Key': key } : {})
      .send({ doctorId: doctor.id, date: h.day(3), time: '10:00', ...body });

  it('replays the stored response instead of booking twice', async () => {
    const first = await post('key-12345678', {});
    expect(first.status).toBe(201);
    const replay = await post('key-12345678', {});
    expect(replay.status).toBe(201);
    expect(replay.headers['idempotent-replay']).toBe('true');
    expect(replay.body).toEqual(first.body);
    expect(await Appointment.countDocuments({ patient: patient.id })).toBe(1);
  });

  it('rejects the same key with a different request', async () => {
    await post('key-abcdefgh', {}).then((r) => expect(r.status).toBe(201));
    const other = await post('key-abcdefgh', { time: '11:00' });
    expect(other.status).toBe(400);
    expect(other.body.error.code).toBe('BAD_REQUEST');
  });

  it('does not keep failed attempts, so the client can retry with the same key', async () => {
    const failed = await post('key-retry-001', { time: '10:10' });
    expect(failed.status).toBe(422);
    expect(await IdempotencyKey.countDocuments({ key: 'key-retry-001' })).toBe(0);
    const retried = await post('key-retry-001', { time: '10:30' });
    expect(retried.status).toBe(201);
  });

  it('lets concurrent duplicates through only once', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => post('key-parallel-1', {})));
    expect(results.filter((r) => r.status === 201 && !r.headers['idempotent-replay'])).toHaveLength(1);
    for (const other of results.filter((r) => r.headers['idempotent-replay'] || r.status !== 201)) {
      expect([201, 409]).toContain(other.status);
    }
    expect(await Appointment.countDocuments({ patient: patient.id })).toBe(1);
  });

  it('scopes keys to the patient and validates the header', async () => {
    await post('key-shared-001', {}).then((r) => expect(r.status).toBe(201));
    const other = await h.patientSession();
    const res = await h.request
      .post('/api/appointments')
      .set(h.bearer(other.token))
      .set('Idempotency-Key', 'key-shared-001')
      .send({ doctorId: doctor.id, date: h.day(3), time: '10:00' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_TAKEN');
    const bad = await post('short', {});
    expect(bad.status).toBe(400);
    expect(bad.body.error.details[0].path).toBe('Idempotency-Key');
    expect((await post(undefined, { time: '14:00' })).status).toBe(201);
  });
});

describe('refund retries', () => {
  const keySecret = 'retry_secret';
  let h;
  let failing;
  const refunds = [];

  beforeAll(async () => {
    const client = {
      orders: { create: async () => ({ id: `order_${Math.random().toString(16).slice(2, 10)}` }) },
      payments: {
        refund: async (paymentId) => {
          if (failing) throw new Error('gateway down');
          refunds.push(paymentId);
          return { id: `rfnd_${refunds.length}`, status: 'processed' };
        },
      },
    };
    h = await startHarness({
      env: {
        PAYMENTS_MODE: 'razorpay',
        RAZORPAY_KEY_ID: 'rzp_test',
        RAZORPAY_KEY_SECRET: keySecret,
        RAZORPAY_WEBHOOK_SECRET: 'wh',
      },
      overrides: {
        payments: createRazorpayProvider({ keyId: 'rzp_test', keySecret, webhookSecret: 'wh', client }),
      },
    });
  });
  afterAll(() => h.stop());

  it('retries failed refunds once the cool-down passed, and never twice', async () => {
    h.clock.set(BASE_NOW);
    failing = true;
    const doctor = await h.doctorSession();
    const patient = await h.patientSession();
    const booked = (await h.book(patient, doctor.id)).body.data;
    const order = (
      await h.request
        .post('/api/payments/order')
        .set(h.bearer(patient.token))
        .send({ appointmentId: booked.id })
    ).body.data;
    const signature = createHmac('sha256', keySecret).update(`${order.orderId}|pay_retry`).digest('hex');
    await h.request
      .post('/api/payments/verify')
      .set(h.bearer(patient.token))
      .send({ appointmentId: booked.id, orderId: order.orderId, paymentId: 'pay_retry', signature })
      .expect(200);
    const cancel = await h.request
      .patch(`/api/appointments/${booked.id}/cancel`)
      .set(h.bearer(patient.token))
      .send({ reason: 'x' });
    expect(cancel.body.data.paymentStatus).toBe('refund_pending');

    failing = false;
    const { refunds: service } = h.container;

    expect(await service.retryPending()).toBe(0); // still inside the cool-down window
    h.clock.advance(6 * MINUTE);
    expect(await service.retryPending()).toBe(1);
    expect(await Appointment.findById(booked.id)).toMatchObject({ paymentStatus: 'refunded' });
    expect(await service.retryPending()).toBe(0);
    expect(refunds).toEqual(['pay_retry']);
  });
});

describe('side effects of booking and replaced images', () => {
  let h;
  const PNG = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(32),
  ]);
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => h.stop());

  it('emails the patient on booking and when someone else cancels', async () => {
    h.clock.set(BASE_NOW);
    const doctor = await h.doctorSession();
    const patient = await h.patientSession();
    const booked = (await h.book(patient, doctor.id)).body.data;
    const confirmation = h.container.mailer.outbox.findLast((m) =>
      m.subject.startsWith('Appointment confirmed'),
    );
    expect(confirmation).toMatchObject({ to: patient.email });
    expect(confirmation.text).toContain(booked.date);

    await h.request
      .patch(`/api/appointments/${booked.id}/cancel`)
      .set(h.bearer(patient.token))
      .send({ reason: 'mine' })
      .expect(200);
    expect(
      h.container.mailer.outbox.filter((m) => m.subject.startsWith('Appointment cancelled')),
    ).toHaveLength(0);

    const again = (await h.book(patient, doctor.id, { time: '11:00' })).body.data;
    await h.request
      .patch(`/api/appointments/${again.id}/cancel`)
      .set(h.bearer(doctor.token))
      .send({ reason: 'Emergency surgery' })
      .expect(200);
    const cancellation = h.container.mailer.outbox.findLast((m) =>
      m.subject.startsWith('Appointment cancelled'),
    );
    expect(cancellation.to).toBe(patient.email);
    expect(cancellation.text).toContain('Emergency surgery');
  });

  it('does not fail a booking when the email transport is down', async () => {
    const doctor = await h.doctor();
    const patient = await h.patientSession();
    const original = h.container.mailer.send;
    h.container.mailer.send = async () => {
      throw new Error('smtp down');
    };
    const res = await h.book(patient, doctor.id);
    h.container.mailer.send = original;
    expect(res.status).toBe(201);
  });

  it('deletes the previous image file when a profile picture is replaced', async () => {
    const patient = await h.patientSession();
    const upload = () =>
      h.request
        .patch('/api/patient/profile')
        .set(h.bearer(patient.token))
        .attach('image', PNG, { filename: 'a.png', contentType: 'image/png' });
    const first = (await upload()).body.data.image;
    const file = (url) => path.join(h.container.storage.uploadDir, path.basename(url));
    expect(existsSync(file(first))).toBe(true);
    const second = (await upload()).body.data.image;
    expect(second).not.toBe(first);
    expect(existsSync(file(first))).toBe(false);
    expect(existsSync(file(second))).toBe(true);
  });
});
