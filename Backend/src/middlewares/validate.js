import { AppError } from '../utils/AppError.js';

const SOURCES = ['params', 'query', 'body'];

/**
 * Validates request parts with zod schemas. Parsed (coerced, defaulted) values
 * are exposed on `req.valid`; the raw request objects are left untouched.
 */
export const validate = (schemas) => (req, _res, next) => {
  const valid = {};
  const details = [];
  for (const source of SOURCES) {
    if (!schemas[source]) continue;
    const result = schemas[source].safeParse(req[source] ?? {});
    if (result.success) {
      valid[source] = result.data;
    } else {
      for (const issue of result.error.issues) {
        details.push({ path: issue.path.join('.'), message: issue.message });
      }
    }
  }
  if (details.length > 0) return next(new AppError('VALIDATION_ERROR', 'Request validation failed', details));
  req.valid = valid;
  return next();
};
