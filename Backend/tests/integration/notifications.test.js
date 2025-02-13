import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Notification } from '../../src/modules/notifications/notification.model.js';
import { startHarness } from '../helpers/harness.js';

describe('notifications', () => {
  let h;
  let doctor;
  let patient;
  let other;
  const as = (who) => h.bearer(who.token);

  beforeAll(async () => {
    h = await startHarness();
    doctor = await h.doctorSession();
    patient = await h.patientSession();
    other = await h.patientSession();
    const make = (user, role, n, read = false) =>
      Notification.create({ userId: user.id, role, type: 'test', title: `Title ${n}`, message: `Message ${n}`, link: n % 2 ? `/appointments/${n}` : null, read });
    for (let n = 1; n <= 5; n += 1) await make(patient, 'patient', n, n <= 2);
    await make(other, 'patient', 9);
    await make(doctor, 'doctor', 10);
  });
  afterAll(() => h.stop());

  it('lists the caller own notifications with an unread count, newest first', async () => {
    const res = await h.request.get('/api/notifications').set(as(patient));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ page: 1, limit: 10, total: 5, totalPages: 1, unreadCount: 3 });
    expect(res.body.data.items.map((n) => n.title)).toEqual(['Title 5', 'Title 4', 'Title 3', 'Title 2', 'Title 1']);
    expect(res.body.data.items[0]).toEqual({
      id: expect.any(String),
      type: 'test',
      title: 'Title 5',
      message: 'Message 5',
      link: '/appointments/5',
      read: false,
      createdAt: expect.stringMatching(/Z$/),
    });
    expect(res.body.data.items[1].link).toBeNull();
  });

  it('filters unread and paginates while keeping the global unread count', async () => {
    const unread = await h.request.get('/api/notifications').set(as(patient)).query({ unread: 'true' });
    expect(unread.body.data.total).toBe(3);
    expect(unread.body.data.items.every((n) => !n.read)).toBe(true);
    const page = await h.request.get('/api/notifications').set(as(patient)).query({ unread: 'true', limit: 2, page: 2 });
    expect(page.body.data).toMatchObject({ total: 3, totalPages: 2, unreadCount: 3 });
    expect(page.body.data.items).toHaveLength(1);
  });

  it('works for doctors and is closed to admins and anonymous callers', async () => {
    const res = await h.request.get('/api/notifications').set(as(doctor));
    expect(res.body.data.total).toBe(1);
    const admin = await h.adminSession();
    expect((await h.request.get('/api/notifications').set(as(admin))).status).toBe(403);
    expect((await h.request.get('/api/notifications')).status).toBe(401);
  });

  it('marks one notification read and refuses other people notifications', async () => {
    const mine = (await h.request.get('/api/notifications').set(as(patient)).query({ unread: 'true' })).body.data.items[0];
    const res = await h.request.patch(`/api/notifications/${mine.id}/read`).set(as(patient));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: mine.id, read: true });

    const foreign = await Notification.findOne({ userId: other.id });
    const hijack = await h.request.patch(`/api/notifications/${foreign.id}/read`).set(as(patient));
    expect(hijack.status).toBe(404);
    expect((await Notification.findById(foreign.id)).read).toBe(false);
    expect((await h.request.patch('/api/notifications/bad/read').set(as(patient))).status).toBe(400);
  });

  it('marks everything read for the caller only', async () => {
    const res = await h.request.patch('/api/notifications/read-all').set(as(patient));
    expect(res.body).toEqual({ success: true, data: { updated: 2 } });
    expect((await h.request.get('/api/notifications').set(as(patient))).body.data.unreadCount).toBe(0);
    expect((await h.request.get('/api/notifications').set(as(other))).body.data.unreadCount).toBe(1);
    expect((await h.request.patch('/api/notifications/read-all').set(as(patient))).body.data.updated).toBe(0);
  });
});
