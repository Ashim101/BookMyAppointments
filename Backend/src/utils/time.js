const MS_MINUTE = 60_000;
const MS_DAY = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const formatters = new Map();

function formatterFor(zone) {
  let fmt = formatters.get(zone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(zone, fmt);
  }
  return fmt;
}

const pad = (n, size = 2) => String(n).padStart(size, '0');

export function isValidDate(value) {
  const m = DATE_RE.exec(value ?? '');
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d;
}

export const isValidTime = (value) => TIME_RE.test(value ?? '');

export function timeToMinutes(value) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(total) {
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function dateToUtcMs(date) {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

const utcMsToDate = (ms) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (date, days) => utcMsToDate(dateToUtcMs(date) + days * MS_DAY);

export const weekdayOf = (date) => new Date(dateToUtcMs(date)).getUTCDay();

export const daysBetween = (from, to) => Math.round((dateToUtcMs(to) - dateToUtcMs(from)) / MS_DAY);

/** Monday of the ISO week containing `date`. */
export function startOfWeek(date) {
  const offset = (weekdayOf(date) + 6) % 7;
  return addDays(date, -offset);
}

export const startOfMonth = (date) => `${date.slice(0, 7)}-01`;

export function addMonths(monthStart, count) {
  const [y, m] = monthStart.split('-').map(Number);
  const index = y * 12 + (m - 1) + count;
  return `${pad(Math.floor(index / 12), 4)}-${pad((index % 12) + 1)}-01`;
}

/** Wall-clock components of an instant as seen in `zone`. */
export function utcToZoned(instant, zone) {
  const ms = instant instanceof Date ? instant.getTime() : instant;
  const parts = {};
  for (const { type, value } of formatterFor(zone).formatToParts(ms)) parts[type] = value;
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}`;
  return { date, time, weekday: weekdayOf(date), second: Number(parts.second) };
}

/** Offset of `zone` from UTC, in minutes, at the given instant. */
export function zoneOffsetMinutes(instant, zone) {
  const ms = instant instanceof Date ? instant.getTime() : instant;
  const parts = {};
  for (const { type, value } of formatterFor(zone).formatToParts(ms)) parts[type] = value;
  const asUtc = Date.UTC(parts.year, Number(parts.month) - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / MS_MINUTE);
}

/**
 * Converts a wall-clock date and time in `zone` to a UTC instant (ms).
 * Returns null when the wall time does not exist (spring-forward gap) and
 * the earlier instant when it occurs twice (fall-back overlap).
 */
export function zonedToUtc(date, time, zone) {
  const wallAsUtc = dateToUtcMs(date) + timeToMinutes(time) * MS_MINUTE;
  const candidates = new Set();
  for (const probe of [wallAsUtc - MS_DAY, wallAsUtc + MS_DAY]) {
    const offset = zoneOffsetMinutes(probe, zone);
    const instant = wallAsUtc - offset * MS_MINUTE;
    if (zoneOffsetMinutes(instant, zone) === offset) candidates.add(instant);
  }
  if (candidates.size === 0) return null;
  return Math.min(...candidates);
}

/** First instant of the calendar day `date` in `zone`. */
export function startOfZonedDay(date, zone) {
  for (let minutes = 0; minutes < 24 * 60; minutes += 30) {
    const instant = zonedToUtc(date, minutesToTime(minutes), zone);
    if (instant !== null) return instant;
  }
  return dateToUtcMs(date);
}

export const todayIn = (now, zone) => utcToZoned(now, zone).date;
