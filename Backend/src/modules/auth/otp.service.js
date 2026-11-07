import { AppError } from '../../utils/AppError.js';
import { generateOtp, hmacSha256, safeEqual } from '../../utils/crypto.js';
import { otpEmail } from '../notifications/templates.js';
import { Patient } from '../patients/patient.model.js';
import { Otp } from './auth.models.js';

export const OTP_TTL_SECONDS = 600;
export const OTP_RESEND_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;

/** Email one-time codes: hashed at rest, single use, attempt limited and rate limited per address. */
export function createOtpService({ config, clock, mailer }) {
  const hash = (email, code) => hmacSha256(config.jwt.refreshSecret, `${email}:${code}`);

  async function request(email) {
    if (await Patient.exists({ email }))
      throw new AppError('EMAIL_TAKEN', 'An account with this email already exists');

    const now = new Date(clock.now());
    const code = generateOtp();
    try {
      // The cooldown is enforced by the filter: a recent record makes the upsert collide on the unique email.
      await Otp.findOneAndUpdate(
        { email, lastSentAt: { $lte: new Date(now.getTime() - OTP_RESEND_SECONDS * 1000) } },
        {
          $set: {
            codeHash: hash(email, code),
            attempts: 0,
            lastSentAt: now,
            expiresAt: new Date(now.getTime() + OTP_TTL_SECONDS * 1000),
          },
        },
        { upsert: true },
      );
    } catch (err) {
      if (err.code !== 11000) throw err;
      const previous = await Otp.findOne({ email }).select('lastSentAt').lean();
      const waitMs = previous ? previous.lastSentAt.getTime() + OTP_RESEND_SECONDS * 1000 - now.getTime() : 0;
      throw new AppError(
        'OTP_COOLDOWN',
        `Please wait ${OTP_RESEND_SECONDS} seconds before requesting another code`,
      ).withRetryAfter(waitMs > 0 ? waitMs / 1000 : OTP_RESEND_SECONDS);
    }
    await mailer.send({ to: email, ...otpEmail(code, OTP_TTL_SECONDS / 60) });
    return { expiresInSeconds: OTP_TTL_SECONDS, resendAfterSeconds: OTP_RESEND_SECONDS };
  }

  /** Verifies and consumes a code; throws OTP_INVALID / OTP_EXPIRED otherwise. */
  async function verify(email, code) {
    const record = await Otp.findOneAndUpdate(
      { email, attempts: { $lt: OTP_MAX_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { returnDocument: 'after' },
    );
    if (!record) {
      const exists = await Otp.exists({ email });
      throw new AppError(
        'OTP_INVALID',
        exists ? 'Too many attempts. Request a new code.' : 'No code was requested for this email',
      );
    }
    if (record.expiresAt.getTime() <= clock.now())
      throw new AppError('OTP_EXPIRED', 'This code has expired. Request a new one.');
    if (!safeEqual(record.codeHash, hash(email, code)))
      throw new AppError('OTP_INVALID', 'The code is incorrect');

    const consumed = await Otp.findOneAndDelete({ _id: record._id, codeHash: record.codeHash });
    if (!consumed) throw new AppError('OTP_INVALID', 'The code has already been used');
  }

  return { request, verify };
}
