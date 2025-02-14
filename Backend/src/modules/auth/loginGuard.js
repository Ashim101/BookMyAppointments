import { AppError } from '../../utils/AppError.js';
import { sha256 } from '../../utils/crypto.js';
import { LoginAttempt } from './auth.models.js';

/**
 * Per-account brute force protection that complements the per-IP limiter on /auth:
 * after `maxFailures` wrong passwords the account (role + email) is locked for a while.
 * Keys are hashed so unknown emails are never stored in clear text.
 */
export function createLoginGuard({ config, clock }) {
  const { maxFailures, durationMs } = config.loginLockout;
  const keyFor = (role, email) => sha256(`${role}:${email}`);

  async function assertNotLocked(role, email) {
    const record = await LoginAttempt.findOne({ key: keyFor(role, email) }).lean();
    const remaining = record?.lockedUntil ? record.lockedUntil.getTime() - clock.now() : 0;
    if (remaining > 0) {
      const minutes = Math.ceil(remaining / 60_000);
      throw new AppError(
        'RATE_LIMITED',
        `Too many failed sign-in attempts. Try again in ${minutes} minute(s).`,
      );
    }
  }

  async function recordFailure(role, email) {
    const now = new Date(clock.now());
    const record = await LoginAttempt.findOneAndUpdate(
      { key: keyFor(role, email) },
      { $inc: { failures: 1 }, $set: { updatedAt: now } },
      { upsert: true, returnDocument: 'after' },
    );
    if (record.failures >= maxFailures) {
      await LoginAttempt.updateOne(
        { _id: record._id },
        { $set: { failures: 0, lockedUntil: new Date(now.getTime() + durationMs) } },
      );
    }
  }

  const recordSuccess = (role, email) => LoginAttempt.deleteOne({ key: keyFor(role, email) });

  return { assertNotLocked, recordFailure, recordSuccess };
}
