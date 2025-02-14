import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Appointment } from '../../src/modules/appointments/appointment.model.js';
import { AuditLog } from '../../src/modules/audit/audit.model.js';
import { Leave } from '../../src/modules/scheduling/leave.model.js';
import { Notification } from '../../src/modules/notifications/notification.model.js';
import { BASE_NOW, startHarness } from '../helpers/harness.js';

describe('doctor self-service', () => {
  let h;
  let doctor;
  const as = (who) => h.bearer(who.token);

  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => h.stop());
  beforeEach(async () => {
    h.clock.set(BASE_NOW);
    doctor = await h.doctorSession();
  });

  describe('profile', () => {
    it('returns the admin shaped profile for the signed in doctor only', async () => {
      const res = await h.request.get('/api/doctor/profile').set(as(doctor));
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        id: doctor.id,
        email: doctor.email,
        active: true,
        specialityName: 'General physician',
        schedule: { slotMinutes: 30 },
      });
      expect(res.body.data.schedule.weekly).toHaveLength(7);
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);

      const patient = await h.patientSession();
      expect((await h.request.get('/api/doctor/profile').set(as(patient))).status).toBe(403);
      expect((await h.request.get('/api/doctor/profile')).status).toBe(401);
    });

    it('updates about, fees, address and availability, and ignores protected fields', async () => {
      const res = await h.request
        .patch('/api/doctor/profile')
        .set(as(doctor))
        .send({
          about: 'New bio',
          fees: 750,
          address: { line1: '9 Oak', city: 'Pokhara' },
          available: false,
          email: 'evil@example.com',
          active: false,
        });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        about: 'New bio',
        fees: 750,
        available: false,
        email: doctor.email,
        active: true,
      });
      expect(res.body.data.address).toEqual({ line1: '9 Oak', line2: '', city: 'Pokhara' });
      expect(await AuditLog.findOne({ action: 'doctor.profile.update', 'actor.id': doctor.id })).toBeTruthy();
    });

    it('validates profile changes', async () => {
      for (const body of [
        { fees: -5 },
        { about: 'x'.repeat(2001) },
        { available: 'no' },
        { address: 'Kathmandu' },
      ]) {
        const res = await h.request.patch('/api/doctor/profile').set(as(doctor)).send(body);
        expect(res.status, JSON.stringify(body)).toBe(400);
      }
    });
  });

  describe('schedule', () => {
    const valid = {
      slotMinutes: 20,
      weekly: [
        { day: 1, start: '08:00', end: '12:00', breaks: [{ start: '10:00', end: '10:20' }] },
        { day: 3, start: '14:00', end: '18:00', breaks: [] },
      ],
    };

    it('stores a valid schedule and drives slot generation', async () => {
      const put = await h.request.put('/api/doctor/schedule').set(as(doctor)).send(valid);
      expect(put.status).toBe(200);
      expect(put.body.data).toEqual(valid);
      expect((await h.request.get('/api/doctor/schedule').set(as(doctor))).body.data).toEqual(valid);

      const slots = await h.request.get(`/api/doctors/${doctor.id}/slots`).query({ from: h.day(7), days: 1 });
      const times = slots.body.data.days[0].slots.map((s) => s.time);
      expect(slots.body.data.slotMinutes).toBe(20);
      expect(times[0]).toBe('08:00');
      expect(times).not.toContain('10:00');
      expect(times).toContain('10:20');
      expect(times.at(-1)).toBe('11:40');
    });

    it('sorts days and keeps existing appointments', async () => {
      const patient = await h.patientSession();
      const booked = (await h.book(patient, doctor.id, { time: '10:00' })).body.data;
      await h.request
        .put('/api/doctor/schedule')
        .set(as(doctor))
        .send({
          slotMinutes: 60,
          weekly: [
            { day: 5, start: '09:00', end: '10:00', breaks: [] },
            { day: 2, start: '09:00', end: '10:00', breaks: [] },
          ],
        })
        .expect(200);
      const schedule = (await h.request.get('/api/doctor/schedule').set(as(doctor))).body.data;
      expect(schedule.weekly.map((d) => d.day)).toEqual([2, 5]);
      const view = await h.request.get(`/api/appointments/${booked.id}`).set(as(patient));
      expect(view.body.data).toMatchObject({ status: 'booked', time: '10:00' });
    });

    it.each([
      [
        'an invalid HH:mm',
        { slotMinutes: 30, weekly: [{ day: 1, start: '9:00', end: '17:00', breaks: [] }] },
        'weekly.0.start',
      ],
      [
        'hours past 23:59',
        { slotMinutes: 30, weekly: [{ day: 1, start: '09:00', end: '24:00', breaks: [] }] },
        'weekly.0.end',
      ],
      [
        'start not before end',
        { slotMinutes: 30, weekly: [{ day: 1, start: '17:00', end: '09:00', breaks: [] }] },
        'weekly.0.end',
      ],
      [
        'equal start and end',
        { slotMinutes: 30, weekly: [{ day: 1, start: '09:00', end: '09:00', breaks: [] }] },
        'weekly.0.end',
      ],
      [
        'a break outside working hours',
        {
          slotMinutes: 30,
          weekly: [{ day: 1, start: '09:00', end: '12:00', breaks: [{ start: '11:30', end: '12:30' }] }],
        },
        'weekly.0.breaks.0',
      ],
      [
        'an inverted break',
        {
          slotMinutes: 30,
          weekly: [{ day: 1, start: '09:00', end: '12:00', breaks: [{ start: '11:00', end: '10:00' }] }],
        },
        'weekly.0.breaks.0',
      ],
      [
        'overlapping breaks',
        {
          slotMinutes: 30,
          weekly: [
            {
              day: 1,
              start: '09:00',
              end: '17:00',
              breaks: [
                { start: '10:00', end: '11:00' },
                { start: '10:30', end: '11:30' },
              ],
            },
          ],
        },
        'weekly.0.breaks.1',
      ],
      [
        'duplicate days',
        {
          slotMinutes: 30,
          weekly: [
            { day: 1, start: '09:00', end: '10:00', breaks: [] },
            { day: 1, start: '11:00', end: '12:00', breaks: [] },
          ],
        },
        'weekly.1.day',
      ],
      ['an unsupported slot length', { slotMinutes: 25, weekly: [] }, 'slotMinutes'],
      [
        'a day out of range',
        { slotMinutes: 30, weekly: [{ day: 7, start: '09:00', end: '10:00', breaks: [] }] },
        'weekly.0.day',
      ],
    ])('rejects %s', async (_label, body, path) => {
      const res = await h.request.put('/api/doctor/schedule').set(as(doctor)).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.map((d) => d.path)).toContain(path);
    });

    it('accepts adjacent breaks and an empty weekly list', async () => {
      const adjacent = {
        slotMinutes: 30,
        weekly: [
          {
            day: 1,
            start: '09:00',
            end: '17:00',
            breaks: [
              { start: '10:00', end: '11:00' },
              { start: '11:00', end: '12:00' },
            ],
          },
        ],
      };
      await h.request.put('/api/doctor/schedule').set(as(doctor)).send(adjacent).expect(200);
      await h.request
        .put('/api/doctor/schedule')
        .set(as(doctor))
        .send({ slotMinutes: 30, weekly: [] })
        .expect(200);
    });
  });

  describe('leave days', () => {
    it('adds, lists (today onward, ascending) and removes leave days', async () => {
      await Leave.create({ doctor: doctor.id, date: h.day(-3), reason: 'Past' });
      const later = await h.request
        .post('/api/doctor/leaves')
        .set(as(doctor))
        .send({ date: h.day(9), reason: 'Holiday' });
      expect(later.status).toBe(201);
      expect(later.body.data).toEqual({ id: expect.any(String), date: h.day(9), reason: 'Holiday' });
      await h.request
        .post('/api/doctor/leaves')
        .set(as(doctor))
        .send({ date: h.day(0), reason: 'Today' })
        .expect(201);

      const list = await h.request.get('/api/doctor/leaves').set(as(doctor));
      expect(list.body.data.map((l) => l.date)).toEqual([h.day(0), h.day(9)]);

      const del = await h.request.delete(`/api/doctor/leaves/${later.body.data.id}`).set(as(doctor));
      expect(del.body).toEqual({ success: true, data: null });
      expect((await h.request.get('/api/doctor/leaves').set(as(doctor))).body.data).toHaveLength(1);
      expect(await AuditLog.findOne({ action: 'doctor.leave.delete' })).toBeTruthy();
    });

    it('rejects past dates, duplicates and removing someone else leave', async () => {
      const past = await h.request
        .post('/api/doctor/leaves')
        .set(as(doctor))
        .send({ date: h.day(-1), reason: 'x' });
      expect(past.status).toBe(400);
      await h.request
        .post('/api/doctor/leaves')
        .set(as(doctor))
        .send({ date: h.day(5), reason: 'x' })
        .expect(201);
      const dup = await h.request
        .post('/api/doctor/leaves')
        .set(as(doctor))
        .send({ date: h.day(5), reason: 'y' });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('CONFLICT');

      const leave = await Leave.findOne({ doctor: doctor.id, date: h.day(5) });
      const other = await h.doctorSession();
      expect((await h.request.delete(`/api/doctor/leaves/${leave.id}`).set(as(other))).status).toBe(404);
      expect(
        (await h.request.post('/api/doctor/leaves').set(as(doctor)).send({ date: '2026-02-30' })).status,
      ).toBe(400);
    });

    it('hides leave days from the slot list and blocks booking on them', async () => {
      const patient = await h.patientSession();
      await h.request
        .post('/api/doctor/leaves')
        .set(as(doctor))
        .send({ date: h.day(2), reason: 'Away' })
        .expect(201);
      const slots = await h.request.get(`/api/doctors/${doctor.id}/slots`).query({ from: h.day(2), days: 1 });
      expect(slots.body.data.days[0].slots).toEqual([]);
      expect((await h.book(patient, doctor.id, { date: h.day(2) })).body.error.code).toBe('SLOT_UNAVAILABLE');
    });

    it('returns 409 when appointments exist unless cancelAppointments is sent', async () => {
      const [a, b] = await Promise.all([h.patientSession(), h.patientSession()]);
      const first = (await h.book(a, doctor.id, { date: h.day(4), time: '10:00' })).body.data;
      const second = (await h.book(b, doctor.id, { date: h.day(4), time: '11:00' })).body.data;
      const keep = (await h.book(a, doctor.id, { date: h.day(5), time: '10:00' })).body.data;

      const blocked = await h.request
        .post('/api/doctor/leaves')
        .set(as(doctor))
        .send({ date: h.day(4), reason: 'Conference' });
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.code).toBe('CONFLICT');
      expect(await Leave.countDocuments({ doctor: doctor.id })).toBe(0);

      const res = await h.request
        .post('/api/doctor/leaves')
        .set(as(doctor))
        .send({ date: h.day(4), reason: 'Conference', cancelAppointments: true });
      expect(res.status).toBe(201);
      for (const id of [first.id, second.id]) {
        const stored = await Appointment.findById(id);
        expect(stored.status).toBe('cancelled');
        expect(stored.cancellation).toMatchObject({ by: 'doctor', reason: 'Conference' });
        expect(stored.activeSlotKey).toBeUndefined();
      }
      expect((await Appointment.findById(keep.id)).status).toBe('booked');
      expect(await Notification.countDocuments({ type: 'appointment_cancelled', role: 'patient' })).toBe(2);
    });

    it('refunds paid appointments cancelled by leave', async () => {
      const patient = await h.patientSession();
      const booked = (await h.book(patient, doctor.id, { date: h.day(4), time: '10:00' })).body.data;
      const order = await h.request
        .post('/api/payments/order')
        .set(as(patient))
        .send({ appointmentId: booked.id });
      await h.request
        .post('/api/payments/verify')
        .set(as(patient))
        .send({
          appointmentId: booked.id,
          orderId: order.body.data.orderId,
          paymentId: 'mock_1',
          signature: 'mock',
        })
        .expect(200);
      await h.request
        .post('/api/doctor/leaves')
        .set(as(doctor))
        .send({ date: h.day(4), reason: 'Sick', cancelAppointments: true })
        .expect(201);
      expect(await Appointment.findById(booked.id)).toMatchObject({
        status: 'cancelled',
        paymentStatus: 'refunded',
      });
    });
  });

  describe('dashboard and patient history', () => {
    it('summarises appointments, earnings, patients and a zero filled 6 month series', async () => {
      const [p1, p2] = await Promise.all([h.patientSession(), h.patientSession()]);
      const pay = async (patient, id) => {
        const order = await h.request
          .post('/api/payments/order')
          .set(as(patient))
          .send({ appointmentId: id });
        await h.request
          .post('/api/payments/verify')
          .set(as(patient))
          .send({
            appointmentId: id,
            orderId: order.body.data.orderId,
            paymentId: 'mock_p',
            signature: 'mock',
          })
          .expect(200);
      };
      const inThreeDays = h.day(3);
      const done = await h.book(p1, doctor.id, { date: h.day(1), time: '10:00' });
      await pay(p1, done.body.data.id);
      const cancelledPaid = await h.book(p2, doctor.id, { date: h.day(2), time: '10:00' });
      await pay(p2, cancelledPaid.body.data.id);
      await h.request
        .patch(`/api/appointments/${cancelledPaid.body.data.id}/cancel`)
        .set(as(doctor))
        .send({ reason: 'x' })
        .expect(200);
      await h.book(p1, doctor.id, { date: h.day(3), time: '10:00' });
      await h.book(p2, doctor.id, { date: h.day(0), time: '16:00' });

      h.clock.set(Date.parse(done.body.data.startsAt));
      await h.request
        .patch(`/api/appointments/${done.body.data.id}/complete`)
        .set(as(doctor))
        .send({ notes: 'ok', prescription: [] })
        .expect(200);

      const res = await h.request.get('/api/doctor/dashboard').set(as(doctor));
      expect(res.status).toBe(200);
      const d = res.body.data;
      expect(d.earnings).toEqual({ total: 500, thisMonth: 500 });
      expect(d.patients).toBe(2);
      // The clock now sits at the completed visit: it is "today", the 16:00 slot on day 0 is in the past.
      expect(d.appointments).toEqual({ today: 1, upcoming: 1, completed: 1, cancelled: 1, noShow: 0 });
      expect(d.rating).toEqual({ average: 0, count: 0 });
      expect(d.next.map((a) => a.date)).toEqual([inThreeDays]);
      expect(d.next[0].actions).toBeDefined();
      expect(d.earningsSeries).toEqual([
        { period: '2025-10', amount: 0 },
        { period: '2025-11', amount: 0 },
        { period: '2025-12', amount: 0 },
        { period: '2026-01', amount: 0 },
        { period: '2026-02', amount: 0 },
        { period: '2026-03', amount: 500 },
      ]);
    });

    it('returns an all-zero dashboard for a doctor without appointments', async () => {
      const res = await h.request.get('/api/doctor/dashboard').set(as(doctor));
      expect(res.body.data).toMatchObject({
        earnings: { total: 0, thisMonth: 0 },
        patients: 0,
        appointments: { today: 0, upcoming: 0, completed: 0, cancelled: 0, noShow: 0 },
        next: [],
      });
      expect(res.body.data.earningsSeries).toHaveLength(6);
    });

    it('limits next to five upcoming appointments', async () => {
      const patients = await Promise.all(Array.from({ length: 6 }, () => h.patientSession()));
      await Promise.all(
        patients.map((p, i) =>
          h.book(p, doctor.id, {
            date: h.day(2),
            time: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'][i],
          }),
        ),
      );
      const res = await h.request.get('/api/doctor/dashboard').set(as(doctor));
      expect(res.body.data.next).toHaveLength(5);
      expect(res.body.data.appointments.upcoming).toBe(6);
    });

    it('lists only this doctor appointments with a given patient, newest first', async () => {
      const [mine, shared] = await Promise.all([h.patientSession(), h.patientSession()]);
      const other = await h.doctorSession();
      await h.book(mine, doctor.id, { time: '10:00' });
      const later = await h.book(mine, doctor.id, { date: h.day(5), time: '10:00' });
      await h.book(mine, other.id, { time: '11:00' });
      await h.book(shared, doctor.id, { time: '11:00' });

      const res = await h.request.get(`/api/doctor/patients/${mine.id}/appointments`).set(as(doctor));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].id).toBe(later.body.data.id);
      expect(res.body.data.every((a) => a.doctor.id === doctor.id && a.patient.id === mine.id)).toBe(true);
      expect((await h.request.get(`/api/doctor/patients/${mine.id}/appointments`).set(as(mine))).status).toBe(
        403,
      );
      expect((await h.request.get('/api/doctor/patients/bad/appointments').set(as(doctor))).status).toBe(400);
    });
  });
});
