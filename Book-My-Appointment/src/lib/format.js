const LOCALE = 'en-GB'
const pad = (n) => String(n).padStart(2, '0')

export function parseYmd(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function toYmd(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export function addDays(ymd, days) {
  const date = parseYmd(ymd)
  date.setUTCDate(date.getUTCDate() + days)
  return toYmd(date)
}

export function todayIn(timezone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return parts
}

export function formatDate(ymd, { weekday = true, year = true } = {}) {
  if (!ymd) return ''
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: 'UTC',
    weekday: weekday ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: year ? 'numeric' : undefined,
  }).format(parseYmd(ymd))
}

export function formatWeekday(ymd) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'short' }).format(parseYmd(ymd))
}

export function formatDayOfMonth(ymd) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(parseYmd(ymd))
}

export function formatTime(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`
}

export function formatInstant(iso, timezone) {
  if (!iso) return ''
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: timezone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(new Date(iso))
    .replace(/\s?(am|pm)/i, (_, p) => ` ${p.toUpperCase()}`)
}

export function timezoneLabel(timezone) {
  if (!timezone) return ''
  const offset = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, timeZoneName: 'shortOffset' })
    .formatToParts(new Date())
    .find((p) => p.type === 'timeZoneName')?.value
  return `${timezone.replace(/_/g, ' ')} (${offset})`
}

export function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount)
}

export function formatRelativeTime(iso, now = new Date()) {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000)
  const units = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return rtf.format(0, 'second')
}

export function hoursUntil(iso, now = new Date()) {
  return (new Date(iso).getTime() - now.getTime()) / 3_600_000
}

export function shiftHours(iso, hours) {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString()
}

export function initials(name = '') {
  const words = name.replace(/^(dr\.?|mr\.?|mrs\.?|ms\.?)\s+/i, '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0]
  return letters.toUpperCase()
}
