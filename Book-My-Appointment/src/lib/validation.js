import { IMAGE_TYPES, MAX_IMAGE_BYTES } from './config'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_RE = /^\+?[0-9][0-9\s-]{6,17}$/
export const GENDERS = ['unspecified', 'male', 'female', 'other']

export function validateEmail(email) {
  if (!email?.trim()) return 'Email is required'
  return EMAIL_RE.test(email.trim()) ? '' : 'Enter a valid email address'
}

export function validatePassword(password) {
  if (!password) return 'Password is required'
  if (password.length < 8) return 'Use at least 8 characters'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Include at least one letter and one digit'
  return ''
}

export function validateName(name) {
  const value = name?.trim() ?? ''
  if (value.length < 2) return 'Enter your full name'
  return value.length > 80 ? 'Name is too long (80 characters max)' : ''
}

export function validatePhone(phone) {
  if (!phone?.trim()) return ''
  return PHONE_RE.test(phone.trim()) ? '' : 'Enter a valid phone number'
}

export function validateDob(dob, today = new Date().toISOString().slice(0, 10)) {
  if (!dob) return ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(Date.parse(dob))) return 'Enter a valid date'
  if (dob > today) return 'Date of birth cannot be in the future'
  return dob < '1900-01-01' ? 'Enter a valid date' : ''
}

export function validateOtp(otp) {
  return /^\d{6}$/.test(otp ?? '') ? '' : 'Enter the 6-digit code'
}

export function validateImage(file) {
  if (!file) return ''
  if (!IMAGE_TYPES.includes(file.type)) return 'Use a JPEG, PNG or WebP image'
  return file.size > MAX_IMAGE_BYTES ? 'Image must be 2 MB or smaller' : ''
}

function compact(errors) {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message))
}

export const validateLogin = ({ email, password }) =>
  compact({ email: validateEmail(email), password: password ? '' : 'Password is required' })

export const validateRegistration = ({ name, email, password }) =>
  compact({ name: validateName(name), email: validateEmail(email), password: validatePassword(password) })

export const validateReset = ({ password, confirm }) =>
  compact({
    password: validatePassword(password),
    confirm: password !== confirm ? 'Passwords do not match' : '',
  })

export function validateProfile({ name, phone, gender, dob, address }, today) {
  return compact({
    name: validateName(name),
    phone: validatePhone(phone),
    gender: GENDERS.includes(gender) ? '' : 'Choose an option',
    dob: validateDob(dob, today),
    line1: (address?.line1 ?? '').length > 120 ? 'Address line is too long' : '',
    line2: (address?.line2 ?? '').length > 120 ? 'Address line is too long' : '',
    city: (address?.city ?? '').length > 60 ? 'City is too long' : '',
  })
}

export function validateReview({ rating, comment }) {
  return compact({
    rating: rating >= 1 && rating <= 5 ? '' : 'Choose a rating from 1 to 5',
    comment: (comment ?? '').length > 1000 ? 'Comment must be 1000 characters or fewer' : '',
  })
}

export const validateReason = (reason, { required = false } = {}) => {
  if (required && !reason?.trim()) return 'Please tell us why'
  return (reason ?? '').length > 500 ? 'Please keep it under 500 characters' : ''
}
