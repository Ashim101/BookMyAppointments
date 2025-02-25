import { timeToMinutes, weekdayOf } from './date'

export const DEFAULT_START_HOUR = 8
export const DEFAULT_END_HOUR = 18

/** Visible hour range covering every working day, padded to whole hours. */
export function calendarBounds(schedule) {
  const entries = schedule?.weekly ?? []
  if (!entries.length) return { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR }
  const starts = entries.map((e) => Math.floor(timeToMinutes(e.start) / 60))
  const ends = entries.map((e) => Math.ceil(timeToMinutes(e.end) / 60))
  return { startHour: Math.min(...starts), endHour: Math.max(...ends) }
}

export const durationMinutes = (appointment) =>
  Math.max(15, Math.round((new Date(appointment.endsAt) - new Date(appointment.startsAt)) / 60000))

/** Pixel offset and height of an appointment inside a day column. */
export function positionAppointment(appointment, { startHour, pxPerHour }) {
  const pxPerMinute = pxPerHour / 60
  return {
    top: (timeToMinutes(appointment.time) - startHour * 60) * pxPerMinute,
    height: durationMinutes(appointment) * pxPerMinute,
  }
}

/** Shaded (non-bookable) vertical segments for one date, in pixels. */
export function unavailableBlocks(date, schedule, { startHour, endHour, pxPerHour }) {
  const pxPerMinute = pxPerHour / 60
  const from = startHour * 60
  const to = endHour * 60
  const block = (a, b) => ({ top: (a - from) * pxPerMinute, height: (b - a) * pxPerMinute })
  const entry = schedule?.weekly?.find((w) => w.day === weekdayOf(date))
  if (!entry) return [block(from, to)]

  const open = Math.max(from, timeToMinutes(entry.start))
  const close = Math.min(to, timeToMinutes(entry.end))
  const blocks = []
  if (open > from) blocks.push(block(from, open))
  if (close < to) blocks.push(block(close, to))
  for (const b of entry.breaks) blocks.push(block(timeToMinutes(b.start), timeToMinutes(b.end)))
  return blocks
}

export function groupByDate(appointments) {
  const map = {}
  for (const a of appointments) (map[a.date] ||= []).push(a)
  return map
}
