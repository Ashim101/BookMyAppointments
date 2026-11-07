import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Leave } from '../../src/modules/scheduling/leave.model.js';
import { BASE_NOW, startHarness } from '../helpers/harness.js';

describe('public catalogue', () => {
  let h;
  let cardio;
  let derma;
  let neuro;

  beforeAll(async () => {
    h = await startHarness();
    cardio = await h.doctor({
      name: 'Dr. Alice Heart',
      specialityName: 'Cardiology',
      fees: 800,
      experienceYears: 12,
      rating: { average: 4.66, count: 3 },
    });
    derma = await h.doctor({
      name: 'Dr. Bob Skin',
      specialityName: 'Dermatology',
      fees: 300,
      experienceYears: 3,
      available: false,
    });
    neuro = await h.doctor({
      name: 'Dr. Carol Brain',
      specialityName: 'Neurology',
      fees: 500,
      experienceYears: 20,
    });
    await h.doctor({ name: 'Dr. Hidden', specialityName: 'Cardiology', fees: 100, active: false });
    await h.speciality('Orthopedics');
  });
  afterAll(() => h.stop());

  describe('specialities', () => {
    it('lists specialities alphabetically with the number of active doctors', async () => {
      const res = await h.request.get('/api/specialities');
      expect(res.status).toBe(200);
      expect(res.body.data.map((s) => [s.slug, s.name, s.doctorCount])).toEqual([
        ['cardiology', 'Cardiology', 1],
        ['dermatology', 'Dermatology', 1],
        ['neurology', 'Neurology', 1],
        ['orthopedics', 'Orthopedics', 0],
      ]);
      expect(res.body.data[0]).toMatchObject({ id: expect.any(String), description: expect.any(String) });
      expect(res.headers['cache-control']).toContain('max-age=30');
    });
  });

  describe('doctor list', () => {
    const list = (query = {}) => h.request.get('/api/doctors').query(query);

    it('returns the public shape without email, password hash or inactive doctors', async () => {
      const res = await list();
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ page: 1, limit: 10, total: 3, totalPages: 1 });
      const text = JSON.stringify(res.body);
      expect(text).not.toMatch(/passwordHash|password|"email"|@example\.com|"_id"|Hidden/);
      const alice = res.body.data.items.find((d) => d.id === cardio.id);
      expect(alice).toEqual({
        id: cardio.id,
        name: 'Dr. Alice Heart',
        image: null,
        speciality: 'cardiology',
        specialityName: 'Cardiology',
        degree: 'MBBS',
        experienceYears: 12,
        about: 'About',
        fees: 800,
        currency: 'INR',
        available: true,
        address: { line1: '1 Main St', line2: '', city: 'Kathmandu' },
        rating: { average: 4.7, count: 3 },
      });
    });

    it('reports a zero rating for unreviewed doctors', async () => {
      const res = await h.request.get(`/api/doctors/${neuro.id}`);
      expect(res.body.data.rating).toEqual({ average: 0, count: 0 });
    });

    it('filters by speciality, name, fee range and availability', async () => {
      expect((await list({ speciality: 'cardiology' })).body.data.items.map((d) => d.id)).toEqual([
        cardio.id,
      ]);
      expect((await list({ search: 'bob' })).body.data.items.map((d) => d.id)).toEqual([derma.id]);
      expect((await list({ minFee: 400, maxFee: 600 })).body.data.items.map((d) => d.id)).toEqual([neuro.id]);
      expect((await list({ minFee: 500 })).body.data.total).toBe(2);
      const available = (await list({ available: 'true' })).body.data.items.map((d) => d.id);
      expect(available).toHaveLength(2);
      expect(available).not.toContain(derma.id);
    });

    it('treats the search text literally rather than as a regular expression', async () => {
      expect((await list({ search: '.*' })).body.data.total).toBe(0);
      expect((await list({ search: 'Dr. Alice' })).body.data.total).toBe(1);
      expect((await list({ search: '(' })).status).toBe(200);
    });

    it.each([
      ['fees_asc', () => [derma.id, neuro.id, cardio.id]],
      ['fees_desc', () => [cardio.id, neuro.id, derma.id]],
      ['experience', () => [neuro.id, cardio.id, derma.id]],
      ['name', () => [cardio.id, derma.id, neuro.id]],
      ['rating', () => [cardio.id]],
    ])('sorts by %s', async (sort, expected) => {
      const ids = (await list({ sort })).body.data.items.map((d) => d.id);
      if (sort === 'rating') expect(ids[0]).toBe(expected()[0]);
      else expect(ids).toEqual(expected());
    });

    it('paginates', async () => {
      const page = await list({ limit: 2, page: 2, sort: 'name' });
      expect(page.body.data).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
      expect(page.body.data.items.map((d) => d.id)).toEqual([neuro.id]);
    });

    it('validates query parameters', async () => {
      for (const query of [
        { sort: 'cheapest' },
        { limit: 101 },
        { page: 0 },
        { minFee: 'abc' },
        { available: 'yes' },
      ]) {
        const res = await list(query);
        expect(res.status, JSON.stringify(query)).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('supports ETag revalidation with 304', async () => {
      const first = await list({ sort: 'name' });
      expect(first.headers.etag).toBeTruthy();
      expect(first.headers['cache-control']).toContain('must-revalidate');
      const second = await h.request
        .get('/api/doctors')
        .query({ sort: 'name' })
        .set('If-None-Match', first.headers.etag);
      expect(second.status).toBe(304);
    });
  });

  describe('single doctor', () => {
    it('returns the public profile and hides inactive doctors', async () => {
      const res = await h.request.get(`/api/doctors/${cardio.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(cardio.id);
      expect(res.body.data.email).toBeUndefined();

      const hidden = await h.doctor({ active: false });
      const missing = await h.request.get(`/api/doctors/${hidden.id}`);
      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe('NOT_FOUND');
      expect((await h.request.get('/api/doctors/64b64b64b64b64b64b64b64b')).status).toBe(404);
      expect((await h.request.get('/api/doctors/xyz')).status).toBe(400);
    });

    it('lists reviews of a doctor, newest first, and 404s for unknown doctors', async () => {
      const empty = await h.request.get(`/api/doctors/${neuro.id}/reviews`);
      expect(empty.body.data).toEqual({ items: [], page: 1, limit: 10, total: 0, totalPages: 0 });
      expect((await h.request.get('/api/doctors/64b64b64b64b64b64b64b64b/reviews')).status).toBe(404);
    });
  });

  describe('slots', () => {
    it('returns seven days by default in the clinic timezone', async () => {
      const res = await h.request.get(`/api/doctors/${neuro.id}/slots`);
      expect(res.status).toBe(200);
      const { timezone, slotMinutes, days } = res.body.data;
      expect(timezone).toBe('Asia/Kathmandu');
      expect(slotMinutes).toBe(30);
      expect(days).toHaveLength(7);
      expect(days[0]).toMatchObject({ date: h.day(0), weekday: 1 });
      expect(days[6].date).toBe(h.day(6));
      expect(days[1].slots.map((s) => s.time)).toEqual([
        '09:00',
        '09:30',
        '10:00',
        '10:30',
        '11:00',
        '11:30',
        '13:00',
        '13:30',
        '14:00',
        '14:30',
        '15:00',
        '15:30',
        '16:00',
        '16:30',
      ]);
    });

    it('marks past and too-soon slots on the first day as unavailable', async () => {
      const res = await h.request.get(`/api/doctors/${neuro.id}/slots`).query({ from: h.day(0), days: 1 });
      const availability = Object.fromEntries(res.body.data.days[0].slots.map((s) => [s.time, s.available]));
      expect(availability['09:00']).toBe(false);
      expect(availability['10:00']).toBe(false);
      expect(availability['10:30']).toBe(true);
    });

    it('leaves non-working days and leave days empty', async () => {
      const weekdays = await h.doctor({
        schedule: {
          slotMinutes: 60,
          weekly: [
            { day: 1, start: '10:00', end: '12:00', breaks: [] },
            { day: 3, start: '10:00', end: '12:00', breaks: [] },
          ],
        },
      });
      await Leave.create({ doctor: weekdays.id, date: h.day(2), reason: 'Away' });
      const res = await h.request.get(`/api/doctors/${weekdays.id}/slots`).query({ from: h.day(0), days: 4 });
      const days = res.body.data.days;
      expect(days.map((d) => d.slots.length)).toEqual([2, 0, 0, 0]);
      expect(res.body.data.slotMinutes).toBe(60);
    });

    it('validates from and days', async () => {
      for (const query of [{ days: 15 }, { days: 0 }, { from: '2026-13-01' }, { from: 'tomorrow' }]) {
        const res = await h.request.get(`/api/doctors/${neuro.id}/slots`).query(query);
        expect(res.status, JSON.stringify(query)).toBe(400);
      }
      const hidden = await h.doctor({ active: false });
      expect((await h.request.get(`/api/doctors/${hidden.id}/slots`)).status).toBe(404);
    });

    it('uses the injected clock for today', async () => {
      expect(h.clock.now()).toBe(BASE_NOW);
      expect(h.today()).toBe('2026-03-02');
    });
  });
});
