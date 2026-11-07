export const ERROR_MESSAGES = {
  VALIDATION_ERROR: 'Some fields are invalid. Please review the form.',
  BAD_REQUEST: 'The request could not be processed.',
  UNAUTHORIZED: 'Please sign in to continue.',
  TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
  INVALID_CREDENTIALS: 'Incorrect email or password.',
  FORBIDDEN: 'You do not have permission to do that.',
  ACCOUNT_BLOCKED: 'This account has been deactivated. Contact an administrator.',
  NOT_FOUND: 'We could not find what you were looking for.',
  CONFLICT: 'This conflicts with existing data.',
  SLOT_TAKEN: 'That slot was just taken.',
  EMAIL_TAKEN: 'That email address is already in use.',
  ALREADY_REVIEWED: 'This appointment has already been reviewed.',
  INVALID_STATE: 'That action is not allowed for the appointment in its current state.',
  CANCELLATION_WINDOW_PASSED: 'The cancellation window has passed.',
  RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
  INTERNAL: 'Something went wrong on our side. Please try again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection.',
}

export function messageFor(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback
  if (error.code === 'VALIDATION_ERROR' && error.details?.length) {
    return error.details.map((d) => (d.path ? `${d.path}: ${d.message}` : d.message)).join('; ')
  }
  return error.message || ERROR_MESSAGES[error.code] || fallback
}

export function fieldErrors(error) {
  const out = {}
  for (const d of error?.details ?? []) if (d.path && !out[d.path]) out[d.path] = d.message
  return out
}
