import multer from 'multer';
import { AppError } from '../utils/AppError.js';

const fail = (res, status, code, message, details) =>
  res.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) } });

function normalize(err) {
  if (err instanceof AppError) return err;
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 2 MB or smaller' : 'Invalid file upload';
    return new AppError('VALIDATION_ERROR', message, [{ path: err.field ?? 'image', message }]);
  }
  if (err.type === 'entity.parse.failed') return new AppError('BAD_REQUEST', 'Request body is not valid JSON');
  if (err.type === 'entity.too.large') return new AppError('BAD_REQUEST', 'Request body is too large');
  if (err.code === 11000) return new AppError('CONFLICT', 'A record with these values already exists');
  if (err.name === 'CastError') return new AppError('NOT_FOUND', 'Resource not found');
  return null;
}

export const notFoundHandler = (req, res) =>
  fail(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`);

export const createErrorHandler = (logger) =>
  // Express identifies error handlers by their four-argument signature.
  // eslint-disable-next-line no-unused-vars
  (err, req, res, _next) => {
    const known = normalize(err);
    if (known) return fail(res, known.status, known.code, known.message, known.details);
    logger.error({ err, requestId: req.id }, 'unhandled error');
    return fail(res, 500, 'INTERNAL', 'Something went wrong. Please try again later.');
  };
