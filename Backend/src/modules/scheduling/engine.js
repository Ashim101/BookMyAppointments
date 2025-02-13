import { addDays, minutesToTime, timeToMinutes, todayIn, weekdayOf, zonedToUtc } from '../../utils/time.js';

const MS_MINUTE = 60_000;
export const MIN_LEAD_MINUTES = 30;

const overlapsBreak = (start, end, breaks) =>
  breaks.some((b) => start < timeToMinutes(b.end) && end > timeToMinutes(b.start));

/**
 * Slots of one calendar day, in the clinic timezone. Pure: callers pass the
 * existing bookings, leave days and the current instant.
 *
 * Wall times that do not exist (DST gap) are skipped; wall times that occur
 * twice (DST overlap) resolve to the first occurrence.
 */
export function generateDaySlots({
  date,
  schedule,
  timezone,
  now,
  windowDays,
  leaveDates = new Set(),
  bookedTimes = new Set(),
  minLeadMinutes = MIN_LEAD_MINUTES,
}) {
  const entry = schedule.weekly.find((item) => item.day === weekdayOf(date));
  if (!entry || leaveDates.has(date)) return [];

  const today = todayIn(now, timezone);
  const inWindow = date >= today && date <= addDays(today, windowDays);
  const earliest = now + minLeadMinutes * MS_MINUTE;
  const length = schedule.slotMinutes;
  const slots = [];

  for (let start = timeToMinutes(entry.start); start + length <= timeToMinutes(entry.end); start += length) {
    if (overlapsBreak(start, start + length, entry.breaks ?? [])) continue;
    const time = minutesToTime(start);
    const startsAt = zonedToUtc(date, time, timezone);
    if (startsAt === null) continue;
    slots.push({
      time,
      startsAt,
      endsAt: startsAt + length * MS_MINUTE,
      available: inWindow && startsAt >= earliest && !bookedTimes.has(time),
    });
  }
  return slots;
}

/** Availability for `days` consecutive dates starting at `from`. */
export function generateAvailability({ from, days, bookedByDate = new Map(), ...rest }) {
  return Array.from({ length: days }, (_, offset) => {
    const date = addDays(from, offset);
    const slots = generateDaySlots({ ...rest, date, bookedTimes: bookedByDate.get(date) });
    return { date, weekday: weekdayOf(date), slots };
  });
}

/** The slot at `date`/`time` if (and only if) it can be booked right now. */
export function findOfferedSlot({ date, time, ...rest }) {
  const slot = generateDaySlots({ ...rest, date }).find((candidate) => candidate.time === time);
  return slot?.available ? slot : null;
}
