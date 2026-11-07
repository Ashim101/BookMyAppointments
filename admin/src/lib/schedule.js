import { isValidTime, minutesToTime, timeToMinutes } from './date'

export const SLOT_OPTIONS = [15, 20, 30, 45, 60]
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

const emptyDay = (day) => ({ day, enabled: false, start: '09:00', end: '17:00', breaks: [] })

/** Turns an API schedule into editable form state with one row per weekday. */
export function toFormState(schedule) {
  const byDay = new Map((schedule?.weekly ?? []).map((w) => [w.day, w]))
  return {
    slotMinutes: schedule?.slotMinutes ?? 30,
    days: DAY_ORDER.map((day) => {
      const entry = byDay.get(day)
      return entry
        ? { day, enabled: true, start: entry.start, end: entry.end, breaks: entry.breaks.map((b) => ({ ...b })) }
        : emptyDay(day)
    }),
  }
}

export function toApiSchedule(state) {
  return {
    slotMinutes: Number(state.slotMinutes),
    weekly: state.days
      .filter((d) => d.enabled)
      .map(({ day, start, end, breaks }) => ({
        day,
        start,
        end,
        breaks: breaks.map((b) => ({ start: b.start, end: b.end })),
      })),
  }
}

function validateRange(range, label) {
  if (!isValidTime(range.start) || !isValidTime(range.end)) return `${label} must use HH:mm times`
  if (timeToMinutes(range.start) >= timeToMinutes(range.end)) return `${label} must start before it ends`
  return null
}

/**
 * Mirrors the server rules. Returns a map of error messages keyed by
 * `<dayIndex>.hours` or `<dayIndex>.break.<breakIndex>`, empty when valid.
 */
export function validateSchedule(state) {
  const errors = {}
  if (!SLOT_OPTIONS.includes(Number(state.slotMinutes))) errors.slotMinutes = 'Choose a supported slot length'
  if (!state.days.some((d) => d.enabled)) errors.days = 'Enable at least one working day'

  state.days.forEach((d, i) => {
    if (!d.enabled) return
    const hours = validateRange(d, 'Working hours')
    if (hours) {
      errors[`${i}.hours`] = hours
      return
    }
    const start = timeToMinutes(d.start)
    const end = timeToMinutes(d.end)
    const valid = []
    d.breaks.forEach((b, j) => {
      const problem = validateRange(b, 'Break')
      if (problem) {
        errors[`${i}.break.${j}`] = problem
      } else if (timeToMinutes(b.start) < start || timeToMinutes(b.end) > end) {
        errors[`${i}.break.${j}`] = 'Break must be inside working hours'
      } else {
        valid.push({ index: j, from: timeToMinutes(b.start), to: timeToMinutes(b.end) })
      }
    })
    valid.sort((a, b) => a.from - b.from)
    for (let k = 1; k < valid.length; k += 1) {
      if (valid[k].from < valid[k - 1].to) errors[`${i}.break.${valid[k].index}`] = 'Breaks must not overlap'
    }
  })
  return errors
}

/** Slots that fit entirely inside working hours and outside breaks. */
export function generateSlots(day, slotMinutes) {
  if (!day?.enabled || validateRange(day, 'x')) return []
  const step = Number(slotMinutes)
  const breaks = day.breaks
    .filter((b) => !validateRange(b, 'x'))
    .map((b) => [timeToMinutes(b.start), timeToMinutes(b.end)])
  const slots = []
  for (let t = timeToMinutes(day.start); t + step <= timeToMinutes(day.end); t += step) {
    if (!breaks.some(([from, to]) => t < to && t + step > from)) slots.push(minutesToTime(t))
  }
  return slots
}
