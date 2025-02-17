export const ERROR_MESSAGES = {
  VALIDATION_ERROR: 'Some details are not valid. Please check the form and try again.',
  BAD_REQUEST: 'That request could not be understood. Please try again.',
  UNAUTHORIZED: 'Please sign in to continue.',
  TOKEN_EXPIRED: 'Your session expired. Please sign in again.',
  INVALID_CREDENTIALS: 'The email or password is incorrect.',
  FORBIDDEN: 'You do not have permission to do that.',
  ACCOUNT_BLOCKED: 'Your account has been blocked. Please contact support.',
  NOT_FOUND: 'We could not find what you were looking for.',
  CONFLICT: 'That conflicts with existing data. Please refresh and try again.',
  SLOT_TAKEN: 'Someone else just booked that time. Please pick another slot.',
  EMAIL_TAKEN: 'An account with this email already exists. Try signing in instead.',
  ALREADY_REVIEWED: 'You have already reviewed this appointment.',
  INVALID_STATE: 'This appointment can no longer be changed in that way.',
  OTP_INVALID: 'That verification code is not correct.',
  OTP_EXPIRED: 'That verification code has expired. Please request a new one.',
  PAYMENT_INVALID: 'We could not verify your payment. Please try again.',
  SLOT_UNAVAILABLE: 'That time is no longer available. Please pick another slot.',
  CANCELLATION_WINDOW_PASSED: 'It is too late to change this appointment online. Please contact the clinic.',
  RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
  OTP_COOLDOWN: 'Please wait before requesting another code.',
  INTERNAL: 'Something went wrong on our side. Please try again shortly.',
  NETWORK_ERROR: 'We could not reach the server. Check your connection and try again.',
}

export function errorMessage(error, fallback = ERROR_MESSAGES.INTERNAL) {
  if (!error) return fallback
  return ERROR_MESSAGES[error.code] || error.message || fallback
}

export function fieldErrors(error) {
  const out = {}
  if (error?.code !== 'VALIDATION_ERROR' || !Array.isArray(error.details)) return out
  for (const { path, message } of error.details) {
    if (path && !out[path]) out[path] = message
  }
  return out
}
