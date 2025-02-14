import { z } from 'zod';
import { timeString } from '../../utils/schemas.js';
import { timeToMinutes } from '../../utils/time.js';

const range = z.object({ start: timeString, end: timeString });

const weeklyEntry = range.extend({
  day: z.number().int().min(0).max(6),
  breaks: z.array(range).max(6).default([]),
});

const slotMinutes = z.union([z.literal(15), z.literal(20), z.literal(30), z.literal(45), z.literal(60)]);

/** Business rules the shape alone cannot express: ordering, containment and overlap. */
function checkWeekly(weekly, ctx) {
  const seen = new Set();
  weekly.forEach((entry, index) => {
    const at = (...rest) => ['weekly', index, ...rest];
    if (seen.has(entry.day))
      ctx.addIssue({ code: 'custom', path: at('day'), message: 'Each day may appear only once' });
    seen.add(entry.day);
    if (timeToMinutes(entry.start) >= timeToMinutes(entry.end)) {
      ctx.addIssue({ code: 'custom', path: at('end'), message: 'End must be after start' });
    }
    const sorted = [...entry.breaks].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    sorted.forEach((brk, i) => {
      const [bs, be] = [timeToMinutes(brk.start), timeToMinutes(brk.end)];
      const path = at('breaks', entry.breaks.indexOf(brk));
      if (bs >= be) ctx.addIssue({ code: 'custom', path, message: 'Break end must be after its start' });
      else if (bs < timeToMinutes(entry.start) || be > timeToMinutes(entry.end)) {
        ctx.addIssue({ code: 'custom', path, message: 'Break must be inside working hours' });
      }
      if (i > 0 && bs < timeToMinutes(sorted[i - 1].end)) {
        ctx.addIssue({ code: 'custom', path, message: 'Breaks must not overlap' });
      }
    });
  });
}

export const scheduleBody = z
  .object({ slotMinutes, weekly: z.array(weeklyEntry).max(7) })
  .superRefine((schedule, ctx) => checkWeekly(schedule.weekly, ctx));

export const defaultSchedule = (slotMinutes = 30) => ({
  slotMinutes,
  weekly: [1, 2, 3, 4, 5].map((day) => ({
    day,
    start: '10:00',
    end: '17:00',
    breaks: [{ start: '13:00', end: '14:00' }],
  })),
});

export const toScheduleDto = (schedule) => ({
  slotMinutes: schedule.slotMinutes,
  weekly: [...schedule.weekly]
    .sort((a, b) => a.day - b.day)
    .map((entry) => ({
      day: entry.day,
      start: entry.start,
      end: entry.end,
      breaks: (entry.breaks ?? []).map((b) => ({ start: b.start, end: b.end })),
    })),
});
