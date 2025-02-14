import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Otp, PasswordReset, RefreshToken } from '../../src/modules/auth/auth.models.js';
import { Patient } from '../../src/modules/patients/patient.model.js';
import { sha256 } from '../../src/utils/crypto.js';
import { ADMIN, PASSWORD, startHarness } from '../helpers/harness.js';

const codeFor = (h, email) =>
  /(\d{6})/.exec(h.container.mailer.outbox.findLast((m) => m.to === email).text)[1];

describe('OTP registration', () => {
  let h;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => h.stop());

  it('requests an OTP, stores only a hash and registers with the code', async () => {
    const email = 'new@example.com';
    const res = await h.request.post('/api/auth/otp/request').send({ email: 'New@Example.com' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { expiresInSeconds: 600, resendAfterSeconds: 60 } });

    const code = codeFor(h, email);
    const stored = await Otp.findOne({ email }).lean();
    expect(JSON.stringify(stored)).not.toContain(code);
    expect(stored.codeHash).toHaveLength(64);

    const reg = await h.request
      .post('/api/auth/register')
      .send({ name: 'New User', email, password: PASSWORD, otp: code });
    expect(reg.status).toBe(200);
    expect(reg.body.data.user).toMatchObject({ name: 'New User', email, role: 'patient', image: null });
    expect(reg.body.data.accessToken).toBeTruthy();
    expect(reg.body.data.refreshToken).toBeTruthy();
    expect(await Otp.countDocuments({ email })).toBe(0);
    const patient = await Patient.findOne({ email }).select('+passwordHash').lean();
    expect(patient.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('refuses to register without having requested a code', async () => {
    const res = await h.request
      .post('/api/auth/register')
      .send({ name: 'Sneaky', email: 'sneaky@example.com', password: PASSWORD, otp: '123456' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('OTP_INVALID');
    expect(await Patient.exists({ email: 'sneaky@example.com' })).toBeNull();
  });

  it('rejects a wrong code, and the right code still works afterwards', async () => {
    const email = 'wrong@example.com';
    await h.request.post('/api/auth/otp/request').send({ email });
    const code = codeFor(h, email);
    const wrong = code === '000000' ? '111111' : '000000';
    const bad = await h.request
      .post('/api/auth/register')
      .send({ name: 'Wrong One', email, password: PASSWORD, otp: wrong });
    expect(bad.body.error.code).toBe('OTP_INVALID');
    const good = await h.request
      .post('/api/auth/register')
      .send({ name: 'Wrong One', email, password: PASSWORD, otp: code });
    expect(good.status).toBe(200);
  });

  it('locks the code after 5 failed attempts, even for the correct code', async () => {
    const email = 'locked@example.com';
    await h.request.post('/api/auth/otp/request').send({ email });
    const code = codeFor(h, email);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i += 1) {
      const res = await h.request
        .post('/api/auth/register')
        .send({ name: 'Locked', email, password: PASSWORD, otp: wrong });
      expect(res.body.error.code).toBe('OTP_INVALID');
    }
    const res = await h.request
      .post('/api/auth/register')
      .send({ name: 'Locked', email, password: PASSWORD, otp: code });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('OTP_INVALID');
    expect(res.body.error.message).toMatch(/too many attempts/i);
  });

  it('expires codes after 10 minutes', async () => {
    const email = 'late@example.com';
    await h.request.post('/api/auth/otp/request').send({ email });
    const code = codeFor(h, email);
    h.clock.advance(10 * 60_000 + 1000);
    const res = await h.request
      .post('/api/auth/register')
      .send({ name: 'Late One', email, password: PASSWORD, otp: code });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('OTP_EXPIRED');
  });

  it('enforces a 60 second resend cooldown and then allows a new code', async () => {
    const email = 'cool@example.com';
    await h.request.post('/api/auth/otp/request').send({ email }).expect(200);
    const again = await h.request.post('/api/auth/otp/request').send({ email });
    expect(again.status).toBe(429);
    expect(again.body.error.code).toBe('OTP_COOLDOWN');

    h.clock.advance(61_000);
    await h.request.post('/api/auth/otp/request').send({ email }).expect(200);
    expect(h.container.mailer.outbox.filter((m) => m.to === email)).toHaveLength(2);
  });

  it('returns EMAIL_TAKEN for an existing patient, on request and on register', async () => {
    const patient = await h.patientSession('taken@example.com');
    const request = await h.request.post('/api/auth/otp/request').send({ email: patient.email });
    expect(request.status).toBe(409);
    expect(request.body.error.code).toBe('EMAIL_TAKEN');
    const reg = await h.request
      .post('/api/auth/register')
      .send({ name: 'Dup', email: patient.email, password: PASSWORD, otp: '123456' });
    expect(reg.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('validates the password policy and field shapes', async () => {
    const email = 'weak@example.com';
    await h.request.post('/api/auth/otp/request').send({ email });
    const code = codeFor(h, email);
    for (const password of ['short1', 'onlyletters', '12345678']) {
      const res = await h.request
        .post('/api/auth/register')
        .send({ name: 'Weak', email, password, otp: code });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details[0].path).toBe('password');
    }
    const bad = await h.request.post('/api/auth/otp/request').send({ email: 'not-an-email' });
    expect(bad.body.error.details[0]).toMatchObject({ path: 'email', message: expect.any(String) });
  });
});

describe('login and sessions', () => {
  let h;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => h.stop());

  it('logs in patients, doctors and the admin and rejects bad credentials uniformly', async () => {
    const patient = await h.patientSession('login@example.com');
    const doctor = await h.doctor();

    const p = await h.request
      .post('/api/auth/login')
      .send({ email: 'LOGIN@example.com', password: PASSWORD, role: 'patient' });
    expect(p.status).toBe(200);
    expect(p.body.data.user).toMatchObject({ id: patient.id, role: 'patient' });

    const d = await h.request
      .post('/api/auth/login')
      .send({ email: doctor.email, password: PASSWORD, role: 'doctor' });
    expect(d.body.data.user).toMatchObject({ id: doctor.id, role: 'doctor' });

    const a = await h.request.post('/api/auth/login').send({ ...ADMIN, role: 'admin' });
    expect(a.body.data.user).toMatchObject({ id: 'admin', role: 'admin', email: ADMIN.email });

    const cases = [
      { email: 'login@example.com', password: 'wrong-password1', role: 'patient' },
      { email: 'ghost@example.com', password: PASSWORD, role: 'patient' },
      { email: 'login@example.com', password: PASSWORD, role: 'doctor' },
      { email: doctor.email, password: PASSWORD, role: 'patient' },
      { email: ADMIN.email, password: 'nope-nope-1', role: 'admin' },
      { email: 'other@example.com', password: ADMIN.password, role: 'admin' },
    ];
    for (const body of cases) {
      const res = await h.request.post('/api/auth/login').send(body);
      expect(res.status, JSON.stringify(body)).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    }
  });

  it('never embeds the admin password or hash in the access token', async () => {
    const { session } = await h.adminSession();
    const decoded = jwt.decode(session.accessToken);
    expect(Object.keys(decoded).sort()).toEqual(['exp', 'iat', 'role', 'sub']);
    expect(decoded).toMatchObject({ sub: 'admin', role: 'admin' });
    expect(session.accessToken).not.toContain(ADMIN.password);
    expect(decoded.exp - decoded.iat).toBe(15 * 60);
  });

  it('serves /auth/me for every role and rejects missing or malformed tokens', async () => {
    const patient = await h.patientSession();
    const me = await h.request.get('/api/auth/me').set(h.bearer(patient.token));
    expect(me.body.data).toMatchObject({ id: patient.id, role: 'patient' });

    const none = await h.request.get('/api/auth/me');
    expect(none.status).toBe(401);
    expect(none.body.error.code).toBe('UNAUTHORIZED');
    const junk = await h.request.get('/api/auth/me').set('Authorization', 'Bearer not.a.jwt');
    expect(junk.body.error.code).toBe('UNAUTHORIZED');
    const scheme = await h.request.get('/api/auth/me').set('Authorization', `Basic ${patient.token}`);
    expect(scheme.status).toBe(401);
  });

  it('rejects tokens signed with another secret or algorithm', async () => {
    const forged = jwt.sign({ role: 'admin' }, 'some-other-secret-value', { subject: 'admin' });
    expect((await h.request.get('/api/auth/me').set(h.bearer(forged))).status).toBe(401);
    const none = jwt.sign({ role: 'admin', sub: 'admin' }, '', { algorithm: 'none' });
    expect((await h.request.get('/api/auth/me').set(h.bearer(none))).status).toBe(401);
  });

  it('returns TOKEN_EXPIRED distinctly for an expired access token', async () => {
    const patient = await h.patientSession();
    const expired = jwt.sign({ role: 'patient' }, h.config.jwt.accessSecret, {
      subject: patient.id,
      expiresIn: -10,
    });
    const res = await h.request.get('/api/auth/me').set(h.bearer(expired));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('enforces role guards with FORBIDDEN', async () => {
    const patient = await h.patientSession();
    const res = await h.request.get('/api/admin/settings').set(h.bearer(patient.token));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('refresh token lifecycle', () => {
  let h;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => h.stop());

  it('stores only hashes and rotates on every refresh', async () => {
    const patient = await h.patientSession();
    const stored = await RefreshToken.findOne({ userId: patient.id }).lean();
    expect(stored.tokenHash).toBe(sha256(patient.refreshToken));
    expect(JSON.stringify(stored)).not.toContain(patient.refreshToken);

    const refreshed = await h.request.post('/api/auth/refresh').send({ refreshToken: patient.refreshToken });
    expect(refreshed.status).toBe(200);
    const next = refreshed.body.data;
    expect(next.refreshToken).not.toBe(patient.refreshToken);
    expect(next.user.id).toBe(patient.id);
    const me = await h.request.get('/api/auth/me').set(h.bearer(next.accessToken));
    expect(me.status).toBe(200);
    expect(await RefreshToken.countDocuments({ userId: patient.id, revokedAt: null })).toBe(1);
  });

  it('revokes every token of the account when a rotated token is reused', async () => {
    const patient = await h.patientSession();
    const first = await h.request.post('/api/auth/refresh').send({ refreshToken: patient.refreshToken });
    const second = await h.request
      .post('/api/auth/refresh')
      .send({ refreshToken: first.body.data.refreshToken });
    expect(second.status).toBe(200);

    const replay = await h.request.post('/api/auth/refresh').send({ refreshToken: patient.refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('UNAUTHORIZED');

    const legitimate = await h.request
      .post('/api/auth/refresh')
      .send({ refreshToken: second.body.data.refreshToken });
    expect(legitimate.status).toBe(401);
    expect(await RefreshToken.countDocuments({ userId: patient.id, revokedAt: null })).toBe(0);
  });

  it('lets only one of several concurrent refreshes with the same token succeed', async () => {
    const patient = await h.patientSession();
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        h.request.post('/api/auth/refresh').send({ refreshToken: patient.refreshToken }),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 401)).toHaveLength(4);
  });

  it('rejects unknown, expired and malformed refresh tokens', async () => {
    const unknown = await h.request.post('/api/auth/refresh').send({ refreshToken: 'x'.repeat(64) });
    expect(unknown.status).toBe(401);
    expect((await h.request.post('/api/auth/refresh').send({ refreshToken: 'short' })).status).toBe(400);

    const patient = await h.patientSession();
    h.clock.advance(8 * 86_400_000);
    const expired = await h.request.post('/api/auth/refresh').send({ refreshToken: patient.refreshToken });
    expect(expired.status).toBe(401);
    h.clock.advance(-8 * 86_400_000);
  });

  it('logs out by revoking the token, and a second logout is harmless', async () => {
    const patient = await h.patientSession();
    const out = await h.request.post('/api/auth/logout').send({ refreshToken: patient.refreshToken });
    expect(out.body).toEqual({ success: true, data: null });
    await h.request.post('/api/auth/logout').send({ refreshToken: patient.refreshToken }).expect(200);
    const res = await h.request.post('/api/auth/refresh').send({ refreshToken: patient.refreshToken });
    expect(res.status).toBe(401);
  });

  it('blocks refresh and API access for a blocked patient and revokes their tokens', async () => {
    const admin = await h.adminSession();
    const patient = await h.patientSession();
    const block = await h.request
      .patch(`/api/admin/patients/${patient.id}/block`)
      .set(h.bearer(admin.token))
      .send({ blocked: true });
    expect(block.status).toBe(200);
    expect(block.body.data.blocked).toBe(true);
    expect(await RefreshToken.countDocuments({ userId: patient.id, revokedAt: null })).toBe(0);

    const refresh = await h.request.post('/api/auth/refresh').send({ refreshToken: patient.refreshToken });
    expect(refresh.status).toBe(403);
    expect(refresh.body.error.code).toBe('ACCOUNT_BLOCKED');
    const api = await h.request.get('/api/auth/me').set(h.bearer(patient.token));
    expect(api.status).toBe(403);
    expect(api.body.error.code).toBe('ACCOUNT_BLOCKED');
    const login = await h.request
      .post('/api/auth/login')
      .send({ email: patient.email, password: PASSWORD, role: 'patient' });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('ACCOUNT_BLOCKED');

    await h.request
      .patch(`/api/admin/patients/${patient.id}/block`)
      .set(h.bearer(admin.token))
      .send({ blocked: false })
      .expect(200);
    await h.request
      .post('/api/auth/login')
      .send({ email: patient.email, password: PASSWORD, role: 'patient' })
      .expect(200);
  });

  it('revokes tokens and blocks login when a doctor is deactivated', async () => {
    const admin = await h.adminSession();
    const doctor = await h.doctorSession();
    await h.request
      .patch(`/api/admin/doctors/${doctor.id}/active`)
      .set(h.bearer(admin.token))
      .send({ active: false })
      .expect(200);
    expect(await RefreshToken.countDocuments({ userId: doctor.id, revokedAt: null })).toBe(0);
    const refresh = await h.request
      .post('/api/auth/refresh')
      .send({ refreshToken: doctor.session.refreshToken });
    expect(refresh.status).toBe(403);
    expect(refresh.body.error.code).toBe('ACCOUNT_BLOCKED');
    const login = await h.request
      .post('/api/auth/login')
      .send({ email: doctor.email, password: PASSWORD, role: 'doctor' });
    expect(login.body.error.code).toBe('ACCOUNT_BLOCKED');
    expect((await h.request.get('/api/doctor/profile').set(h.bearer(doctor.token))).status).toBe(403);
  });
});

describe('password reset', () => {
  let h;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => h.stop());

  const tokenFrom = (message) => /token=([\w-]+)&role=(\w+)/.exec(message.text);

  it('answers identically for known and unknown emails but only mails real accounts', async () => {
    const patient = await h.patientSession('forgot@example.com');
    const known = await h.request
      .post('/api/auth/password/forgot')
      .send({ email: patient.email, role: 'patient' });
    const unknown = await h.request
      .post('/api/auth/password/forgot')
      .send({ email: 'nobody@example.com', role: 'patient' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    expect(h.container.mailer.outbox.filter((m) => m.subject.includes('Reset'))).toHaveLength(1);
  });

  it('resets once with a single-use token, revokes sessions and uses the right app url', async () => {
    const patient = await h.patientSession('reset@example.com');
    await h.request.post('/api/auth/password/forgot').send({ email: patient.email, role: 'patient' });
    const mail = h.container.mailer.outbox.findLast((m) => m.to === patient.email);
    expect(mail.text).toContain(`${h.config.appUrls.patient}/reset-password?token=`);
    const [, token, role] = tokenFrom(mail);
    expect(role).toBe('patient');
    expect(await PasswordReset.findOne({ tokenHash: sha256(token) })).toBeTruthy();
    expect(await PasswordReset.findOne({ tokenHash: token })).toBeNull();

    const weak = await h.request.post('/api/auth/password/reset').send({ token, password: 'weak' });
    expect(weak.status).toBe(400);

    const reset = await h.request
      .post('/api/auth/password/reset')
      .send({ token, password: 'Brand-new-pass1' });
    expect(reset.body).toEqual({ success: true, data: null });
    const reuse = await h.request.post('/api/auth/password/reset').send({ token, password: 'Another-pass1' });
    expect(reuse.status).toBe(400);

    expect(
      (await h.request.post('/api/auth/refresh').send({ refreshToken: patient.refreshToken })).status,
    ).toBe(401);
    expect(
      (
        await h.request
          .post('/api/auth/login')
          .send({ email: patient.email, password: PASSWORD, role: 'patient' })
      ).status,
    ).toBe(401);
    expect(
      (
        await h.request
          .post('/api/auth/login')
          .send({ email: patient.email, password: 'Brand-new-pass1', role: 'patient' })
      ).status,
    ).toBe(200);
  });

  it('sends doctors a link to the staff app and expires tokens after 30 minutes', async () => {
    const doctor = await h.doctor();
    await h.request.post('/api/auth/password/forgot').send({ email: doctor.email, role: 'doctor' });
    const mail = h.container.mailer.outbox.findLast((m) => m.to === doctor.email);
    expect(mail.text).toContain(`${h.config.appUrls.admin}/reset-password?token=`);
    const [, token] = tokenFrom(mail);
    h.clock.advance(31 * 60_000);
    const res = await h.request.post('/api/auth/password/reset').send({ token, password: 'Brand-new-pass1' });
    expect(res.status).toBe(400);
  });

  it('does not accept admin as a role for password reset', async () => {
    const res = await h.request.post('/api/auth/password/forgot').send({ email: ADMIN.email, role: 'admin' });
    expect(res.status).toBe(400);
  });
});

describe('Google sign-in', () => {
  it('answers 400 BAD_REQUEST when Google is not configured', async () => {
    const h = await startHarness();
    const res = await h.request.post('/api/auth/google').send({ credential: 'a-google-credential' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'BAD_REQUEST',
      message: expect.stringMatching(/not configured/i),
    });
    await h.stop();
  });

  it('creates a patient on first sign-in, links existing accounts and rejects bad credentials', async () => {
    const profile = {
      sub: 'g-1',
      email: 'Gina@Example.com',
      emailVerified: true,
      name: 'Gina G',
      picture: 'https://img.example/g.png',
    };
    const googleVerifier = async (credential) => {
      if (credential === 'bad-credential-value') throw new Error('invalid token');
      if (credential === 'unverified-credential') return { ...profile, emailVerified: false };
      return profile;
    };
    const h = await startHarness({ overrides: { googleVerifier } });

    const first = await h.request.post('/api/auth/google').send({ credential: 'good-credential-value' });
    expect(first.status).toBe(200);
    expect(first.body.data.user).toMatchObject({
      name: 'Gina G',
      email: 'gina@example.com',
      role: 'patient',
      image: profile.picture,
    });
    const again = await h.request.post('/api/auth/google').send({ credential: 'good-credential-value' });
    expect(again.body.data.user.id).toBe(first.body.data.user.id);
    expect(await Patient.countDocuments({ email: 'gina@example.com' })).toBe(1);

    const passwordLogin = await h.request
      .post('/api/auth/login')
      .send({ email: 'gina@example.com', password: PASSWORD, role: 'patient' });
    expect(passwordLogin.status).toBe(401);

    expect(
      (await h.request.post('/api/auth/google').send({ credential: 'bad-credential-value' })).status,
    ).toBe(401);
    expect(
      (await h.request.post('/api/auth/google').send({ credential: 'unverified-credential' })).status,
    ).toBe(401);

    const taken = await h.request.post('/api/auth/otp/request').send({ email: 'gina@example.com' });
    expect(taken.body.error.code).toBe('EMAIL_TAKEN');
    await h.stop();
  });
});

describe('auth rate limiting', () => {
  it('answers 429 RATE_LIMITED after the per-IP budget is spent, only on /auth', async () => {
    const h = await startHarness({ env: { AUTH_RATE_LIMIT_MAX: '3' } });
    const attempt = () =>
      h.request
        .post('/api/auth/login')
        .send({ email: 'a@example.com', password: 'whatever1', role: 'patient' });
    for (let i = 0; i < 3; i += 1) expect((await attempt()).status).toBe(401);
    const limited = await attempt();
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect((await h.request.get('/api/doctors')).status).toBe(200);
    await h.stop();
  });
});
