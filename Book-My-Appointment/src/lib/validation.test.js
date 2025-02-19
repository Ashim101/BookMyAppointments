import { describe, expect, it } from 'vitest'
import { fieldErrors, errorMessage } from './errors'
import {
  validateDob,
  validateImage,
  validateLogin,
  validatePassword,
  validateProfile,
  validateRegistration,
  validateReset,
  validateReview,
} from './validation'

const validProfile = {
  name: 'Asha Kumar',
  phone: '+91 98765 43210',
  gender: 'female',
  dob: '1994-05-12',
  address: { line1: '12 Lake Road', line2: '', city: 'Pune' },
}

describe('profile validation', () => {
  it('accepts a complete profile and an empty optional section', () => {
    expect(validateProfile(validProfile, '2026-01-01')).toEqual({})
    expect(validateProfile({ ...validProfile, phone: '', dob: '' }, '2026-01-01')).toEqual({})
  })

  it('reports each invalid field', () => {
    const errors = validateProfile(
      { name: 'A', phone: 'abc', gender: 'robot', dob: '2030-01-01', address: { line1: 'x'.repeat(121), line2: '', city: 'y'.repeat(61) } },
      '2026-01-01',
    )
    expect(Object.keys(errors).sort()).toEqual(['city', 'dob', 'gender', 'line1', 'name', 'phone'])
  })

  it('validates dates of birth', () => {
    expect(validateDob('1899-12-31')).toBeTruthy()
    expect(validateDob('2026-13-45')).toBeTruthy()
    expect(validateDob('not-a-date')).toBeTruthy()
    expect(validateDob('')).toBe('')
  })
})

describe('image validation', () => {
  const file = (type, size) => ({ type, size })
  it('enforces type and size', () => {
    expect(validateImage(null)).toBe('')
    expect(validateImage(file('image/png', 1000))).toBe('')
    expect(validateImage(file('image/webp', 2 * 1024 * 1024))).toBe('')
    expect(validateImage(file('image/gif', 1000))).toMatch(/JPEG, PNG or WebP/)
    expect(validateImage(file('image/jpeg', 2 * 1024 * 1024 + 1))).toMatch(/2 MB/)
  })
})

describe('auth form validation', () => {
  it('requires letters and digits in passwords', () => {
    expect(validatePassword('short1')).toMatch(/8 characters/)
    expect(validatePassword('onlyletters')).toMatch(/letter and one digit/)
    expect(validatePassword('12345678')).toMatch(/letter and one digit/)
    expect(validatePassword('goodpass1')).toBe('')
  })

  it('validates login, registration and reset forms', () => {
    expect(validateLogin({ email: 'nope', password: '' })).toEqual({ email: expect.any(String), password: expect.any(String) })
    expect(validateRegistration({ name: 'Asha', email: 'a@b.co', password: 'goodpass1' })).toEqual({})
    expect(validateReset({ password: 'goodpass1', confirm: 'other' })).toHaveProperty('confirm')
  })

  it('validates reviews', () => {
    expect(validateReview({ rating: 0, comment: '' })).toHaveProperty('rating')
    expect(validateReview({ rating: 5, comment: 'x'.repeat(1001) })).toHaveProperty('comment')
    expect(validateReview({ rating: 4, comment: 'Great' })).toEqual({})
  })
})

describe('error helpers', () => {
  it('maps codes to friendly messages and falls back to the server message', () => {
    expect(errorMessage({ code: 'SLOT_TAKEN' })).toMatch(/Someone else/)
    expect(errorMessage({ code: 'WEIRD', message: 'Custom' })).toBe('Custom')
    expect(errorMessage(null)).toMatch(/Something went wrong/)
  })

  it('extracts field errors only for validation errors', () => {
    const details = [{ path: 'email', message: 'Invalid email' }, { path: 'email', message: 'dup' }]
    expect(fieldErrors({ code: 'VALIDATION_ERROR', details })).toEqual({ email: 'Invalid email' })
    expect(fieldErrors({ code: 'INTERNAL', details })).toEqual({})
  })
})
