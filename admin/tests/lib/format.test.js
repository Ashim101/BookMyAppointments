import {
  addDays, formatDate, formatPeriod, formatTime, isValidTime, minutesToTime, startOfWeek, timeToMinutes, weekDates,
} from '../../src/lib/date'
import {
  calculateAge, formatAddress, formatAgeGender, formatCurrency, formatPercent, humanize, initials, slugify,
} from '../../src/lib/format'
import { fieldErrors, messageFor } from '../../src/lib/errorCodes'

describe('date helpers', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('finds the Monday of a week, including for Sundays', () => {
    expect(startOfWeek('2026-11-04')).toBe('2026-11-02')
    expect(startOfWeek('2026-11-08')).toBe('2026-11-02')
    expect(startOfWeek('2026-11-02')).toBe('2026-11-02')
    expect(weekDates('2026-11-02')).toHaveLength(7)
    expect(weekDates('2026-11-02')[6]).toBe('2026-11-08')
  })

  it('converts between HH:mm and minutes', () => {
    expect(timeToMinutes('09:30')).toBe(570)
    expect(minutesToTime(570)).toBe('09:30')
    expect(isValidTime('24:00')).toBe(false)
    expect(isValidTime('7:00')).toBe(false)
    expect(isValidTime('23:59')).toBe(true)
  })

  it('formats dates, times and periods', () => {
    expect(formatDate('2026-03-05')).toBe('5 Mar 2026')
    expect(formatDate(null)).toBe('-')
    expect(formatTime('00:05')).toBe('12:05 AM')
    expect(formatTime('13:30')).toBe('1:30 PM')
    expect(formatPeriod('2026-03', 'month')).toBe('Mar 26')
    expect(formatPeriod('2026-03-09', 'week')).toBe('9 Mar')
  })
})

describe('format helpers', () => {
  it('formats currency with the given code', () => {
    expect(formatCurrency(1500, 'INR')).toContain('1,500')
    expect(formatCurrency(10, 'NOPE-XX')).toBe('NOPE-XX 10')
  })

  it('calculates age with birthdays not yet reached', () => {
    const now = new Date(2026, 5, 15)
    expect(calculateAge('2000-06-15', now)).toBe(26)
    expect(calculateAge('2000-06-16', now)).toBe(25)
    expect(calculateAge('2030-01-01', now)).toBeNull()
    expect(calculateAge(null, now)).toBeNull()
  })

  it('describes a person by age and gender', () => {
    expect(formatAgeGender({ dob: null, gender: 'unspecified' })).toBe('-')
    expect(formatAgeGender({ dob: null, gender: 'female' })).toBe('female')
  })

  it('builds initials ignoring the Dr. prefix', () => {
    expect(initials('Dr. Asha Rao')).toBe('AR')
    expect(initials('Madonna')).toBe('M')
    expect(initials('')).toBe('?')
  })

  it('formats misc values', () => {
    expect(formatPercent(0.1234)).toBe('12.3%')
    expect(formatAddress({ line1: 'A', line2: '', city: 'B' })).toBe('A, B')
    expect(slugify(' Ear, Nose & Throat ')).toBe('ear-nose-throat')
    expect(humanize('doctor.create')).toBe('Doctor create')
  })
})

describe('error messages', () => {
  it('joins validation details', () => {
    const error = { code: 'VALIDATION_ERROR', details: [{ path: 'email', message: 'Invalid' }, { message: 'Bad' }] }
    expect(messageFor(error)).toBe('email: Invalid; Bad')
    expect(fieldErrors(error)).toEqual({ email: 'Invalid' })
  })

  it('falls back to the code map', () => {
    expect(messageFor({ code: 'RATE_LIMITED' })).toMatch(/Too many/)
    expect(messageFor(null, 'x')).toBe('x')
  })
})
