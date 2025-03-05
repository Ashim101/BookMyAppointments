import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startHarness } from '../helpers/harness.js';

describe('application shell', () => {
  let h;
  beforeAll(async () => {
    h = await startHarness({
      env: { REMINDERS_ENABLED: 'true', JSON_BODY_LIMIT: '2kb', CORS_ORIGINS: 'http://localhost:5173' },
    });
  });
  afterAll(() => h.stop());

  it('reports health with database and reminder job readiness', async () => {
    const res = await h.request.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        status: 'ok',
        db: 'up',
        uptime: expect.any(Number),
        reminderJob: { running: false, lastRunAt: null },
      },
    });
  });

  it('answers unknown routes with the error envelope', async () => {
    const res = await h.request.get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route GET /api/does-not-exist not found' },
    });
  });

  it('answers malformed and oversized JSON with BAD_REQUEST', async () => {
    const malformed = await h.request
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('BAD_REQUEST');
    const big = await h.request
      .post('/api/auth/login')
      .send({ email: 'a@example.com', password: 'x'.repeat(5000), role: 'patient' });
    expect(big.status).toBe(400);
    expect(big.body.error.code).toBe('BAD_REQUEST');
  });

  it('validates a missing body with field level details', async () => {
    const res = await h.request.post('/api/auth/login');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.path).sort()).toEqual(['email', 'password', 'role']);
  });

  it('sets security headers and hides the framework', async () => {
    const res = await h.request.get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeTruthy();
    expect(res.headers['x-request-id']).toMatch(/[\w-]{8,}/);
  });

  it('echoes a safe request id and replaces an unsafe one', async () => {
    const safe = await h.request.get('/api/health').set('X-Request-Id', 'client-req-12345');
    expect(safe.headers['x-request-id']).toBe('client-req-12345');
    const unsafe = await h.request.get('/api/health').set('X-Request-Id', 'bad id with spaces\t');
    expect(unsafe.headers['x-request-id']).not.toContain('bad');
  });

  it('allows only listed CORS origins', async () => {
    const allowed = await h.request.get('/api/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const denied = await h.request.get('/api/health').set('Origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    const preflight = await h.request
      .options('/api/appointments')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');
    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-headers']).toMatch(/authorization/i);
  });

  it('hides internal errors behind a generic INTERNAL response', async () => {
    const original = h.container.specialities.list;
    h.container.specialities.list = async () => {
      throw new Error('secret database detail');
    };
    // The route captured the service object at startup, so patch the method it calls.
    const res = await h.request.get('/api/specialities');
    h.container.specialities.list = original;
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL');
    expect(JSON.stringify(res.body)).not.toContain('secret database detail');
  });

  it('does not serve files outside the uploads directory', async () => {
    expect((await h.request.get('/uploads/missing.png')).status).toBe(404);
    expect((await h.request.get('/uploads/..%2F..%2Fpackage.json')).status).toBe(404);
  });
});

describe('patient profile', () => {
  let h;
  let patient;
  const PNG = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(64),
  ]);

  beforeAll(async () => {
    h = await startHarness();
    patient = await h.patientSession('profile@example.com');
  });
  afterAll(() => h.stop());

  const patch = () => h.request.patch('/api/patient/profile').set(h.bearer(patient.token));

  it('returns the profile with defaults', async () => {
    const res = await h.request.get('/api/patient/profile').set(h.bearer(patient.token));
    expect(res.body.data).toEqual({
      id: patient.id,
      name: 'Pat Ient',
      email: 'profile@example.com',
      image: null,
      phone: '',
      gender: 'unspecified',
      dob: null,
      address: { line1: '', line2: '', city: '' },
      blocked: false,
      createdAt: expect.stringMatching(/Z$/),
    });
  });

  it('updates fields from multipart, including a JSON address and an image', async () => {
    const res = await patch()
      .field('name', 'Pat Updated')
      .field('phone', '+977 9800000000')
      .field('gender', 'female')
      .field('dob', '1990-05-17')
      .field('address', JSON.stringify({ line1: '12 Lake Rd', city: 'Pokhara' }))
      .attach('image', PNG, { filename: 'me.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      name: 'Pat Updated',
      phone: '+977 9800000000',
      gender: 'female',
      dob: '1990-05-17',
      address: { line1: '12 Lake Rd', line2: '', city: 'Pokhara' },
    });
    expect(res.body.data.image).toMatch(/\/uploads\/.+\.png$/);
    const stored = await h.request.get('/api/patient/profile').set(h.bearer(patient.token));
    expect(stored.body.data.image).toBe(res.body.data.image);
  });

  it('accepts JSON bodies, partial updates and clearing the date of birth', async () => {
    const res = await patch().send({ phone: '123456' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Pat Updated');
    const cleared = await patch().send({ dob: '' });
    expect(cleared.body.data.dob).toBeNull();
  });

  it('validates fields and files', async () => {
    for (const fields of [
      { name: 'A' },
      { gender: 'robot' },
      { dob: '1990-02-31' },
      { phone: 'call me' },
      { address: '{bad json' },
    ]) {
      const req = patch();
      for (const [key, value] of Object.entries(fields)) req.field(key, value);
      const res = await req;
      expect(res.status, JSON.stringify(fields)).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    const wrongType = await patch().attach('image', Buffer.from('plain text'), {
      filename: 'a.txt',
      contentType: 'text/plain',
    });
    expect(wrongType.status).toBe(400);
    const spoofed = await patch().attach('image', Buffer.from('not really a png'), {
      filename: 'a.png',
      contentType: 'image/png',
    });
    expect(spoofed.status).toBe(400);
    const tooBig = await patch().attach('image', Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]), {
      filename: 'a.png',
      contentType: 'image/png',
    });
    expect(tooBig.status).toBe(400);
  });

  it('is limited to patients', async () => {
    const doctor = await h.doctorSession();
    expect((await h.request.get('/api/patient/profile').set(h.bearer(doctor.token))).status).toBe(403);
    expect((await h.request.get('/api/patient/profile')).status).toBe(401);
  });
});

describe('API rate limiting', () => {
  it('throttles the whole API per IP but never the health probe', async () => {
    const h = await startHarness({ env: { API_RATE_LIMIT_MAX: '3' } });
    for (let i = 0; i < 3; i += 1) expect((await h.request.get('/api/specialities')).status).toBe(200);
    const limited = await h.request.get('/api/specialities');
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect(limited.headers['ratelimit-policy']).toBeDefined();
    expect((await h.request.get('/api/health')).status).toBe(200);
    await h.stop();
  });
});
