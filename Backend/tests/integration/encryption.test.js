import mongoose from 'mongoose';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Appointment } from '../../src/modules/appointments/appointment.model.js';
import { Notification } from '../../src/modules/notifications/notification.model.js';
import { EncryptionError } from '../../src/utils/fieldCrypto.js';
import { startHarness } from '../helpers/harness.js';

const REASON = 'Chest tightness after exercise';
const NOTES = 'Suspected angina; ECG ordered, avoid strenuous activity';
const PRESCRIPTION = [
  { medicine: 'Aspirin', dosage: '75 mg', frequency: 'daily', durationDays: 30, instructions: 'After food' },
  { medicine: 'Atorvastatin', dosage: '20 mg', frequency: 'nightly', durationDays: 60, instructions: '' },
];
const SECRETS = [REASON, NOTES, 'Aspirin', 'Atorvastatin', 'angina', 'Chest tightness'];

const rawAppointments = () => mongoose.connection.db.collection('appointments');

describe('health data encryption at rest', () => {
  let h;
  let doctor;
  let patient;
  let appointmentId;
  const logged = [];
  const logger = pino({ level: 'error' }, { write: (line) => logged.push(JSON.parse(line)) });
  const as = (who) => h.bearer(who.token);

  beforeAll(async () => {
    h = await startHarness({ logger });
    doctor = await h.doctorSession();
    patient = await h.patientSession();
    const booked = (await h.book(patient, doctor.id, { reason: REASON })).body.data;
    appointmentId = booked.id;
    h.clock.set(Date.parse(booked.startsAt));
    await h.request
      .patch(`/api/appointments/${appointmentId}/complete`)
      .set(as(doctor))
      .send({ notes: NOTES, prescription: PRESCRIPTION })
      .expect(200);
  });
  afterAll(() => h.stop());

  it('stores ciphertext only: the raw MongoDB document has none of the plaintext', async () => {
    const raw = await rawAppointments().findOne({ _id: new mongoose.Types.ObjectId(appointmentId) });
    for (const value of [raw.reason, raw.consultation.notes, raw.consultation.prescription]) {
      expect(value).toMatch(/^enc:v1:test1:[\w-]+:[\w-]+:[\w-]+$/);
    }
    expect(typeof raw.consultation.prescription).toBe('string');
    const dump = JSON.stringify(raw);
    for (const secret of SECRETS) expect(dump).not.toContain(secret);
  });

  it('keeps no plaintext anywhere in the database, including notifications and audit logs', async () => {
    for (const { name } of await mongoose.connection.db.listCollections().toArray()) {
      const dump = JSON.stringify(await mongoose.connection.db.collection(name).find().toArray());
      for (const secret of SECRETS) expect(dump, `${name} contains "${secret}"`).not.toContain(secret);
    }
  });

  it('returns decrypted values with the documented shape on detail, for every role', async () => {
    const admin = await h.adminSession();
    for (const who of [patient, doctor, admin]) {
      const res = await h.request.get(`/api/appointments/${appointmentId}`).set(as(who)).expect(200);
      expect(res.body.data.reason).toBe(REASON);
      expect(res.body.data.consultation).toEqual({
        notes: NOTES,
        prescription: PRESCRIPTION,
        completedAt: expect.any(String),
      });
    }
  });

  it('decrypts in the appointment list', async () => {
    const res = await h.request.get('/api/appointments').set(as(patient)).expect(200);
    const row = res.body.data.items.find((item) => item.id === appointmentId);
    expect(row.reason).toBe(REASON);
    expect(row.consultation.prescription).toEqual(PRESCRIPTION);
  });

  it("decrypts in the doctor's patient history and dashboard next list", async () => {
    const history = await h.request
      .get(`/api/doctor/patients/${patient.id}/appointments`)
      .set(as(doctor))
      .expect(200);
    expect(history.body.data[0]).toMatchObject({ reason: REASON, consultation: { notes: NOTES } });

    const upcoming = (await h.book(patient, doctor.id, { date: h.day(5), reason: 'Follow-up on ECG' })).body
      .data;
    const dashboard = await h.request.get('/api/doctor/dashboard').set(as(doctor)).expect(200);
    expect(dashboard.body.data.next.find((item) => item.id === upcoming.id).reason).toBe('Follow-up on ECG');
  });

  it('encrypts when reason is set on a new booking and when a consultation is rewritten by an update query', async () => {
    const created = await Appointment.findById(appointmentId);
    expect(created.reason).toBe(REASON);
    const updated = await Appointment.findOneAndUpdate(
      { _id: appointmentId },
      { $set: { 'consultation.notes': 'Revised plan' } },
      { returnDocument: 'after' },
    );
    expect(updated.consultation.notes).toBe('Revised plan');
    const raw = await rawAppointments().findOne({ _id: updated._id });
    expect(raw.consultation.notes).toMatch(/^enc:v1:/);
    expect(JSON.stringify(raw)).not.toContain('Revised plan');
  });

  it('keeps consultation text out of the audit log entry for the visit', async () => {
    const entry = await mongoose.connection.db
      .collection('auditlogs')
      .findOne({ action: 'appointment.complete', 'target.id': appointmentId });
    expect(entry).toBeTruthy();
    expect({ ...entry.meta }).toEqual({});
  });

  it('never puts the clinical text into notifications', async () => {
    const texts = (await Notification.find().lean()).map((n) => `${n.title} ${n.message}`).join('\n');
    for (const secret of SECRETS) expect(texts).not.toContain(secret);
  });

  it('stores empty values empty and reads missing ones as empty', async () => {
    const other = await h.patientSession();
    const booked = (await h.book(other, doctor.id, { date: h.day(6) })).body.data;
    expect(booked.reason).toBe('');
    const raw = await rawAppointments().findOne({ _id: new mongoose.Types.ObjectId(booked.id) });
    expect(raw.reason).toBe('');
    h.clock.set(Date.parse(booked.startsAt));
    const done = await h.request
      .patch(`/api/appointments/${booked.id}/complete`)
      .set(as(doctor))
      .send({ notes: '', prescription: [] })
      .expect(200);
    expect(done.body.data.consultation).toMatchObject({ notes: '', prescription: [] });
  });

  describe('integrity', () => {
    const corrupt = async (mutate) => {
      const raw = await rawAppointments().findOne({ _id: new mongoose.Types.ObjectId(appointmentId) });
      await rawAppointments().updateOne({ _id: raw._id }, { $set: mutate(raw) });
      return raw;
    };
    const restore = (raw) =>
      rawAppointments().updateOne(
        { _id: raw._id },
        { $set: { reason: raw.reason, 'consultation.notes': raw.consultation.notes } },
      );

    it('fails loudly, with a logged error, when ciphertext was tampered with', async () => {
      const raw = await corrupt((doc) => {
        const parts = doc.reason.split(':');
        const data = Buffer.from(parts[5], 'base64url');
        data[0] ^= 1;
        parts[5] = data.toString('base64url');
        return { reason: parts.join(':') };
      });
      try {
        const loaded = await Appointment.findById(appointmentId);
        expect(() => loaded.reason).toThrow(EncryptionError);
        const res = await h.request.get(`/api/appointments/${appointmentId}`).set(as(patient));
        expect(res.status).toBe(500);
        expect(res.body.error.code).toBe('INTERNAL');
        expect(JSON.stringify(res.body)).not.toContain(REASON);
        expect(logged).toContainEqual(
          expect.objectContaining({ keyId: 'test1', msg: 'field decryption failed' }),
        );
      } finally {
        await restore(raw);
      }
    });

    it('fails loudly when the key id is unknown', async () => {
      const raw = await corrupt((doc) => ({
        'consultation.notes': doc.consultation.notes.replace(':test1:', ':retired:'),
      }));
      try {
        const res = await h.request.get(`/api/appointments/${appointmentId}`).set(as(doctor));
        expect(res.status).toBe(500);
      } finally {
        await restore(raw);
      }
      await h.request.get(`/api/appointments/${appointmentId}`).set(as(doctor)).expect(200);
    });

    it('refuses plaintext found where ciphertext is expected instead of passing it through', async () => {
      const raw = await corrupt(() => ({ reason: 'injected plaintext' }));
      try {
        const res = await h.request.get(`/api/appointments/${appointmentId}`).set(as(doctor));
        expect(res.status).toBe(500);
      } finally {
        await restore(raw);
      }
    });
  });
});
