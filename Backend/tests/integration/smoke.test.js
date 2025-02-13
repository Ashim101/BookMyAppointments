import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startHarness } from '../helpers/harness.js';

describe('smoke', () => {
  let h;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => h.stop());

  it('boots and books', async () => {
    const health = await h.request.get('/api/health');
    expect(health.body.data.db).toBe('up');
    const doc = await h.doctor();
    const patient = await h.patientSession();
    const res = await h.book(patient, doc.id);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.data.actions.canCancel).toBe(true);
    const list = await h.request.get('/api/doctors');
    expect(list.body.data.items[0].email).toBeUndefined();
    expect(JSON.stringify(list.body)).not.toMatch(/passwordHash/);
  });
});
