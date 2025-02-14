import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';
import { sha256 } from '../utils/crypto.js';

const KEY_PATTERN = /^[\w-]{8,64}$/;

const idempotencySchema = new mongoose.Schema({
  owner: { type: String, required: true },
  key: { type: String, required: true },
  requestHash: { type: String, required: true },
  state: { type: String, enum: ['pending', 'done'], default: 'pending' },
  status: Number,
  body: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
});
idempotencySchema.index({ owner: 1, key: 1 }, { unique: true });
idempotencySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86_400 });

export const IdempotencyKey = mongoose.model('IdempotencyKey', idempotencySchema);

/**
 * Makes a POST safe to retry. A client that sends an `Idempotency-Key` header gets the stored
 * response replayed instead of a second booking; the same key with a different body is rejected.
 * Only successful responses are kept, so a failed attempt can simply be retried.
 */
export function idempotent(req, res, next) {
  const key = req.get('idempotency-key');
  if (!key) return next();
  if (!KEY_PATTERN.test(key)) {
    return next(new AppError('VALIDATION_ERROR', 'Invalid Idempotency-Key', [{ path: 'Idempotency-Key', message: 'Use 8 to 64 letters, digits, dashes or underscores' }]));
  }
  return handle(req, res, next, { owner: req.user.id, key }).catch(next);
}

async function handle(req, res, next, scope) {
  const requestHash = sha256(JSON.stringify(req.valid?.body ?? req.body ?? {}));
  try {
    await IdempotencyKey.create({ ...scope, requestHash });
  } catch (err) {
    if (err.code !== 11000) throw err;
    const previous = await IdempotencyKey.findOne(scope).lean();
    if (!previous) return next(new AppError('CONFLICT', 'Please retry the request'));
    if (previous.requestHash !== requestHash) {
      return next(new AppError('BAD_REQUEST', 'This Idempotency-Key was already used with a different request'));
    }
    if (previous.state !== 'done') return next(new AppError('CONFLICT', 'A request with this Idempotency-Key is still being processed'));
    res.setHeader('Idempotent-Replay', 'true');
    return res.status(previous.status).json(previous.body);
  }

  const json = res.json.bind(res);
  res.json = (payload) => {
    const outcome = res.statusCode < 400
      ? IdempotencyKey.updateOne(scope, { $set: { state: 'done', status: res.statusCode, body: payload } })
      : IdempotencyKey.deleteOne(scope);
    outcome.finally(() => json(payload));
    return res;
  };
  return next();
}
