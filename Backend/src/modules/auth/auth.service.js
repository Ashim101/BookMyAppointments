import bcrypt from 'bcrypt';
import { AppError, badRequest, unauthorized } from '../../utils/AppError.js';
import { randomToken, safeEqual, sha256 } from '../../utils/crypto.js';
import { Doctor } from '../doctors/doctor.model.js';
import { resetEmail } from '../notifications/templates.js';
import { Patient } from '../patients/patient.model.js';
import { PasswordReset } from './auth.models.js';
import { toAuthUser } from './principals.js';

const RESET_TTL_MS = 30 * 60_000;
const MODELS = { patient: Patient, doctor: Doctor };

export function createAuthService({ config, clock, tokens, otp, principals, loginGuard, mailer, googleVerifier, logger }) {
  const invalidCredentials = () => new AppError('INVALID_CREDENTIALS', 'Incorrect email or password');
  let decoyHash;

  /** Compares against a throwaway hash when the account is unknown so response time does not reveal it. */
  async function checkPassword(password, hash) {
    if (hash) return bcrypt.compare(password, hash);
    decoyHash ??= await bcrypt.hash(randomToken(8), config.bcryptRounds);
    await bcrypt.compare(password, decoyHash);
    return false;
  }

  async function startSession(principal, meta, family) {
    const issued = await tokens.issue(principal, { ip: meta.ip, family });
    return { ...issued, user: toAuthUser(principal) };
  }

  const patientPrincipal = (patient) => ({
    id: String(patient._id),
    role: 'patient',
    name: patient.name,
    email: patient.email,
    image: patient.image,
  });

  async function register({ name, email, password, otp: code }, meta) {
    if (await Patient.exists({ email })) throw new AppError('EMAIL_TAKEN', 'An account with this email already exists');
    await otp.verify(email, code);
    try {
      const patient = await Patient.create({ name, email, passwordHash: await bcrypt.hash(password, config.bcryptRounds) });
      return startSession(patientPrincipal(patient), meta);
    } catch (err) {
      if (err.code === 11000) throw new AppError('EMAIL_TAKEN', 'An account with this email already exists');
      throw err;
    }
  }

  async function loginAdmin(email, password) {
    const { admin } = config;
    const matches = admin.email && admin.passwordHash && safeEqual(email, admin.email);
    const valid = await checkPassword(password, matches ? admin.passwordHash : null);
    if (!valid) throw invalidCredentials();
    return principals.admin;
  }

  async function loginAccount(role, email, password) {
    const account = await MODELS[role].findOne({ email }).select('+passwordHash');
    if (!(await checkPassword(password, account?.passwordHash))) throw invalidCredentials();
    return principals.load(role, String(account._id));
  }

  async function login({ email, password, role }, meta) {
    await loginGuard.assertNotLocked(role, email);
    let principal;
    try {
      principal = role === 'admin' ? await loginAdmin(email, password) : await loginAccount(role, email, password);
    } catch (err) {
      if (err.code === 'INVALID_CREDENTIALS') await loginGuard.recordFailure(role, email);
      throw err;
    }
    await loginGuard.recordSuccess(role, email);
    return startSession(principal, meta);
  }

  async function google({ credential }, meta) {
    if (!googleVerifier) throw badRequest('Google sign-in is not configured');
    let profile;
    try {
      profile = await googleVerifier(credential);
    } catch (err) {
      logger.warn({ err }, 'google credential rejected');
      throw unauthorized('Invalid Google credential');
    }
    if (!profile.emailVerified) throw unauthorized('Google account email is not verified');

    const email = profile.email.toLowerCase();
    let patient = await Patient.findOne({ $or: [{ googleId: profile.sub }, { email }] });
    if (!patient) {
      patient = await Patient.create({ name: profile.name, email, googleId: profile.sub, image: profile.picture });
    } else if (!patient.googleId) {
      patient.googleId = profile.sub;
      await patient.save();
    }
    return startSession(await principals.load('patient', String(patient._id)), meta);
  }

  async function refresh({ refreshToken }, meta) {
    let consumed;
    try {
      consumed = await tokens.consume(refreshToken);
    } catch (err) {
      if (err.owner) await principals.load(err.owner.role, err.owner.userId);
      throw err;
    }
    const { userId, role, family } = consumed;
    let principal;
    try {
      principal = await principals.load(role, userId);
    } catch (err) {
      await tokens.revokeAll(userId, role);
      throw err;
    }
    if (!principal) {
      await tokens.revokeAll(userId, role);
      throw unauthorized('Account no longer exists');
    }
    return startSession(principal, meta, family);
  }

  async function logout({ refreshToken }) {
    await tokens.revoke(refreshToken);
    return null;
  }

  async function forgotPassword({ email, role }) {
    const account = await MODELS[role].findOne({ email }).select('_id');
    if (!account) return null;
    const token = randomToken(32);
    await PasswordReset.create({
      userId: String(account._id),
      role,
      tokenHash: sha256(token),
      expiresAt: new Date(clock.now() + RESET_TTL_MS),
    });
    const base = role === 'doctor' ? config.appUrls.admin : config.appUrls.patient;
    const link = `${base}/reset-password?token=${token}&role=${role}`;
    // Failures are logged, never surfaced: the endpoint must answer identically for every email.
    await mailer.send({ to: email, ...resetEmail(link) }).catch((err) => logger.error({ err }, 'password reset email failed'));
    return null;
  }

  async function resetPassword({ token, password }) {
    const now = new Date(clock.now());
    const reset = await PasswordReset.findOneAndUpdate(
      { tokenHash: sha256(token), usedAt: null, expiresAt: { $gt: now } },
      { $set: { usedAt: now } },
    );
    if (!reset) throw badRequest('This reset link is invalid or has expired');
    await MODELS[reset.role].updateOne({ _id: reset.userId }, { $set: { passwordHash: await bcrypt.hash(password, config.bcryptRounds) } });
    await tokens.revokeAll(reset.userId, reset.role);
    return null;
  }

  return { requestOtp: ({ email }) => otp.request(email), register, login, google, refresh, logout, forgotPassword, resetPassword };
}
