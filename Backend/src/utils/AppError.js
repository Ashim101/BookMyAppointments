const STATUS_BY_CODE = {
  VALIDATION_ERROR: 400,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  TOKEN_EXPIRED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  ACCOUNT_BLOCKED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SLOT_TAKEN: 409,
  EMAIL_TAKEN: 409,
  ALREADY_REVIEWED: 409,
  INVALID_STATE: 422,
  OTP_INVALID: 422,
  OTP_EXPIRED: 422,
  PAYMENT_INVALID: 422,
  SLOT_UNAVAILABLE: 422,
  CANCELLATION_WINDOW_PASSED: 422,
  RATE_LIMITED: 429,
  OTP_COOLDOWN: 429,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code] ?? 500;
    this.details = details;
  }
}

export const notFound = (what = 'Resource') => new AppError('NOT_FOUND', `${what} not found`);
export const badRequest = (message, details) => new AppError('BAD_REQUEST', message, details);
export const forbidden = (message = 'You do not have access to this resource') => new AppError('FORBIDDEN', message);
export const unauthorized = (message = 'Authentication required') => new AppError('UNAUTHORIZED', message);
export const invalidState = (message) => new AppError('INVALID_STATE', message);
