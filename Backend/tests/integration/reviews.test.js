import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Appointment } from '../../src/modules/appointments/appointment.model.js';
import { AuditLog } from '../../src/modules/audit/audit.model.js';
import { Doctor } from '../../src/modules/doctors/doctor.model.js';
import { Review } from '../../src/modules/reviews/review.model.js';
import { BASE_NOW, startHarness } from '../helpers/harness.js';

describe('reviews', () => {
  let h;
  let doctor;
  let patient;
  let admin;
  const as = (who) => h.bearer(who.token);
  const review = (who, id, body) => h.request.post(`/api/appointments/${id}/review`).set(as(who)).send(body);

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

  it('lets the patient review a completed appointment once and updates the doctor rating', async () => {
    const id = await h.completed(patient, doctor);
    const before = await h.request.get(`/api/appointments/${id}`).set(as(patient));
    expect(before.body.data.actions.canReview).toBe(true);

    const res = await review(patient, id, { rating: 5, comment: 'Excellent care' });
    expect(res.status).toBe(200);
    expect(res.body.data.review).toMatchObject({ rating: 5, comment: 'Excellent care' });
    expect(res.body.data.actions.canReview).toBe(false);

    const dup = await review(patient, id, { rating: 1, comment: 'changed my mind' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('ALREADY_REVIEWED');

    const profile = await h.request.get(`/api/doctors/${doctor.id}`);
    expect(profile.body.data.rating).toEqual({ average: 5, count: 1 });
  });

  it('computes the average over several reviews, rounded to one decimal', async () => {
    const second = await h.patientSession();
    const third = await h.patientSession();
    const a = await h.completed(patient, doctor, { time: '10:00' });
    const b = await h.completed(second, doctor, { time: '10:30' });
    const c = await h.completed(third, doctor, { time: '11:00' });
    await review(patient, a, { rating: 5, comment: '' }).then((r) => expect(r.status).toBe(200));
    await review(second, b, { rating: 4, comment: '' });
    await review(third, c, { rating: 4, comment: '' });
    const profile = await h.request.get(`/api/doctors/${doctor.id}`);
    expect(profile.body.data.rating).toEqual({ average: 4.3, count: 3 });
    const stored = await Doctor.findById(doctor.id);
    expect(stored.rating.count).toBe(3);
  });

  it('only accepts reviews for completed appointments by their own patient', async () => {
    const booked = (await h.book(patient, doctor.id)).body.data;
    const notDone = await review(patient, booked.id, { rating: 5, comment: 'x' });
    expect(notDone.status).toBe(422);
    expect(notDone.body.error.code).toBe('INVALID_STATE');

    const id = await h.completed(patient, doctor, { time: '11:00' });
    const stranger = await h.patientSession();
    expect((await review(stranger, id, { rating: 5, comment: 'x' })).status).toBe(404);
    expect((await review(doctor, id, { rating: 5, comment: 'x' })).status).toBe(403);
    expect(
      (await h.request.post(`/api/appointments/${id}/review`).send({ rating: 5, comment: '' })).status,
    ).toBe(401);
    expect(await Review.countDocuments({ appointment: id })).toBe(0);
  });

  it('validates rating and comment', async () => {
    const id = await h.completed(patient, doctor);
    for (const body of [
      { rating: 0, comment: '' },
      { rating: 6, comment: '' },
      { rating: 3.5, comment: '' },
      { rating: '5', comment: '' },
      { rating: 5, comment: 'x'.repeat(1001) },
      {},
    ]) {
      const res = await review(patient, id, body);
      expect(res.status, JSON.stringify(body).slice(0, 60)).toBe(400);
    }
    expect((await review(patient, id, { rating: 5, comment: 'x'.repeat(1000) })).status).toBe(200);
  });

  it('allows only one winner when the same review is posted concurrently', async () => {
    const id = await h.completed(patient, doctor);
    const results = await Promise.all(
      Array.from({ length: 4 }, () => review(patient, id, { rating: 4, comment: 'twice' })),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(3);
    expect((await Doctor.findById(doctor.id)).rating.count).toBe(1);
  });

  it('paginates public reviews newest first with reviewer details', async () => {
    const second = await h.patientSession();
    const a = await h.completed(patient, doctor, { time: '10:00' });
    const b = await h.completed(second, doctor, { time: '10:30' });
    await review(patient, a, { rating: 5, comment: 'First' });
    h.clock.advance(1000);
    await review(second, b, { rating: 3, comment: 'Second' });
    await Review.updateOne({ appointment: b }, { $set: { createdAt: new Date(Date.now() + 5000) } });

    const res = await h.request.get(`/api/doctors/${doctor.id}/reviews`).query({ limit: 1 });
    expect(res.body.data).toMatchObject({ page: 1, limit: 1, total: 2, totalPages: 2 });
    expect(res.body.data.items[0]).toMatchObject({
      rating: 3,
      comment: 'Second',
      patient: { id: second.id, name: 'Pat Ient', image: null },
      doctor: { id: doctor.id, name: 'Dr. Test' },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/email/);
  });

  it('lets admins list, filter and delete reviews, recomputing the rating', async () => {
    const second = await h.patientSession();
    const a = await h.completed(patient, doctor, { time: '10:00' });
    const b = await h.completed(second, doctor, { time: '10:30' });
    await review(patient, a, { rating: 5, comment: 'Great' });
    await review(second, b, { rating: 1, comment: 'Awful' });
    expect((await Doctor.findById(doctor.id)).rating).toMatchObject({ average: 3, count: 2 });

    const all = await h.request.get('/api/admin/reviews').set(as(admin)).query({ doctorId: doctor.id });
    expect(all.body.data.total).toBe(2);
    const low = await h.request
      .get('/api/admin/reviews')
      .set(as(admin))
      .query({ doctorId: doctor.id, maxRating: 2 });
    expect(low.body.data.items.map((r) => r.comment)).toEqual(['Awful']);

    const target = low.body.data.items[0];
    const del = await h.request.delete(`/api/admin/reviews/${target.id}`).set(as(admin));
    expect(del.body).toEqual({ success: true, data: null });
    expect((await Doctor.findById(doctor.id)).rating).toMatchObject({ average: 5, count: 1 });
    expect((await Appointment.findById(b)).review).toBeNull();
    expect(await AuditLog.findOne({ action: 'review.delete', 'target.id': target.id })).toBeTruthy();

    const again = await h.request.delete(`/api/admin/reviews/${target.id}`).set(as(admin));
    expect(again.status).toBe(404);
    // After deletion the patient may review again.
    expect((await review(second, b, { rating: 4, comment: 'Better' })).status).toBe(200);

    expect((await h.request.get('/api/admin/reviews').set(as(patient))).status).toBe(403);
    expect((await h.request.delete(`/api/admin/reviews/${target.id}`).set(as(doctor))).status).toBe(403);
  });

  it('resets the aggregate to zero when the last review is removed', async () => {
    const id = await h.completed(patient, doctor);
    await review(patient, id, { rating: 2, comment: '' });
    const { items } = (
      await h.request.get('/api/admin/reviews').set(as(admin)).query({ doctorId: doctor.id })
    ).body.data;
    await h.request.delete(`/api/admin/reviews/${items[0].id}`).set(as(admin)).expect(200);
    const profile = await h.request.get(`/api/doctors/${doctor.id}`);
    expect(profile.body.data.rating).toEqual({ average: 0, count: 0 });
  });
});
