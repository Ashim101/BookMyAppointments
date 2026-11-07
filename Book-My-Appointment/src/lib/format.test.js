import { describe, expect, it } from 'vitest'
import {
  addDays,
  formatCurrency,
  formatDate,
  formatInstant,
  formatRelativeTime,
  formatTime,
  hoursUntil,
  initials,
  timezoneLabel,
  todayIn,
} from './format'

describe('date and time formatting', () => {
  it('formats clinic-local dates without shifting them', () => {
    expect(formatDate('2026-03-01')).toBe('Sun, 1 Mar 2026')
    expect(formatDate('2026-12-31', { weekday: false, year: false })).toBe('31 Dec')
  })

  it('formats 24-hour times as 12-hour', () => {
    expect(formatTime('00:05')).toBe('12:05 AM')
    expect(formatTime('12:00')).toBe('12:00 PM')
    expect(formatTime('17:45')).toBe('5:45 PM')
    expect(formatTime('')).toBe('')
  })

  it('renders instants in the clinic timezone', () => {
    const iso = '2026-06-10T20:30:00Z'
    expect(formatInstant(iso, 'Asia/Kolkata')).toBe('11 Jun 2026, 2:00 AM')
    expect(formatInstant(iso, 'America/New_York')).toBe('10 Jun 2026, 4:30 PM')
  })

  it('computes today in a timezone', () => {
    const now = new Date('2026-06-10T20:30:00Z')
    expect(todayIn('Asia/Kolkata', now)).toBe('2026-06-11')
    expect(todayIn('America/Los_Angeles', now)).toBe('2026-06-10')
  })

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('labels timezones with their offset', () => {
    expect(timezoneLabel('Asia/Kolkata')).toBe('Asia/Kolkata (GMT+5:30)')
    expect(timezoneLabel('America/Argentina/Buenos_Aires')).toContain('Buenos Aires')
  })

  it('computes relative and remaining time', () => {
    const now = new Date('2026-06-10T10:00:00Z')
    expect(hoursUntil('2026-06-10T22:00:00Z', now)).toBe(12)
    expect(formatRelativeTime('2026-06-10T09:00:00Z', now)).toBe('1 hour ago')
    expect(formatRelativeTime('2026-06-12T10:00:00Z', now)).toBe('in 2 days')
  })
})

describe('currency formatting', () => {
  it('formats whole and fractional amounts', () => {
    expect(formatCurrency(500, 'INR')).toBe('₹500')
    expect(formatCurrency(1234.5, 'INR')).toBe('₹1,234.50')
    expect(formatCurrency(2500000, 'INR')).toBe('₹25,00,000')
    expect(formatCurrency(40, 'USD')).toContain('40')
  })
})

describe('initials', () => {
  it('uses first and last words and strips titles', () => {
    expect(initials('Dr. Priya Nair')).toBe('PN')
    expect(initials('Madonna')).toBe('MA')
    expect(initials('')).toBe('?')
  })
})
