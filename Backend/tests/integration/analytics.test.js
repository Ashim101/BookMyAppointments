import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listPeriods } from '../../src/modules/analytics/analytics.service.js';
import { Appointment } from '../../src/modules/appointments/appointment.model.js';
import { Doctor } from '../../src/modules/doctors/doctor.model.js';
import { Review } from '../../src/modules/reviews/review.model.js';
import { startHarness } from '../helpers/harness.js';

// "Now" in this suite: Wednesday 2026-03-11, 12:00 UTC.
const NOW = Date.UTC(2026, 2, 11, 12, 0);
let counter = 0;

describe('listPeriods', () => {
  it('lists days, Monday-started weeks and months', () => {
    expect(listPeriods('2026-02-27', '2026-03-02', 'day')).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ]);
    expect(listPeriods('2026-03-04', '2026-03-18', 'week')).toEqual([
      '2026-03-02',
      '2026-03-09',
      '2026-03-16',
    ]);
    expect(listPeriods('2025-11-20', '2026-02-02', 'month')).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
    expect(listPeriods('2026-03-05', '2026-03-05', 'day')).toEqual(['2026-03-05']);
  });
});

describe('admin analytics', () => {
  let h;
  let admin;
  let derm;
  let cardio;
  const as = () => h.bearer(admin.token);

  /** Inserts an appointment directly so exact instants and statuses can be controlled. */
  const insert = (
    doctor,
    startsAt,
    { status = 'booked', paymentStatus = 'unpaid', fee = doctor.doctor.fees } = {},
  ) => {
    counter += 1;
    const d = doctor.doctor;
    return Appointment.create({
      patient: d._id,
      doctor: d._id,
      patientInfo: { name: `Patient ${counter}`, email: `p${counter}@example.com` },
      doctorInfo: {
        name: d.name,
        speciality: d.speciality,
        specialityName: d.speciality === 'dermatology' ? 'Dermatology' : 'Cardiology',
      },
      date: new Date(startsAt).toISOString().slice(0, 10),
      time: '10:00',
      startsAt: new Date(startsAt),
      endsAt: new Date(startsAt + 1_800_000),
      timezone: 'Asia/Kathmandu',
      fee,
      currency: 'INR',
      status,
      paymentStatus,
    });
  };

  beforeAll(async () => {
    h = await startHarness({ now: NOW });
    admin = await h.adminSession();
    derm = await h.doctor({ name: 'Dr. Derm', specialityName: 'Dermatology', fees: 400 });
    cardio = await h.doctor({
      name: 'Dr. Heart',
      specialityName: 'Cardiology',
      fees: 1000,
      rating: { average: 4.25, count: 4 },
    });
    await h.doctor({ active: false });
    await h.patientSession();

    const day = (date, hour = 6) => Date.parse(`${date}T${String(hour).padStart(2, '0')}:00:00Z`);
    // 2026-03-02 is a Monday. The 19:00Z instant on 03-01 is already 00:45 on 03-02 in Kathmandu.
    await insert(cardio, day('2026-03-02'), { status: 'completed', paymentStatus: 'paid' });
    await insert(cardio, day('2026-03-01', 19), { status: 'completed', paymentStatus: 'paid' });
    await insert(cardio, day('2026-03-04'), { status: 'cancelled', paymentStatus: 'refunded' });
    await insert(cardio, day('2026-03-04'), { status: 'cancelled', paymentStatus: 'refund_pending' });
    await insert(derm, day('2026-03-04'), { status: 'completed', paymentStatus: 'paid' });
    await insert(derm, day('2026-03-10'), { status: 'no_show' });
    await insert(derm, day('2026-03-20'), { status: 'booked', paymentStatus: 'paid' });
    await insert(derm, day('2026-02-10'), { status: 'completed', paymentStatus: 'paid' });
    await insert(derm, day('2025-12-15'), { status: 'completed', paymentStatus: 'unpaid' });
    await insert(derm, day('2026-03-12'), { status: 'booked' });
    await insert(derm, day('2026-03-13'), { status: 'booked' });
    await Review.create({
      appointment: (await insert(derm, day('2026-01-05'), { status: 'completed' }))._id,
      doctor: derm.doctor._id,
      patient: derm.doctor._id,
      patientName: 'X',
      doctorName: 'Dr. Derm',
      rating: 5,
    });
    await Review.create({
      appointment: (await insert(derm, day('2026-01-06'), { status: 'completed' }))._id,
      doctor: derm.doctor._id,
      patient: derm.doctor._id,
      patientName: 'Y',
      doctorName: 'Dr. Derm',
      rating: 4,
    });
    await Doctor.updateOne({ _id: derm.doctor._id }, { $set: { rating: { average: 4.5, count: 2 } } });
  });
  afterAll(() => h.stop());

  it('summarises counts, revenue from paid appointments only, cancellation rate and rating', async () => {
    const res = await h.request.get('/api/admin/analytics/summary').set(as());
    expect(res.status).toBe(200);
    // Paid: cardio 1000 x2, derm 400 x3 (03-04 completed, 03-20 booked, 02-10 completed) => 3200.
    expect(res.body.data).toEqual({
      doctors: 3,
      activeDoctors: 2,
      patients: 1,
      appointments: { total: 13, booked: 3, completed: 7, cancelled: 2, noShow: 1 },
      revenue: { total: 3200, last30Days: 2800 },
      cancellationRate: 0.154,
      averageRating: 4.5,
    });
  });

  it('zero-fills a daily series and buckets by clinic-local day', async () => {
    const res = await h.request
      .get('/api/admin/analytics/timeseries')
      .set(as())
      .query({ from: '2026-02-28', to: '2026-03-06', interval: 'day' });
    expect(res.body.data.map((p) => p.period)).toEqual([
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
    ]);
    const by = Object.fromEntries(res.body.data.map((p) => [p.period, p]));
    expect(by['2026-02-28']).toEqual({
      period: '2026-02-28',
      appointments: 0,
      completed: 0,
      cancelled: 0,
      revenue: 0,
    });
    expect(by['2026-03-01']).toMatchObject({ appointments: 0 });
    expect(by['2026-03-02']).toEqual({
      period: '2026-03-02',
      appointments: 2,
      completed: 2,
      cancelled: 0,
      revenue: 2000,
    });
    expect(by['2026-03-04']).toEqual({
      period: '2026-03-04',
      appointments: 3,
      completed: 1,
      cancelled: 2,
      revenue: 400,
    });
    expect(by['2026-03-05'].appointments).toBe(0);
  });

  it('defaults to the last 30 days ending today', async () => {
    const res = await h.request.get('/api/admin/analytics/timeseries').set(as());
    expect(res.body.data).toHaveLength(30);
    expect(res.body.data[0].period).toBe('2026-02-10');
    expect(res.body.data.at(-1).period).toBe('2026-03-11');
    expect(res.body.data.find((p) => p.period === '2026-02-10').revenue).toBe(400);
  });

  it('groups weeks starting on Monday', async () => {
    const res = await h.request
      .get('/api/admin/analytics/timeseries')
      .set(as())
      .query({ from: '2026-03-04', to: '2026-03-20', interval: 'week' });
    expect(res.body.data.map((p) => p.period)).toEqual(['2026-03-02', '2026-03-09', '2026-03-16']);
    const [first, second, third] = res.body.data;
    // The range starts on Wednesday, so the 03-02 appointments before it are not part of the first week.
    expect(first).toMatchObject({ appointments: 3, completed: 1, cancelled: 2, revenue: 400 });
    expect(second).toMatchObject({ appointments: 3, completed: 0, cancelled: 0, revenue: 0 });
    expect(third).toMatchObject({ appointments: 1, revenue: 400 });
  });

  it('groups months and labels them YYYY-MM', async () => {
    const res = await h.request
      .get('/api/admin/analytics/timeseries')
      .set(as())
      .query({ from: '2025-11-15', to: '2026-03-31', interval: 'month' });
    expect(res.body.data.map((p) => p.period)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
    expect(res.body.data.map((p) => p.appointments)).toEqual([0, 1, 2, 1, 9]);
    expect(res.body.data[4].revenue).toBe(2800);
    expect(res.body.data[1].revenue).toBe(0);
  });

  it('validates the range and interval', async () => {
    const get = (query) => h.request.get('/api/admin/analytics/timeseries').set(as()).query(query);
    expect((await get({ interval: 'year' })).status).toBe(400);
    expect((await get({ from: '2026-03-10', to: '2026-03-01' })).status).toBe(400);
    expect((await get({ from: '2020-01-01', to: '2026-03-01', interval: 'day' })).status).toBe(400);
    expect((await get({ from: 'yesterday' })).status).toBe(400);
  });

  it('breaks appointments and revenue down by speciality', async () => {
    const res = await h.request.get('/api/admin/analytics/specialities').set(as());
    expect(res.body.data).toEqual([
      { speciality: 'dermatology', specialityName: 'Dermatology', appointments: 9, revenue: 1200 },
      { speciality: 'cardiology', specialityName: 'Cardiology', appointments: 4, revenue: 2000 },
    ]);
  });

  it('ranks top doctors with rating and honours the limit', async () => {
    const res = await h.request.get('/api/admin/analytics/top-doctors').set(as());
    expect(res.body.data).toEqual([
      {
        doctor: { id: derm.id, name: 'Dr. Derm', image: null, speciality: 'dermatology' },
        appointments: 9,
        revenue: 1200,
        rating: 4.5,
      },
      {
        doctor: { id: cardio.id, name: 'Dr. Heart', image: null, speciality: 'cardiology' },
        appointments: 4,
        revenue: 2000,
        rating: 4.3,
      },
    ]);
    const one = await h.request.get('/api/admin/analytics/top-doctors').set(as()).query({ limit: 1 });
    expect(one.body.data).toHaveLength(1);
    expect(
      (await h.request.get('/api/admin/analytics/top-doctors').set(as()).query({ limit: 0 })).status,
    ).toBe(400);
  });
});

describe('admin analytics on an empty system', () => {
  let h;
  beforeAll(async () => {
    h = await startHarness({ now: NOW });
  });
  afterAll(() => h.stop());

  it('returns zeros and a fully zero-filled series', async () => {
    const { token } = await h.adminSession();
    const res = await h.request.get('/api/admin/analytics/summary').set(h.bearer(token));
    expect(res.body.data).toEqual({
      doctors: 0,
      activeDoctors: 0,
      patients: 0,
      appointments: { total: 0, booked: 0, completed: 0, cancelled: 0, noShow: 0 },
      revenue: { total: 0, last30Days: 0 },
      cancellationRate: 0,
      averageRating: 0,
    });
    for (const [interval, length] of [
      ['day', 30],
      ['week', 5],
      ['month', 2],
    ]) {
      const series = await h.request
        .get('/api/admin/analytics/timeseries')
        .set(h.bearer(token))
        .query({ interval });
      expect(series.body.data, interval).toHaveLength(length);
      expect(
        series.body.data.every(
          (p) => p.appointments === 0 && p.completed === 0 && p.cancelled === 0 && p.revenue === 0,
        ),
      ).toBe(true);
    }
    expect((await h.request.get('/api/admin/analytics/specialities').set(h.bearer(token))).body.data).toEqual(
      [],
    );
    expect((await h.request.get('/api/admin/analytics/top-doctors').set(h.bearer(token))).body.data).toEqual(
      [],
    );
  });
});
