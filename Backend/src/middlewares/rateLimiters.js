import { rateLimit } from 'express-rate-limit';
import { AppError } from '../utils/AppError.js';

export const createAuthLimiter = ({ authRateLimit }) =>
  rateLimit({
    windowMs: authRateLimit.windowMs,
    limit: authRateLimit.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AppError('RATE_LIMITED', 'Too many requests, please try again later')),
  });
