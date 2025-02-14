import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Appointment } from '../../src/modules/appointments/appointment.model.js';
import { Notification } from '../../src/modules/notifications/notification.model.js';
import { BASE_NOW, startHarness } from '../helpers/harness.js';

const HOUR = 3_600_000;

describe('reminder job', () => {
  let h;
  let doctor;
  let patient;
  let job;

  beforeAll(async () => {
    h = await startHarness({ env: { REMINDER_LEAD_HOURS: '24', REMINDER_INTERVAL_MINUTES: '0.01' } });
    job = h.container.reminderJob;
  });
  afterAll(async () => {
    await job.stop();
    await h.stop();
  });
  beforeEach(async () => {
    h.clock.set(BASE_NOW);
    h.container.mailer.outbox.length = 0;
    doctor = await h.doctorSession();
    patient = await h.patientSession();
  });

  const book = async (date, time) => (await h.book(patient, doctor.id, { date, time })).body.data;

  it('reminds appointments starting within the lead time, once, by notification and email', async () => {
    const soon = await book(h.day(1), '09:00'); // about 23h away
    const later = await book(h.day(3), '09:00');

    const sent = await job.runOnce(new Date(BASE_NOW));
    expect(sent).toBe(1);

    const stored = await Appointment.findById(soon.id);
    expect(stored.reminderSentAt).toEqual(new Date(BASE_NOW));
    expect((await Appointment.findById(later.id)).reminderSentAt).toBeNull();

    const note = await Notification.findOne({ userId: patient.id, type: 'appointment_reminder' });
    expect(note).toMatchObject({ role: 'patient', link: `/appointments/${soon.id}`, read: false });
    expect(note.message).toContain(soon.date);
    const mails = h.container.mailer.outbox.filter((m) => m.subject.startsWith('Reminder'));
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ to: patient.email });
    expect(mails[0].text).toContain('09:00');

    expect(await job.runOnce(new Date(BASE_NOW))).toBe(0);
    expect(await Notification.countDocuments({ type: 'appointment_reminder', userId: patient.id })).toBe(1);

    // Time passes and the later appointment enters the window.
    expect(await job.runOnce(new Date(BASE_NOW + 2 * 24 * HOUR))).toBe(1);
    expect((await Appointment.findById(later.id)).reminderSentAt).toBeTruthy();
  });

  it('skips cancelled, completed, no-show and already started appointments', async () => {
    const cancelled = await book(h.day(1), '09:00');
    const keep = await book(h.day(1), '09:30');
    await h.request.patch(`/api/appointments/${cancelled.id}/cancel`).set(h.bearer(patient.token)).send({ reason: 'x' }).expect(200);
    const past = await Appointment.create({
      ...(await Appointment.findById(keep.id)).toObject({ depopulate: true }),
      _id: undefined,
      activeSlotKey: undefined,
      activePatientKey: undefined,
      startsAt: new Date(BASE_NOW - HOUR),
      endsAt: new Date(BASE_NOW - HOUR + 1800_000),
      reminderSentAt: null,
    });
    expect(await job.runOnce(new Date(BASE_NOW))).toBe(1);
    expect((await Appointment.findById(cancelled.id)).reminderSentAt).toBeNull();
    expect((await Appointment.findById(past.id)).reminderSentAt).toBeNull();
    expect((await Appointment.findById(keep.id)).reminderSentAt).toBeTruthy();
  });

  it('sends at most one reminder per appointment even when instances race', async () => {
    const appointments = [];
    for (const [date, time] of [[h.day(0), '15:00'], [h.day(0), '15:30'], [h.day(0), '16:00'], [h.day(1), '09:00']]) appointments.push(await book(date, time));
    const results = await Promise.all([job.runOnce(new Date(BASE_NOW)), job.runOnce(new Date(BASE_NOW)), job.runOnce(new Date(BASE_NOW))]);
    expect(results.reduce((a, b) => a + b, 0)).toBe(4);
    expect(await Notification.countDocuments({ type: 'appointment_reminder', userId: patient.id })).toBe(4);
    expect(h.container.mailer.outbox.filter((m) => m.subject.startsWith('Reminder'))).toHaveLength(4);
    expect(appointments).toHaveLength(4);
  });

  it('sends a new reminder after the appointment is rescheduled', async () => {
    const a = await book(h.day(1), '09:00');
    expect(await job.runOnce(new Date(BASE_NOW))).toBe(1);
    await h.request.patch(`/api/appointments/${a.id}/reschedule`).set(h.bearer(patient.token)).send({ date: h.day(0), time: '16:00' }).expect(200);
    expect((await Appointment.findById(a.id)).reminderSentAt).toBeNull();
    expect(await job.runOnce(new Date(BASE_NOW))).toBe(1);
  });

  it('still counts the reminder when the email transport fails', async () => {
    await book(h.day(1), '09:00');
    const original = h.container.mailer.send;
    h.container.mailer.send = async () => {
      throw new Error('smtp down');
    };
    expect(await job.runOnce(new Date(BASE_NOW))).toBe(1);
    h.container.mailer.send = original;
    expect(await Notification.countDocuments({ type: 'appointment_reminder', userId: patient.id })).toBe(1);
    expect(await job.runOnce(new Date(BASE_NOW))).toBe(0);
  });

  it('runs on an interval until stopped', async () => {
    await book(h.day(1), '09:00');
    expect(job.status().running).toBe(false);
    job.start();
    job.start();
    expect(job.status().running).toBe(true);
    await expect.poll(async () => Notification.countDocuments({ type: 'appointment_reminder', userId: patient.id }), { timeout: 5000 }).toBe(1);
    await job.stop();
    expect(job.status()).toMatchObject({ running: false, lastRunAt: expect.any(String) });
    const health = await h.request.get('/api/health');
    expect(health.body.data.reminderJob).toBeUndefined();
  });
});
