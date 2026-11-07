import { describe, expect, it } from 'vitest'
import { makeAppointment } from '../test/factories'
import { buildIcs } from './calendar'

describe('buildIcs', () => {
  const ics = buildIcs(makeAppointment(), new Date('2026-11-01T00:00:00Z'))

  it('produces a valid calendar event in UTC with CRLF line endings', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('DTSTART:20261210T050000Z')
    expect(ics).toContain('DTEND:20261210T053000Z')
    expect(ics).toContain('DTSTAMP:20261101T000000Z')
    expect(ics).toContain('UID:a1@bookmyappointments')
  })

  it('escapes commas in text fields and includes the location', () => {
    expect(ics).toContain('SUMMARY:Appointment with Dr. Priya Nair')
    expect(ics).toContain('LOCATION:4 Park Street\\, Pune')
  })
})
