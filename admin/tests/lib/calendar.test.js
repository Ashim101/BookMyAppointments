import {
  calendarBounds, durationMinutes, groupByDate, positionAppointment, unavailableBlocks,
} from '../../src/lib/calendar'

const schedule = {
  slotMinutes: 30,
  weekly: [
    { day: 1, start: '09:00', end: '17:00', breaks: [{ start: '13:00', end: '14:00' }] },
    { day: 2, start: '10:30', end: '15:15', breaks: [] },
  ],
}
const view = { startHour: 8, endHour: 18, pxPerHour: 60 }

describe('calendar math', () => {
  it('derives bounds from working hours, rounding outward', () => {
    expect(calendarBounds(schedule)).toEqual({ startHour: 9, endHour: 17 })
    expect(calendarBounds({ weekly: [{ day: 2, start: '10:30', end: '15:15', breaks: [] }] })).toEqual({
      startHour: 10,
      endHour: 16,
    })
    expect(calendarBounds({ weekly: [] })).toEqual({ startHour: 8, endHour: 18 })
  })

  it('positions appointments by start time and duration', () => {
    const appt = { time: '10:30', startsAt: '2026-11-02T05:00:00Z', endsAt: '2026-11-02T05:45:00Z' }
    expect(durationMinutes(appt)).toBe(45)
    expect(positionAppointment(appt, view)).toEqual({ top: 150, height: 45 })
    expect(positionAppointment(appt, { ...view, pxPerHour: 120 })).toEqual({ top: 300, height: 90 })
  })

  it('never makes an appointment shorter than 15 minutes', () => {
    expect(durationMinutes({ startsAt: '2026-11-02T05:00:00Z', endsAt: '2026-11-02T05:00:00Z' })).toBe(15)
  })

  it('shades the whole day when there is no schedule entry', () => {
    expect(unavailableBlocks('2026-11-04', schedule, view)).toEqual([{ top: 0, height: 600 }])
  })

  it('shades time outside working hours and breaks', () => {
    const blocks = unavailableBlocks('2026-11-02', schedule, view)
    expect(blocks).toEqual([
      { top: 0, height: 60 },
      { top: 540, height: 60 },
      { top: 300, height: 60 },
    ])
  })

  it('groups appointments by date', () => {
    const grouped = groupByDate([{ date: 'a', id: 1 }, { date: 'b', id: 2 }, { date: 'a', id: 3 }])
    expect(grouped.a.map((x) => x.id)).toEqual([1, 3])
  })
})
