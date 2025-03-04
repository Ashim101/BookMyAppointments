import { rateLimit } from 'express-rate-limit';
import { AppError } from '../utils/AppError.js';

const limiter = ({ windowMs, max }, extra = {}) =>
  rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AppError('RATE_LIMITED', 'Too many requests, please try again later')),
    ...extra,
  });

/** Strict per-IP budget for the credential endpoints. */
export const createAuthLimiter = ({ authRateLimit }) => limiter(authRateLimit);

/** Generous per-IP budget for the whole API; the health probe is exempt so orchestrators never get throttled. */
export const createApiLimiter = ({ apiRateLimit }) =>
  limiter(apiRateLimit, { skip: (req) => req.path === '/health' });
