import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Appointment } from '../../src/modules/appointments/appointment.model.js';
import { AuditLog } from '../../src/modules/audit/audit.model.js';
import { Leave } from '../../src/modules/scheduling/leave.model.js';
import { Notification } from '../../src/modules/notifications/notification.model.js';
import { BASE_NOW, startHarness } from '../helpers/harness.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe('appointments', () => {
  let h;
  let doctor;
  let patient;
  let admin;
  const as = (who) => h.bearer(who.token);

  beforeAll(async () => {
    h = await startHarness();
    admin = await h.adminSession();
  });
  afterAll(() => h.stop());

  beforeEach(async () => {
    h.clock.set(BASE_NOW);
    doctor = await h.doctorSession();
    patient = await h.patientSession();
  });

  const book = async (opts, who = patient, doc = doctor) => {
    const res = await h.book(who, doc.id, opts);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return res.body.data;
  };

  describe('booking', () => {
    it('creates an appointment with snapshots, UTC instants and notifies the doctor', async () => {
      const date = h.day(3);
      const res = await h.book(patient, doctor.id, { date, time: '10:00', reason: 'Check-up' });
      expect(res.status).toBe(201);
      const a = res.body.data;
      expect(a).toMatchObject({
        date,
        time: '10:00',
        startsAt: '2026-03-05T04:15:00.000Z',
        endsAt: '2026-03-05T04:45:00.000Z',
        timezone: 'Asia/Kathmandu',
        reason: 'Check-up',
        fee: 500,
        currency: 'INR',
        status: 'booked',
        paymentStatus: 'unpaid',
        cancellation: null,
        consultation: null,
        review: null,
        rescheduleCount: 0,
      });
      expect(a.patient).toMatchObject({ id: patient.id, name: 'Pat Ient', email: patient.email, gender: 'unspecified' });
      expect(a.doctor).toMatchObject({ id: doctor.id, name: 'Dr. Test', speciality: 'general-physician', specialityName: 'General physician' });
      expect(a.doctor.address.city).toBe('Kathmandu');
      expect(a.actions).toEqual({ canCancel: true, canReschedule: true, canPay: true, canReview: false, canComplete: false, canMarkNoShow: false });

      const note = await Notification.findOne({ userId: doctor.id, role: 'doctor' });
      expect(note).toMatchObject({ type: 'appointment_booked', read: false });
    });

    it('snapshots the fee so later fee changes do not alter existing appointments', async () => {
      const a = await book();
      await h.request.patch('/api/doctor/profile').set(as(doctor)).send({ fees: 900 }).expect(200);
      const res = await h.request.get(`/api/appointments/${a.id}`).set(as(patient));
      expect(res.body.data.fee).toBe(500);
      const next = await book({ time: '10:30' });
      expect(next.fee).toBe(900);
    });

    it('requires an authenticated patient', async () => {
      const body = { doctorId: doctor.id, date: h.day(3), time: '10:00' };
      expect((await h.request.post('/api/appointments').send(body)).status).toBe(401);
      expect((await h.request.post('/api/appointments').set(as(doctor)).send(body)).status).toBe(403);
      expect((await h.request.post('/api/appointments').set(as(admin)).send(body)).status).toBe(403);
    });

    it('validates the payload', async () => {
      const post = (body) => h.request.post('/api/appointments').set(as(patient)).send(body);
      for (const body of [
        {},
        { doctorId: 'abc', date: h.day(3), time: '10:00' },
        { doctorId: doctor.id, date: '2026-02-30', time: '10:00' },
        { doctorId: doctor.id, date: h.day(3), time: '25:00' },
        { doctorId: doctor.id, date: h.day(3), time: '10:00', reason: 'x'.repeat(501) },
      ]) {
        const res = await post(body);
        expect(res.status, JSON.stringify(body)).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        expect(res.body.error.details.length).toBeGreaterThan(0);
      }
    });

    it('returns 404 for unknown or deactivated doctors', async () => {
      const missing = await h.request.post('/api/appointments').set(as(patient)).send({ doctorId: '64b64b64b64b64b64b64b64b', date: h.day(3), time: '10:00' });
      expect(missing.status).toBe(404);
      await h.request.patch(`/api/admin/doctors/${doctor.id}/active`).set(as(admin)).send({ active: false });
      expect((await h.book(patient, doctor.id)).status).toBe(404);
    });

    it.each([
      ['a time that is not on the slot grid', { time: '10:10' }],
      ['a break', { time: '12:00' }],
      ['a time outside working hours', { time: '08:00' }],
      ['the last half hour after closing', { time: '17:00' }],
      ['a date in the past', { date: h_day(-1), time: '10:00' }],
      ['a slot less than 30 minutes away', { date: h_day(0), time: '10:00' }],
      ['a date beyond the booking window', { date: h_day(15), time: '10:00' }],
    ])('rejects %s with SLOT_UNAVAILABLE', async (_label, opts) => {
      const res = await h.book(patient, doctor.id, opts);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
    });

    it('accepts a slot 45 minutes away and the last slot of the day', async () => {
      await book({ date: h.day(0), time: '10:30' });
      await book({ date: h.day(1), time: '16:30' });
    });

    it('refuses leave days and doctors that are not accepting bookings', async () => {
      await Leave.create({ doctor: doctor.id, date: h.day(4), reason: 'Conference' });
      const leave = await h.book(patient, doctor.id, { date: h.day(4), time: '10:00' });
      expect(leave.body.error.code).toBe('SLOT_UNAVAILABLE');

      await h.request.patch(`/api/admin/doctors/${doctor.id}/availability`).set(as(admin)).send({ available: false }).expect(200);
      const off = await h.book(patient, doctor.id);
      expect(off.status).toBe(422);
      expect(off.body.error.code).toBe('SLOT_UNAVAILABLE');
    });

    it('returns SLOT_TAKEN for a booked slot and frees it again after cancellation', async () => {
      const other = await h.patientSession();
      const first = await book({ time: '11:00' });
      const taken = await h.book(other, doctor.id, { time: '11:00' });
      expect(taken.status).toBe(409);
      expect(taken.body.error.code).toBe('SLOT_TAKEN');

      await h.request.patch(`/api/appointments/${first.id}/cancel`).set(as(patient)).send({ reason: 'Change of plans' }).expect(200);
      expect((await h.book(other, doctor.id, { time: '11:00' })).status).toBe(201);
    });

    it('stops a patient from holding two appointments at the same time', async () => {
      const second = await h.doctorSession();
      await book({ time: '14:00' });
      const clash = await h.book(patient, second.id, { time: '14:00' });
      expect(clash.status).toBe(409);
      expect(clash.body.error.code).toBe('CONFLICT');
      expect((await h.book(patient, second.id, { time: '14:30' })).status).toBe(201);
    });

    it('shows booked slots as unavailable in the public slot list', async () => {
      await book({ time: '10:00' });
      const res = await h.request.get(`/api/doctors/${doctor.id}/slots`).query({ from: h.day(3), days: 1 });
      const slots = res.body.data.days[0].slots;
      expect(slots.find((s) => s.time === '10:00')).toEqual({ time: '10:00', available: false });
      expect(slots.find((s) => s.time === '10:30').available).toBe(true);
    });
  });

  describe('reading', () => {
    it('applies ownership rules to GET /appointments/:id', async () => {
      const a = await book();
      const stranger = await h.patientSession();
      const otherDoctor = await h.doctorSession();

      for (const who of [patient, doctor, admin]) {
        const res = await h.request.get(`/api/appointments/${a.id}`).set(as(who));
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(a.id);
      }
      for (const who of [stranger, otherDoctor]) {
        const res = await h.request.get(`/api/appointments/${a.id}`).set(as(who));
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('NOT_FOUND');
      }
      expect((await h.request.get(`/api/appointments/${a.id}`)).status).toBe(401);
      expect((await h.request.get('/api/appointments/not-an-id').set(as(patient))).status).toBe(400);
    });

    it('scopes lists by role and paginates', async () => {
      const second = await h.patientSession();
      await book({ time: '10:00' });
      await book({ time: '10:30' });
      await book({ time: '11:00' }, second);

      const mine = await h.request.get('/api/appointments').set(as(patient));
      expect(mine.body.data).toMatchObject({ page: 1, limit: 10, total: 2, totalPages: 1 });
      const docList = await h.request.get('/api/appointments').set(as(doctor));
      expect(docList.body.data.total).toBe(3);
      const everything = await h.request.get('/api/appointments').set(as(admin)).query({ limit: 2, doctorId: doctor.id });
      expect(everything.body.data).toMatchObject({ limit: 2, total: 3, totalPages: 2 });
      expect(everything.body.data.items).toHaveLength(2);

      const byPatient = await h.request.get('/api/appointments').set(as(doctor)).query({ patientId: second.id });
      expect(byPatient.body.data.total).toBe(1);
      const byDoctor = await h.request.get('/api/appointments').set(as(admin)).query({ doctorId: doctor.id });
      expect(byDoctor.body.data.total).toBe(3);
      // A patient cannot widen their view with filters.
      const sneaky = await h.request.get('/api/appointments').set(as(patient)).query({ patientId: second.id, doctorId: doctor.id });
      expect(sneaky.body.data.total).toBe(2);
    });

    it('filters by status and date and orders upcoming ascending, others descending', async () => {
      const late = await book({ date: h.day(5), time: '15:00' });
      const early = await book({ date: h.day(2), time: '09:00' });
      await h.request.patch(`/api/appointments/${late.id}/cancel`).set(as(patient)).send({ reason: 'no' }).expect(200);

      const upcoming = await h.request.get('/api/appointments').set(as(patient)).query({ scope: 'upcoming' });
      expect(upcoming.body.data.items.map((i) => i.id)).toEqual([early.id]);
      const past = await h.request.get('/api/appointments').set(as(patient)).query({ scope: 'past' });
      expect(past.body.data.items.map((i) => i.id)).toEqual([late.id]);

      const cancelled = await h.request.get('/api/appointments').set(as(patient)).query({ status: 'cancelled' });
      expect(cancelled.body.data.items.map((i) => i.id)).toEqual([late.id]);
      const range = await h.request.get('/api/appointments').set(as(patient)).query({ from: h.day(4), to: h.day(6) });
      expect(range.body.data.items.map((i) => i.id)).toEqual([late.id]);

      const all = await h.request.get('/api/appointments').set(as(patient));
      expect(all.body.data.items.map((i) => i.id)).toEqual([late.id, early.id]);
      const asc = await h.request.get('/api/appointments').set(as(patient)).query({ scope: 'upcoming', status: 'cancelled' });
      expect(asc.body.data.total).toBe(1);
    });

    it('rejects invalid filters', async () => {
      const res = await h.request.get('/api/appointments').set(as(patient)).query({ status: 'nope', limit: 500 });
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d) => d.path).sort()).toEqual(['limit', 'status']);
    });
  });

  describe('cancellation', () => {
    it('lets a patient cancel before the cutoff and records who and why', async () => {
      const a = await book();
      const res = await h.request.patch(`/api/appointments/${a.id}/cancel`).set(as(patient)).send({ reason: 'Feeling better' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ status: 'cancelled', cancellation: { by: 'patient', reason: 'Feeling better' } });
      expect(res.body.data.actions.canCancel).toBe(false);
      const stored = await Appointment.findById(a.id).lean();
      expect(stored.activeSlotKey).toBeUndefined();
      expect(stored.activePatientKey).toBeUndefined();
      expect(await Notification.findOne({ userId: doctor.id, type: 'appointment_cancelled' })).toBeTruthy();
      expect(await AuditLog.countDocuments({ action: 'appointment.cancel' })).toBe(0);
    });

    it('rejects patient cancellations inside the cutoff window, including the boundary', async () => {
      const a = await book();
      const start = Date.parse(a.startsAt);
      h.clock.set(start - 2 * HOUR + 1);
      const late = await h.request.patch(`/api/appointments/${a.id}/cancel`).set(as(patient)).send({ reason: 'late' });
      expect(late.status).toBe(422);
      expect(late.body.error.code).toBe('CANCELLATION_WINDOW_PASSED');

      h.clock.set(start - 2 * HOUR);
      const ok = await h.request.patch(`/api/appointments/${a.id}/cancel`).set(as(patient)).send({ reason: 'just in time' });
      expect(ok.status).toBe(200);
    });

    it('honours a cutoff changed in the admin settings', async () => {
      const a = await book();
      await h.request.put('/api/admin/settings').set(as(admin)).send({ cancellationCutoffHours: 24 }).expect(200);
      h.clock.set(Date.parse(a.startsAt) - 5 * HOUR);
      const res = await h.request.patch(`/api/appointments/${a.id}/cancel`).set(as(patient)).send({ reason: 'x' });
      expect(res.body.error.code).toBe('CANCELLATION_WINDOW_PASSED');
      await h.request.put('/api/admin/settings').set(as(admin)).send({ cancellationCutoffHours: 2 }).expect(200);
    });

    it('does not let other patients or other doctors touch the appointment', async () => {
      const a = await book();
      const stranger = await h.patientSession();
      const otherDoctor = await h.doctorSession();
      for (const who of [stranger, otherDoctor]) {
        const res = await h.request.patch(`/api/appointments/${a.id}/cancel`).set(as(who)).send({ reason: 'hijack' });
        expect(res.status).toBe(404);
      }
      expect((await Appointment.findById(a.id)).status).toBe('booked');
    });

    it('lets the doctor cancel their own appointment until it starts, and logs it', async () => {
      const a = await book();
      const res = await h.request.patch(`/api/appointments/${a.id}/cancel`).set(as(doctor)).send({ reason: 'Emergency' });
      expect(res.status).toBe(200);
      expect(res.body.data.cancellation).toMatchObject({ by: 'doctor', reason: 'Emergency' });
      expect(await Notification.findOne({ userId: patient.id, type: 'appointment_cancelled' })).toBeTruthy();
      const log = await AuditLog.findOne({ action: 'appointment.cancel' });
      expect(log).toMatchObject({ actor: { role: 'doctor', id: doctor.id }, target: { type: 'appointment', id: a.id } });
    });

    it('rejects a doctor cancelling after the start', async () => {
      const a = await book();
      h.clock.set(Date.parse(a.startsAt) + MINUTE);
      const res = await h.request.patch(`/api/appointments/${a.id}/cancel`).set(as(doctor)).send({ reason: 'late' });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_STATE');
    });

    it('lets an admin cancel anything booked, notifies both parties and audits it', async () => {
      const a = await book();
      h.clock.set(Date.parse(a.startsAt) - 10 * MINUTE);
      const res = await h.request.patch(`/api/appointments/${a.id}/cancel`).set(as(admin)).send({ reason: 'Clinic closed' });
      expect(res.status).toBe(200);
      expect(res.body.data.cancellation.by).toBe('admin');
      expect(await Notification.countDocuments({ type: 'appointment_cancelled', link: `/appointments/${a.id}` })).toBe(2);
      expect(await AuditLog.findOne({ action: 'appointment.cancel', 'actor.role': 'admin' })).toBeTruthy();
    });

    it('rejects cancelling terminal appointments with INVALID_STATE', async () => {
      const a = await book();
      await h.request.patch(`/api/appointments/${a.id}/cancel`).set(as(patient)).send({ reason: 'one' }).expect(200);
      const again = await h.request.patch(`/api/appointments/${a.id}/cancel`).set(as(patient)).send({ reason: 'two' });
      expect(again.status).toBe(422);
      expect(again.body.error.code).toBe('INVALID_STATE');
      expect((await h.request.patch(`/api/appointments/${a.id}/cancel`).set(as(admin)).send({ reason: 'three' })).body.error.code).toBe('INVALID_STATE');
    });
  });

  describe('rescheduling', () => {
    it('moves the appointment, frees the old slot and notifies the doctor', async () => {
      const a = await book({ time: '10:00' });
      const res = await h.request.patch(`/api/appointments/${a.id}/reschedule`).set(as(patient)).send({ date: h.day(4), time: '11:30' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ date: h.day(4), time: '11:30', rescheduleCount: 1, status: 'booked' });
      expect(res.body.data.startsAt).toBe('2026-03-06T05:45:00.000Z');
      expect(await Notification.findOne({ userId: doctor.id, type: 'appointment_rescheduled' })).toBeTruthy();

      const old = await h.request.get(`/api/doctors/${doctor.id}/slots`).query({ from: h.day(3), days: 1 });
      expect(old.body.data.days[0].slots.find((s) => s.time === '10:00').available).toBe(true);
    });

    it('allows two reschedules and rejects the third', async () => {
      const a = await book();
      for (const time of ['10:30', '11:00']) {
        await h.request.patch(`/api/appointments/${a.id}/reschedule`).set(as(patient)).send({ date: h.day(3), time }).expect(200);
      }
      const third = await h.request.patch(`/api/appointments/${a.id}/reschedule`).set(as(patient)).send({ date: h.day(3), time: '14:00' });
      expect(third.status).toBe(422);
      expect(third.body.error.code).toBe('INVALID_STATE');
      const view = await h.request.get(`/api/appointments/${a.id}`).set(as(patient));
      expect(view.body.data.actions.canReschedule).toBe(false);
    });

    it('returns SLOT_TAKEN for an occupied target and SLOT_UNAVAILABLE for an invalid one', async () => {
      const other = await h.patientSession();
      await book({ time: '15:00' }, other);
      const a = await book({ time: '10:00' });
      const taken = await h.request.patch(`/api/appointments/${a.id}/reschedule`).set(as(patient)).send({ date: h.day(3), time: '15:00' });
      expect(taken.status).toBe(409);
      expect(taken.body.error.code).toBe('SLOT_TAKEN');
      const invalid = await h.request.patch(`/api/appointments/${a.id}/reschedule`).set(as(patient)).send({ date: h.day(3), time: '12:30' });
      expect(invalid.body.error.code).toBe('SLOT_UNAVAILABLE');
      const same = await h.request.patch(`/api/appointments/${a.id}/reschedule`).set(as(patient)).send({ date: h.day(3), time: '10:00' });
      expect(same.body.error.code).toBe('SLOT_UNAVAILABLE');
      expect((await Appointment.findById(a.id)).rescheduleCount).toBe(0);
    });

    it('applies the cutoff, role and ownership rules', async () => {
      const a = await book();
      const stranger = await h.patientSession();
      expect((await h.request.patch(`/api/appointments/${a.id}/reschedule`).set(as(stranger)).send({ date: h.day(4), time: '10:00' })).status).toBe(404);
      expect((await h.request.patch(`/api/appointments/${a.id}/reschedule`).set(as(doctor)).send({ date: h.day(4), time: '10:00' })).status).toBe(403);
      h.clock.set(Date.parse(a.startsAt) - HOUR);
      const late = await h.request.patch(`/api/appointments/${a.id}/reschedule`).set(as(patient)).send({ date: h.day(4), time: '10:00' });
      expect(late.body.error.code).toBe('CANCELLATION_WINDOW_PASSED');
    });

    it('cannot reschedule a cancelled appointment', async () => {
      const a = await book();
      await h.request.patch(`/api/appointments/${a.id}/cancel`).set(as(patient)).send({ reason: 'x' }).expect(200);
      const res = await h.request.patch(`/api/appointments/${a.id}/reschedule`).set(as(patient)).send({ date: h.day(4), time: '10:00' });
      expect(res.body.error.code).toBe('INVALID_STATE');
    });

    it('refuses to move onto another appointment of the same patient', async () => {
      const second = await h.doctorSession();
      const a = await book({ time: '10:00' });
      await book({ time: '11:00' }, patient, second);
      const res = await h.request.patch(`/api/appointments/${a.id}/reschedule`).set(as(patient)).send({ date: h.day(3), time: '11:00' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect((await Appointment.findById(a.id)).time).toBe('10:00');
    });
  });

  describe('completion and no-show', () => {
    const prescription = [{ medicine: 'Paracetamol', dosage: '500mg', frequency: 'twice daily', durationDays: 5, instructions: 'After food' }];

    it('completes from 15 minutes before the start with notes and a prescription', async () => {
      const a = await book();
      const start = Date.parse(a.startsAt);
      const complete = (who = doctor) => h.request.patch(`/api/appointments/${a.id}/complete`).set(as(who)).send({ notes: 'All good', prescription });

      h.clock.set(start - 16 * MINUTE);
      const early = await complete();
      expect(early.status).toBe(422);
      expect(early.body.error.code).toBe('INVALID_STATE');

      h.clock.set(start - 15 * MINUTE);
      const res = await complete();
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.consultation).toMatchObject({ notes: 'All good', prescription, completedAt: new Date(start - 15 * MINUTE).toISOString() });
      expect(await Notification.findOne({ userId: patient.id, type: 'prescription_ready' })).toBeTruthy();
      expect(await AuditLog.findOne({ action: 'appointment.complete', 'actor.id': doctor.id })).toBeTruthy();

      const again = await complete();
      expect(again.body.error.code).toBe('INVALID_STATE');
      const cancel = await h.request.patch(`/api/appointments/${a.id}/cancel`).set(as(admin)).send({ reason: 'x' });
      expect(cancel.body.error.code).toBe('INVALID_STATE');
      const slot = await h.request.get(`/api/doctors/${doctor.id}/slots`).query({ from: a.date, days: 1 });
      expect(slot.body.data.days[0].slots.find((s) => s.time === a.time).available).toBe(false);
    });

    it('does not let patients, admins or other doctors complete', async () => {
      const a = await book();
      h.clock.set(Date.parse(a.startsAt));
      const otherDoctor = await h.doctorSession();
      const send = (who) => h.request.patch(`/api/appointments/${a.id}/complete`).set(as(who)).send({ notes: 'x', prescription: [] });
      expect((await send(patient)).status).toBe(403);
      expect((await send(admin)).status).toBe(403);
      const hijack = await send(otherDoctor);
      expect(hijack.status).toBe(404);
      expect((await Appointment.findById(a.id)).status).toBe('booked');
    });

    it('validates the prescription', async () => {
      const a = await book();
      h.clock.set(Date.parse(a.startsAt));
      const res = await h.request
        .patch(`/api/appointments/${a.id}/complete`)
        .set(as(doctor))
        .send({ notes: 'x', prescription: [{ medicine: '', durationDays: -1 }] });
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d) => d.path)).toContain('prescription.0.medicine');
    });

    it('marks no-shows only after the start, frees the slot and audits it', async () => {
      const a = await book();
      const start = Date.parse(a.startsAt);
      const mark = (who = doctor) => h.request.patch(`/api/appointments/${a.id}/no-show`).set(as(who));

      h.clock.set(start);
      expect((await mark()).body.error.code).toBe('INVALID_STATE');
      h.clock.set(start + MINUTE);
      expect((await mark(patient)).status).toBe(403);
      expect((await mark(await h.doctorSession())).status).toBe(404);
      const res = await mark();
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ status: 'no_show' });
      const stored = await Appointment.findById(a.id).lean();
      expect(stored.activeSlotKey).toBeUndefined();
      expect(await AuditLog.findOne({ action: 'appointment.no_show' })).toBeTruthy();
      expect((await mark()).body.error.code).toBe('INVALID_STATE');
    });

    it('reflects the state in the per requester actions flags', async () => {
      const a = await book();
      const start = Date.parse(a.startsAt);
      const flags = async (who) => (await h.request.get(`/api/appointments/${a.id}`).set(as(who))).body.data.actions;

      expect(await flags(doctor)).toMatchObject({ canCancel: true, canComplete: false, canMarkNoShow: false, canReschedule: false, canPay: false });
      expect(await flags(admin)).toEqual({ canCancel: true, canReschedule: false, canPay: false, canReview: false, canComplete: false, canMarkNoShow: false });
      h.clock.set(start - 10 * MINUTE);
      expect(await flags(doctor)).toMatchObject({ canComplete: true, canMarkNoShow: false });
      expect(await flags(patient)).toMatchObject({ canCancel: false, canReschedule: false, canPay: true });
      h.clock.set(start + MINUTE);
      expect(await flags(doctor)).toMatchObject({ canCancel: false, canComplete: true, canMarkNoShow: true });
      expect(await flags(patient)).toMatchObject({ canPay: false });
    });
  });
});

function h_day(offset) {
  const date = new Date(BASE_NOW + (5 * 60 + 45) * MINUTE);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
