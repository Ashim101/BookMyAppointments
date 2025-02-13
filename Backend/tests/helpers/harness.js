import { randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import supertest from 'supertest';
import { inject } from 'vitest';
import { createApp } from '../../src/app.js';
import { connectDatabase } from '../../src/config/db.js';
import { loadConfig } from '../../src/config/env.js';
import { Doctor } from '../../src/modules/doctors/doctor.model.js';
import { Speciality } from '../../src/modules/specialities/speciality.model.js';
import { addDays, todayIn } from '../../src/utils/time.js';

export const ADMIN = { email: 'admin@example.com', password: 'Admin#12345' };
export const PASSWORD = 'Passw0rd!x';
/** Monday 2026-03-02, 09:45 in Asia/Kathmandu. */
export const BASE_NOW = Date.UTC(2026, 2, 2, 4, 0);

export const WEEK_SCHEDULE = {
  slotMinutes: 30,
  weekly: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, start: '09:00', end: '17:00', breaks: [{ start: '12:00', end: '13:00' }] })),
};

export function makeClock(start = BASE_NOW) {
  return {
    t: start,
    now() {
      return this.t;
    },
    set(value) {
      this.t = value;
    },
    advance(ms) {
      this.t += ms;
    },
  };
}

export function testEnv(extra = {}) {
  return {
    NODE_ENV: 'test',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/unused',
    JWT_ACCESS_SECRET: 'test-access-secret-0123456789',
    JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789',
    BCRYPT_ROUNDS: '4',
    ADMIN_EMAIL: ADMIN.email,
    ADMIN_PASSWORD_HASH: bcrypt.hashSync(ADMIN.password, 4),
    AUTH_RATE_LIMIT_MAX: '100000',
    UPLOAD_DIR: path.join(os.tmpdir(), `bma-uploads-${randomBytes(4).toString('hex')}`),
    CLINIC_TIMEZONE: 'Asia/Kathmandu',
    REMINDERS_ENABLED: 'false',
    ...extra,
  };
}

/** Boots the app against a throwaway database and returns helpers for driving it. */
export async function startHarness({ env = {}, overrides = {}, now = BASE_NOW } = {}) {
  const dbName = `bma_test_${randomBytes(6).toString('hex')}`;
  await connectDatabase(inject('mongoUri'), { dbName });
  const config = loadConfig(testEnv(env));
  const clock = makeClock(now);
  const app = createApp({ config, overrides: { clock, ...overrides } });
  const { container } = app.locals;
  const request = supertest(app);

  const h = {
    app,
    config,
    clock,
    container,
    request,
    today: () => todayIn(clock.now(), config.clinic.timezone),
    day: (offset) => addDays(todayIn(clock.now(), config.clinic.timezone), offset),

    async stop() {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    },

    bearer: (token) => ({ Authorization: `Bearer ${token}` }),

    async speciality(name = 'General physician') {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return (await Speciality.findOne({ slug })) ?? Speciality.create({ slug, name, description: `${name} care` });
    },

    async doctor(overrides = {}) {
      const speciality = await h.speciality(overrides.specialityName);
      const email = overrides.email ?? `doc${randomBytes(3).toString('hex')}@example.com`;
      const doctor = await Doctor.create({
        name: 'Dr. Test',
        email,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        speciality: speciality.slug,
        degree: 'MBBS',
        experienceYears: 5,
        about: 'About',
        fees: 500,
        currency: 'INR',
        address: { line1: '1 Main St', line2: '', city: 'Kathmandu' },
        schedule: WEEK_SCHEDULE,
        ...overrides,
      });
      return { doctor, email, password: PASSWORD, id: String(doctor._id) };
    },

    async login(email, password, role) {
      const res = await request.post('/api/auth/login').send({ email, password, role });
      return res.body.data;
    },

    async doctorSession(overrides) {
      const created = await h.doctor(overrides);
      const session = await h.login(created.email, PASSWORD, 'doctor');
      return { ...created, token: session.accessToken, session };
    },

    async adminSession() {
      const session = await h.login(ADMIN.email, ADMIN.password, 'admin');
      return { token: session.accessToken, session };
    },

    async patientSession(email = `pat${randomBytes(3).toString('hex')}@example.com`) {
      await request.post('/api/auth/otp/request').send({ email }).expect(200);
      const code = /(\d{6})/.exec(container.mailer.outbox.findLast((m) => m.to === email).text)[1];
      const res = await request.post('/api/auth/register').send({ name: 'Pat Ient', email, password: PASSWORD, otp: code }).expect(200);
      const { accessToken, refreshToken, user } = res.body.data;
      return { email, token: accessToken, refreshToken, id: user.id, session: res.body.data };
    },

    /** Books the doctor's slot as the given patient and returns the appointment payload. */
    async book(patient, doctorId, { date = h.day(3), time = '10:00', reason = '' } = {}) {
      const res = await request.post('/api/appointments').set(h.bearer(patient.token)).send({ doctorId, date, time, reason });
      return res;
    },

    /** Books a slot and has the doctor complete it. Leaves the clock at the appointment start. */
    async completed(patient, doctor, { date = h.day(3), time = '10:00', prescription = [] } = {}) {
      const booked = (await h.book(patient, doctor.id, { date, time })).body.data;
      h.clock.set(Date.parse(booked.startsAt));
      await request
        .patch(`/api/appointments/${booked.id}/complete`)
        .set(h.bearer(doctor.token))
        .send({ notes: 'Done', prescription })
        .expect(200);
      return booked.id;
    },
  };
  return h;
}
