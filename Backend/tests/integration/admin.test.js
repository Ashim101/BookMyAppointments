import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditLog } from '../../src/modules/audit/audit.model.js';
import { Doctor } from '../../src/modules/doctors/doctor.model.js';
import { PASSWORD, startHarness } from '../helpers/harness.js';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(32)]);

describe('admin area', () => {
  let h;
  let admin;
  const as = () => h.bearer(admin.token);

  beforeAll(async () => {
    h = await startHarness();
    admin = await h.adminSession();
    await h.speciality('Cardiology');
    await h.speciality('Dermatology');
  });
  afterAll(() => h.stop());

  const createDoctor = (fields = {}, file) => {
    const req = h.request.post('/api/admin/doctors').set(as());
    const body = {
      name: 'Dr. New Doc',
      email: `new${Math.random().toString(16).slice(2, 8)}@example.com`,
      password: PASSWORD,
      speciality: 'cardiology',
      degree: 'MD',
      experienceYears: '8',
      about: 'Heart specialist',
      fees: '650',
      address: JSON.stringify({ line1: '5 Elm', line2: '', city: 'Lalitpur' }),
      ...fields,
    };
    for (const [key, value] of Object.entries(body)) if (value !== undefined) req.field(key, value);
    if (file) req.attach('image', file.buffer, { filename: file.name, contentType: file.type });
    return req;
  };

  it('protects every admin route from anonymous callers and other roles', async () => {
    const patient = await h.patientSession();
    const doctor = await h.doctorSession();
    const routes = [
      '/api/admin/doctors',
      '/api/admin/patients',
      '/api/admin/specialities',
      '/api/admin/settings',
      '/api/admin/audit-logs',
      '/api/admin/reviews',
      '/api/admin/analytics/summary',
      '/api/admin/appointments/export',
    ];
    for (const route of routes) {
      expect((await h.request.get(route)).status, route).toBe(401);
      expect((await h.request.get(route).set(h.bearer(patient.token))).status, route).toBe(403);
      expect((await h.request.get(route).set(h.bearer(doctor.token))).status, route).toBe(403);
    }
  });

  describe('doctors', () => {
    it('creates a doctor with the default schedule, a hashed password and an audit entry', async () => {
      const res = await createDoctor({ email: 'created@example.com' });
      expect(res.status).toBe(201);
      const d = res.body.data;
      expect(d).toMatchObject({
        name: 'Dr. New Doc',
        email: 'created@example.com',
        speciality: 'cardiology',
        specialityName: 'Cardiology',
        experienceYears: 8,
        fees: 650,
        currency: 'INR',
        available: true,
        active: true,
        address: { line1: '5 Elm', line2: '', city: 'Lalitpur' },
        rating: { average: 0, count: 0 },
        image: null,
      });
      expect(d.schedule).toEqual({
        slotMinutes: 30,
        weekly: [1, 2, 3, 4, 5].map((day) => ({
          day,
          start: '10:00',
          end: '17:00',
          breaks: [{ start: '13:00', end: '14:00' }],
        })),
      });
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);

      const stored = await Doctor.findById(d.id).select('+passwordHash');
      expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
      const login = await h.request
        .post('/api/auth/login')
        .send({ email: 'created@example.com', password: PASSWORD, role: 'doctor' });
      expect(login.status).toBe(200);

      const log = await AuditLog.findOne({ action: 'doctor.create', 'target.id': d.id });
      expect(log).toMatchObject({ actor: { role: 'admin', id: 'admin' } });
      expect(JSON.stringify(log.meta)).not.toContain(PASSWORD);
      expect(log.meta.name).toBe('Dr. New Doc');
    });

    it('accepts a custom schedule and a JPEG, PNG or WebP image served from /uploads', async () => {
      const schedule = JSON.stringify({
        slotMinutes: 15,
        weekly: [{ day: 6, start: '08:00', end: '10:00', breaks: [] }],
      });
      for (const [name, type, buffer] of [
        ['a.jpg', 'image/jpeg', JPEG],
        ['b.png', 'image/png', PNG],
        ['c.webp', 'image/webp', WEBP],
      ]) {
        const res = await createDoctor({ schedule }, { name, type, buffer });
        expect(res.status, name).toBe(201);
        expect(res.body.data.schedule.slotMinutes).toBe(15);
        expect(res.body.data.image).toMatch(
          new RegExp(`^${h.config.publicUrl}/uploads/[\\w-]+\\.(jpg|png|webp)$`),
        );
        const file = await h.request.get(new URL(res.body.data.image).pathname);
        expect(file.status).toBe(200);
        expect(file.headers['content-type']).toMatch(/image\//);
      }
    });

    it('rejects bad uploads: wrong type, spoofed content and oversized files', async () => {
      const gif = await createDoctor(
        {},
        { name: 'x.gif', type: 'image/gif', buffer: Buffer.from('GIF89a....') },
      );
      expect(gif.status).toBe(400);
      expect(gif.body.error.code).toBe('VALIDATION_ERROR');
      const spoof = await createDoctor(
        {},
        { name: 'x.png', type: 'image/png', buffer: Buffer.from('<?php echo 1; ?>') },
      );
      expect(spoof.status).toBe(400);
      expect(spoof.body.error.details[0].path).toBe('image');
      const big = await createDoctor(
        {},
        { name: 'big.png', type: 'image/png', buffer: Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]) },
      );
      expect(big.status).toBe(400);
      expect(big.body.error.message).toMatch(/2 MB/);
    });

    it('validates input and reports duplicate emails and unknown specialities', async () => {
      const email = 'dupe@example.com';
      expect((await createDoctor({ email })).status).toBe(201);
      const dup = await createDoctor({ email: 'DUPE@example.com' });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('EMAIL_TAKEN');

      const unknown = await createDoctor({ speciality: 'astrology' });
      expect(unknown.status).toBe(400);
      expect(unknown.body.error.details[0].path).toBe('speciality');

      for (const fields of [
        { password: 'weak' },
        { name: 'A' },
        { fees: '-1' },
        { fees: 'free' },
        { email: 'nope' },
        { address: 'not json' },
        { schedule: JSON.stringify({ slotMinutes: 30, weekly: [{ day: 1, start: '10:00', end: '09:00' }] }) },
      ]) {
        const res = await createDoctor({
          email: `v${Math.random().toString(16).slice(2, 8)}@example.com`,
          ...fields,
        });
        expect(res.status, JSON.stringify(fields)).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('lists, searches and filters doctors including inactive ones', async () => {
      const derm = await createDoctor({
        name: 'Dr. Zed Skin',
        speciality: 'dermatology',
        email: 'zed@example.com',
      });
      await h.request
        .patch(`/api/admin/doctors/${derm.body.data.id}/active`)
        .set(as())
        .send({ active: false });
      const all = await h.request.get('/api/admin/doctors').set(as());
      expect(all.body.data.items.some((d) => d.id === derm.body.data.id && d.email)).toBe(true);
      const inactive = await h.request.get('/api/admin/doctors').set(as()).query({ active: 'false' });
      expect(inactive.body.data.items.map((d) => d.name)).toEqual(['Dr. Zed Skin']);
      const bySpeciality = await h.request
        .get('/api/admin/doctors')
        .set(as())
        .query({ speciality: 'dermatology' });
      expect(bySpeciality.body.data.total).toBe(1);
      const search = await h.request.get('/api/admin/doctors').set(as()).query({ search: 'zed' });
      expect(search.body.data.total).toBe(1);
      const paged = await h.request.get('/api/admin/doctors').set(as()).query({ limit: 2 });
      expect(paged.body.data.items).toHaveLength(2);
      expect(paged.body.data.totalPages).toBeGreaterThan(1);
    });

    it('hides deactivated doctors from the public list without cancelling their appointments', async () => {
      const doc = await h.doctorSession();
      const patient = await h.patientSession();
      const booked = (await h.book(patient, doc.id)).body.data;
      await h.request
        .patch(`/api/admin/doctors/${doc.id}/active`)
        .set(as())
        .send({ active: false })
        .expect(200);
      const ids = (await h.request.get('/api/doctors').query({ limit: 100 })).body.data.items.map(
        (d) => d.id,
      );
      expect(ids).not.toContain(doc.id);
      const view = await h.request.get(`/api/appointments/${booked.id}`).set(h.bearer(patient.token));
      expect(view.body.data.status).toBe('booked');
      await h.request
        .patch(`/api/admin/doctors/${doc.id}/active`)
        .set(as())
        .send({ active: true })
        .expect(200);
      expect((await h.request.get(`/api/doctors/${doc.id}`)).status).toBe(200);
    });

    it('updates a subset of fields, including the image, and protects the password', async () => {
      const created = await createDoctor({ email: 'patchme@example.com' });
      const id = created.body.data.id;
      const res = await h.request
        .patch(`/api/admin/doctors/${id}`)
        .set(as())
        .field('fees', '999')
        .field('about', 'Updated')
        .field('speciality', 'dermatology')
        .attach('image', PNG, { filename: 'p.png', contentType: 'image/png' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        fees: 999,
        about: 'Updated',
        speciality: 'dermatology',
        specialityName: 'Dermatology',
        name: 'Dr. New Doc',
      });
      expect(res.body.data.image).toBeTruthy();

      const withPassword = await h.request
        .patch(`/api/admin/doctors/${id}`)
        .set(as())
        .field('password', 'Hacked-pass1');
      expect(withPassword.status).toBe(200);
      const stillOld = await h.request
        .post('/api/auth/login')
        .send({ email: 'patchme@example.com', password: PASSWORD, role: 'doctor' });
      expect(stillOld.status).toBe(200);

      const taken = await h.request
        .patch(`/api/admin/doctors/${id}`)
        .set(as())
        .field('email', 'created@example.com');
      expect(taken.body.error.code).toBe('EMAIL_TAKEN');
      expect(
        (await h.request.patch('/api/admin/doctors/64b64b64b64b64b64b64b64b').set(as()).field('fees', '1'))
          .status,
      ).toBe(404);
      expect(
        (await h.request.patch(`/api/admin/doctors/${id}`).set(as()).field('speciality', 'astrology')).status,
      ).toBe(400);
    });

    it('toggles availability and replaces the schedule', async () => {
      const doc = await h.doctor();
      const off = await h.request
        .patch(`/api/admin/doctors/${doc.id}/availability`)
        .set(as())
        .send({ available: false });
      expect(off.body.data.available).toBe(false);
      expect((await h.request.get(`/api/doctors/${doc.id}`)).body.data.available).toBe(false);

      const schedule = { slotMinutes: 45, weekly: [{ day: 2, start: '09:00', end: '12:00', breaks: [] }] };
      const put = await h.request.put(`/api/admin/doctors/${doc.id}/schedule`).set(as()).send(schedule);
      expect(put.body.data).toEqual(schedule);
      expect(
        (
          await h.request
            .put(`/api/admin/doctors/${doc.id}/schedule`)
            .set(as())
            .send({ slotMinutes: 45, weekly: [{ day: 2, start: '12:00', end: '09:00', breaks: [] }] })
        ).status,
      ).toBe(400);
      expect(
        (
          await h.request
            .patch(`/api/admin/doctors/${doc.id}/availability`)
            .set(as())
            .send({ available: 'no' })
        ).status,
      ).toBe(400);
      expect(await AuditLog.countDocuments({ action: 'doctor.availability', 'target.id': doc.id })).toBe(1);
    });
  });

  describe('patients', () => {
    it('lists patients with appointment counts, search and blocked filter', async () => {
      const doc = await h.doctor();
      const a = await h.patientSession('alpha.search@example.com');
      const b = await h.patientSession('beta.search@example.com');
      await h.book(a, doc.id, { time: '10:00' });
      await h.book(a, doc.id, { time: '10:30' });

      const found = await h.request.get('/api/admin/patients').set(as()).query({ search: 'search@example' });
      expect(found.body.data.total).toBe(2);
      const mine = found.body.data.items.find((p) => p.id === a.id);
      expect(mine).toMatchObject({
        email: a.email,
        blocked: false,
        appointmentsCount: 2,
        address: { line1: '', line2: '', city: '' },
      });
      expect(found.body.data.items.find((p) => p.id === b.id).appointmentsCount).toBe(0);
      expect(JSON.stringify(found.body)).not.toMatch(/passwordHash/);

      await h.request
        .patch(`/api/admin/patients/${b.id}/block`)
        .set(as())
        .send({ blocked: true })
        .expect(200);
      const blocked = await h.request.get('/api/admin/patients').set(as()).query({ blocked: 'true' });
      expect(blocked.body.data.items.map((p) => p.id)).toEqual([b.id]);
      expect(await AuditLog.findOne({ action: 'patient.block', 'target.id': b.id })).toBeTruthy();
    });

    it('validates block requests', async () => {
      expect(
        (
          await h.request
            .patch('/api/admin/patients/64b64b64b64b64b64b64b64b/block')
            .set(as())
            .send({ blocked: true })
        ).status,
      ).toBe(404);
      expect(
        (await h.request.patch('/api/admin/patients/abc/block').set(as()).send({ blocked: true })).status,
      ).toBe(400);
      const patient = await h.patientSession();
      expect(
        (await h.request.patch(`/api/admin/patients/${patient.id}/block`).set(as()).send({ blocked: 'yes' }))
          .status,
      ).toBe(400);
    });
  });

  describe('specialities', () => {
    it('creates with a derived slug, renames keeping the slug, and deletes when unused', async () => {
      const created = await h.request
        .post('/api/admin/specialities')
        .set(as())
        .send({ name: 'Ear, Nose & Throat', description: 'ENT care' });
      expect(created.status).toBe(201);
      expect(created.body.data).toMatchObject({
        slug: 'ear-nose-throat',
        name: 'Ear, Nose & Throat',
        description: 'ENT care',
        doctorCount: 0,
      });

      const renamed = await h.request
        .patch(`/api/admin/specialities/${created.body.data.id}`)
        .set(as())
        .send({ name: 'ENT', description: 'Updated' });
      expect(renamed.body.data).toMatchObject({
        slug: 'ear-nose-throat',
        name: 'ENT',
        description: 'Updated',
      });
      const onlyDescription = await h.request
        .patch(`/api/admin/specialities/${created.body.data.id}`)
        .set(as())
        .send({ description: 'Again' });
      expect(onlyDescription.body.data.name).toBe('ENT');

      const del = await h.request.delete(`/api/admin/specialities/${created.body.data.id}`).set(as());
      expect(del.body).toEqual({ success: true, data: null });
      expect(
        (await h.request.delete(`/api/admin/specialities/${created.body.data.id}`).set(as())).status,
      ).toBe(404);
      const list = await h.request.get('/api/admin/specialities').set(as());
      expect(list.body.data.map((s) => s.name)).not.toContain('ENT');
    });

    it('rejects duplicates, bad names and deleting a speciality that doctors still use', async () => {
      await h.request.post('/api/admin/specialities').set(as()).send({ name: 'Oncology' }).expect(201);
      const dup = await h.request.post('/api/admin/specialities').set(as()).send({ name: 'oncology' });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('CONFLICT');
      expect((await h.request.post('/api/admin/specialities').set(as()).send({ name: 'X' })).status).toBe(
        400,
      );
      expect((await h.request.post('/api/admin/specialities').set(as()).send({ name: '!!!' })).status).toBe(
        400,
      );

      const cardiology = (await h.request.get('/api/admin/specialities').set(as())).body.data.find(
        (s) => s.slug === 'cardiology',
      );
      await createDoctor({ email: 'uses-cardiology@example.com' });
      const blocked = await h.request.delete(`/api/admin/specialities/${cardiology.id}`).set(as());
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.code).toBe('CONFLICT');

      const other = (await h.request.get('/api/admin/specialities').set(as())).body.data.find(
        (s) => s.slug === 'oncology',
      );
      const clash = await h.request
        .patch(`/api/admin/specialities/${other.id}`)
        .set(as())
        .send({ name: 'Cardiology' });
      expect(clash.status).toBe(409);
    });
  });

  describe('settings', () => {
    it('returns env defaults, applies partial updates and ignores the timezone', async () => {
      const initial = await h.request.get('/api/admin/settings').set(as());
      expect(initial.body.data).toEqual({
        cancellationCutoffHours: 2,
        bookingWindowDays: 14,
        defaultSlotMinutes: 30,
        currency: 'INR',
        timezone: 'Asia/Kathmandu',
      });

      const res = await h.request
        .put('/api/admin/settings')
        .set(as())
        .send({ bookingWindowDays: 7, currency: 'npr', timezone: 'UTC' });
      expect(res.body.data).toEqual({
        cancellationCutoffHours: 2,
        bookingWindowDays: 7,
        defaultSlotMinutes: 30,
        currency: 'NPR',
        timezone: 'Asia/Kathmandu',
      });
      expect((await h.request.get('/api/admin/settings').set(as())).body.data.bookingWindowDays).toBe(7);

      const doc = await h.doctor();
      const patient = await h.patientSession();
      const far = await h.book(patient, doc.id, { date: h.day(8) });
      expect(far.body.error.code).toBe('SLOT_UNAVAILABLE');
      await h.request
        .put('/api/admin/settings')
        .set(as())
        .send({ bookingWindowDays: 14, currency: 'INR' })
        .expect(200);
      expect((await h.book(patient, doc.id, { date: h.day(8) })).status).toBe(201);
    });

    it('applies settings to newly created doctors and validates ranges', async () => {
      await h.request
        .put('/api/admin/settings')
        .set(as())
        .send({ defaultSlotMinutes: 20, currency: 'USD' })
        .expect(200);
      const created = await createDoctor({ email: 'settings@example.com' });
      expect(created.body.data).toMatchObject({ currency: 'USD', schedule: { slotMinutes: 20 } });
      await h.request
        .put('/api/admin/settings')
        .set(as())
        .send({ defaultSlotMinutes: 30, currency: 'INR' })
        .expect(200);

      for (const body of [
        { bookingWindowDays: 0 },
        { bookingWindowDays: 400 },
        { cancellationCutoffHours: -1 },
        { defaultSlotMinutes: 25 },
        { currency: 'RUPEES' },
      ]) {
        const res = await h.request.put('/api/admin/settings').set(as()).send(body);
        expect(res.status, JSON.stringify(body)).toBe(400);
      }
      expect(await AuditLog.findOne({ action: 'settings.update' })).toBeTruthy();
    });
  });

  describe('audit log', () => {
    it('lists entries newest first and filters by action, role and date', async () => {
      const doctor = await h.doctorSession();
      await h.request
        .patch('/api/doctor/profile')
        .set(h.bearer(doctor.token))
        .send({ about: 'audited' })
        .expect(200);

      const all = await h.request.get('/api/admin/audit-logs').set(as()).query({ limit: 100 });
      expect(all.status).toBe(200);
      const [first] = all.body.data.items;
      expect(first).toEqual({
        id: expect.any(String),
        actor: { role: expect.any(String), id: expect.any(String), name: expect.any(String) },
        action: expect.any(String),
        target: expect.anything(),
        meta: expect.any(Object),
        ip: expect.any(String),
        createdAt: expect.stringMatching(/Z$/),
      });
      const times = all.body.data.items.map((i) => i.createdAt);
      expect([...times].sort().reverse()).toEqual(times);

      const byAction = await h.request
        .get('/api/admin/audit-logs')
        .set(as())
        .query({ action: 'doctor.profile.update' });
      expect(byAction.body.data.items.every((i) => i.action === 'doctor.profile.update')).toBe(true);
      expect(byAction.body.data.items[0].actor).toMatchObject({
        role: 'doctor',
        id: doctor.id,
        name: 'Dr. Test',
      });
      const byRole = await h.request
        .get('/api/admin/audit-logs')
        .set(as())
        .query({ actorRole: 'admin', limit: 100 });
      expect(byRole.body.data.items.every((i) => i.actor.role === 'admin')).toBe(true);

      const today = new Date().toISOString().slice(0, 10);
      const inRange = await h.request
        .get('/api/admin/audit-logs')
        .set(as())
        .query({ from: today, to: today });
      expect(inRange.body.data.total).toBeGreaterThan(0);
      const outOfRange = await h.request
        .get('/api/admin/audit-logs')
        .set(as())
        .query({ from: '2001-01-01', to: '2001-01-02' });
      expect(outOfRange.body.data.total).toBe(0);
      expect(
        (await h.request.get('/api/admin/audit-logs').set(as()).query({ actorRole: 'ghost' })).status,
      ).toBe(400);
    });

    it('does not record failed requests or secrets', async () => {
      const before = await AuditLog.countDocuments();
      await h.request
        .patch('/api/admin/patients/64b64b64b64b64b64b64b64b/block')
        .set(as())
        .send({ blocked: true })
        .expect(404);
      await createDoctor({ password: 'weak' }).expect(400);
      expect(await AuditLog.countDocuments()).toBe(before);
      const dump = JSON.stringify(await AuditLog.find().lean());
      expect(dump).not.toContain(PASSWORD);
    });
  });
});
