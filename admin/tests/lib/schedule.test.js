import { generateSlots, toApiSchedule, toFormState, validateSchedule } from '../../src/lib/schedule'

const api = {
  slotMinutes: 30,
  weekly: [{ day: 1, start: '10:00', end: '13:00', breaks: [{ start: '11:00', end: '11:30' }] }],
}

describe('schedule form state', () => {
  it('round-trips an API schedule', () => {
    const state = toFormState(api)
    expect(state.days).toHaveLength(7)
    expect(state.days[0]).toMatchObject({ day: 1, enabled: true })
    expect(state.days.filter((d) => d.enabled)).toHaveLength(1)
    expect(toApiSchedule(state)).toEqual(api)
  })
})

describe('validateSchedule', () => {
  const base = () => toFormState(api)

  it('accepts a valid schedule', () => {
    expect(validateSchedule(base())).toEqual({})
  })

  it('requires at least one enabled day', () => {
    expect(validateSchedule(toFormState({ slotMinutes: 30, weekly: [] })).days).toBeDefined()
  })

  it('rejects start >= end', () => {
    const s = base()
    s.days[0].end = '10:00'
    expect(validateSchedule(s)['0.hours']).toMatch(/before/)
  })

  it('rejects malformed times', () => {
    const s = base()
    s.days[0].start = '9am'
    expect(validateSchedule(s)['0.hours']).toMatch(/HH:mm/)
  })

  it('rejects breaks outside working hours', () => {
    const s = base()
    s.days[0].breaks[0] = { start: '09:30', end: '10:30' }
    expect(validateSchedule(s)['0.break.0']).toMatch(/inside/)
  })

  it('rejects inverted breaks', () => {
    const s = base()
    s.days[0].breaks[0] = { start: '12:00', end: '11:00' }
    expect(validateSchedule(s)['0.break.0']).toMatch(/before/)
  })

  it('rejects overlapping breaks but allows touching ones', () => {
    const s = base()
    s.days[0].breaks = [{ start: '11:00', end: '11:30' }, { start: '11:15', end: '12:00' }]
    expect(validateSchedule(s)['0.break.1']).toMatch(/overlap/)
    s.days[0].breaks[1] = { start: '11:30', end: '12:00' }
    expect(validateSchedule(s)).toEqual({})
  })

  it('rejects unsupported slot lengths', () => {
    const s = base()
    s.slotMinutes = 25
    expect(validateSchedule(s).slotMinutes).toBeDefined()
  })
})

describe('generateSlots', () => {
  it('skips slots that touch a break', () => {
    const day = toFormState(api).days[0]
    expect(generateSlots(day, 30)).toEqual(['10:00', '10:30', '11:30', '12:00', '12:30'])
  })

  it('drops a trailing slot that does not fit', () => {
    const day = { enabled: true, start: '10:00', end: '11:00', breaks: [] }
    expect(generateSlots(day, 45)).toEqual(['10:00'])
  })

  it('returns nothing for disabled or invalid days', () => {
    expect(generateSlots({ enabled: false, start: '10:00', end: '12:00', breaks: [] }, 30)).toEqual([])
    expect(generateSlots({ enabled: true, start: '12:00', end: '10:00', breaks: [] }, 30)).toEqual([])
  })
})
