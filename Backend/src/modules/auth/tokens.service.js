import jwt from 'jsonwebtoken';
import { unauthorized } from '../../utils/AppError.js';
import { randomToken, sha256 } from '../../utils/crypto.js';
import { RefreshToken } from './auth.models.js';

/**
 * Access tokens are short-lived JWTs (`sub`, `role`). Refresh tokens are opaque,
 * stored only as a SHA-256 hash, rotated on every use, and any attempt to reuse
 * a rotated token revokes every refresh token of that account.
 */
export function createTokenService({ config, clock }) {
  const signAccessToken = (principal) =>
    jwt.sign({ role: principal.role }, config.jwt.accessSecret, {
      subject: principal.id,
      expiresIn: config.jwt.accessTtl,
      algorithm: 'HS256',
    });

  async function issue(principal, { family = randomToken(12), ip } = {}) {
    const refreshToken = randomToken(48);
    await RefreshToken.create({
      userId: principal.id,
      role: principal.role,
      family,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(clock.now() + config.jwt.refreshTtlDays * 86_400_000),
      ip,
    });
    return { accessToken: signAccessToken(principal), refreshToken };
  }

  const revokeAll = (userId, role) =>
    RefreshToken.updateMany(
      { userId: String(userId), role, revokedAt: null },
      { $set: { revokedAt: new Date(clock.now()) } },
    );

  /** Atomically consumes a refresh token. Returns the owner and token family. */
  async function consume(refreshToken) {
    const tokenHash = sha256(refreshToken);
    const now = new Date(clock.now());
    const record = await RefreshToken.findOneAndUpdate(
      { tokenHash, revokedAt: null, expiresAt: { $gt: now } },
      { $set: { revokedAt: now } },
      { returnDocument: 'after' },
    );
    if (record) return { userId: record.userId, role: record.role, family: record.family };

    // The owner is attached so callers can report a blocked account instead of a generic failure.
    const stale = await RefreshToken.findOne({ tokenHash });
    const failure = (message) =>
      Object.assign(unauthorized(message), { owner: stale && { userId: stale.userId, role: stale.role } });
    if (stale?.revokedAt) {
      await revokeAll(stale.userId, stale.role);
      throw failure('Refresh token was already used. Please sign in again.');
    }
    throw failure('Invalid or expired refresh token');
  }

  const revoke = (refreshToken) =>
    RefreshToken.updateOne(
      { tokenHash: sha256(refreshToken), revokedAt: null },
      { $set: { revokedAt: new Date(clock.now()) } },
    );

  return { issue, consume, revoke, revokeAll };
}
