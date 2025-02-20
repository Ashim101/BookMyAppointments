const pad = (n) => String(n).padStart(2, '0')

export function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const todayISO = () => toISODate(new Date())

export function addDays(iso, amount) {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + amount)
  return toISODate(d)
}

export const weekdayOf = (iso) => parseISODate(iso).getDay()

/** Monday of the week containing `iso`. */
export function startOfWeek(iso) {
  const offset = (weekdayOf(iso) + 6) % 7
  return addDays(iso, -offset)
}

export const weekDates = (startIso) => Array.from({ length: 7 }, (_, i) => addDays(startIso, i))

export const timeToMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export const minutesToTime = (total) => `${pad(Math.floor(total / 60))}:${pad(total % 60)}`

export const isValidTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value ?? '')

export function formatDate(iso, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '-'
  return parseISODate(iso.slice(0, 10)).toLocaleDateString('en-GB', options)
}

export function formatTime(hhmm) {
  if (!hhmm) return '-'
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${pad(m)} ${suffix}`
}

export function formatDateTime(instant) {
  if (!instant) return '-'
  const d = new Date(instant)
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${day}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

export function formatPeriod(period, interval = 'day') {
  if (interval === 'month' || period.length === 7) {
    return parseISODate(`${period}-01`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
  }
  return formatDate(period, { day: 'numeric', month: 'short' })
}

export const dayName = (day, style = 'long') =>
  new Date(2023, 0, 1 + day).toLocaleDateString('en-GB', { weekday: style })
