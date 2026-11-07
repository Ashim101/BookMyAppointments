import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Appointment } from '../../src/modules/appointments/appointment.model.js';
import { startHarness } from '../helpers/harness.js';

describe('concurrency guarantees', () => {
  let h;
  beforeAll(async () => {
    h = await startHarness();
    await Appointment.init();
  });
  afterAll(() => h.stop());

  const statuses = (responses) => responses.map((r) => r.status).sort();

  it('lets exactly one of 10 concurrent bookings of the same slot succeed', async () => {
    const doctor = await h.doctor();
    const patients = await Promise.all(Array.from({ length: 10 }, () => h.patientSession()));
    const responses = await Promise.all(patients.map((p) => h.book(p, doctor.id, { time: '10:00' })));

    expect(statuses(responses)).toEqual([201, 409, 409, 409, 409, 409, 409, 409, 409, 409]);
    for (const loser of responses.filter((r) => r.status === 409)) {
      expect(loser.body.error.code).toBe('SLOT_TAKEN');
    }
    expect(
      await Appointment.countDocuments({
        doctor: doctor.id,
        date: h.day(3),
        time: '10:00',
        status: 'booked',
      }),
    ).toBe(1);
  });

  it('lets only one of several identical requests from the same patient succeed', async () => {
    const doctor = await h.doctor();
    const patient = await h.patientSession();
    const responses = await Promise.all(
      Array.from({ length: 6 }, () => h.book(patient, doctor.id, { time: '11:00' })),
    );
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 409)).toHaveLength(5);
    expect(await Appointment.countDocuments({ patient: patient.id })).toBe(1);
  });

  it('keeps distinct slots independent under load', async () => {
    const doctor = await h.doctor();
    const patients = await Promise.all(Array.from({ length: 5 }, () => h.patientSession()));
    const times = ['09:00', '09:30', '10:00', '10:30', '11:00'];
    const responses = await Promise.all(patients.map((p, i) => h.book(p, doctor.id, { time: times[i] })));
    expect(statuses(responses)).toEqual([201, 201, 201, 201, 201]);
  });

  it('stops a patient from being double booked with two doctors at once', async () => {
    const [first, second] = await Promise.all([h.doctor(), h.doctor()]);
    const patient = await h.patientSession();
    const responses = await Promise.all([
      h.book(patient, first.id, { time: '14:00' }),
      h.book(patient, second.id, { time: '14:00' }),
      h.book(patient, first.id, { time: '14:00' }),
      h.book(patient, second.id, { time: '14:00' }),
    ]);
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await Appointment.countDocuments({ patient: patient.id, status: 'booked' })).toBe(1);
    for (const loser of responses.filter((r) => r.status !== 201)) {
      expect(loser.status).toBe(409);
      expect(['SLOT_TAKEN', 'CONFLICT']).toContain(loser.body.error.code);
    }
  });

  it('reschedules atomically: concurrent moves into one slot produce one winner', async () => {
    const doctor = await h.doctor();
    const patients = await Promise.all(Array.from({ length: 4 }, () => h.patientSession()));
    const booked = await Promise.all(
      patients.map((p, i) => h.book(p, doctor.id, { time: ['09:00', '09:30', '10:00', '10:30'][i] })),
    );
    const responses = await Promise.all(
      patients.map((p, i) =>
        h.request
          .patch(`/api/appointments/${booked[i].body.data.id}/reschedule`)
          .set(h.bearer(p.token))
          .send({ date: h.day(4), time: '15:00' }),
      ),
    );
    expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
    for (const loser of responses.filter((r) => r.status !== 200)) {
      expect(loser.status).toBe(409);
      expect(loser.body.error.code).toBe('SLOT_TAKEN');
    }
    expect(await Appointment.countDocuments({ doctor: doctor.id, date: h.day(4), time: '15:00' })).toBe(1);
    // Losers keep their original slot and their reschedule budget.
    const losers = await Appointment.find({ doctor: doctor.id, date: h.day(3) });
    expect(losers).toHaveLength(3);
    expect(losers.every((a) => a.rescheduleCount === 0 && a.activeSlotKey)).toBe(true);
  });

  it('serialises a cancel racing a rebooking of the same slot', async () => {
    const doctor = await h.doctor();
    const [owner, rival] = await Promise.all([h.patientSession(), h.patientSession()]);
    const booked = (await h.book(owner, doctor.id, { time: '16:00' })).body.data;
    const [cancel, rebook] = await Promise.all([
      h.request
        .patch(`/api/appointments/${booked.id}/cancel`)
        .set(h.bearer(owner.token))
        .send({ reason: 'swap' }),
      h.book(rival, doctor.id, { time: '16:00' }),
    ]);
    expect(cancel.status).toBe(200);
    expect([201, 409]).toContain(rebook.status);
    const active = await Appointment.countDocuments({
      doctor: doctor.id,
      time: '16:00',
      status: { $in: ['booked', 'completed'] },
    });
    expect(active).toBe(rebook.status === 201 ? 1 : 0);
  });
});
