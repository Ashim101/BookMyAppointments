import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  daysBetween,
  isValidDate,
  isValidTime,
  minutesToTime,
  startOfMonth,
  startOfWeek,
  startOfZonedDay,
  timeToMinutes,
  todayIn,
  utcToZoned,
  weekdayOf,
  zoneOffsetMinutes,
  zonedToUtc,
} from '../../src/utils/time.js';

const KTM = 'Asia/Kathmandu';
const NY = 'America/New_York';
const utc = (...args) => Date.UTC(...args);

describe('calendar helpers', () => {
  it('validates dates and times strictly', () => {
    expect(isValidDate('2026-02-28')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-2-3')).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('9:00')).toBe(false);
  });

  it('converts between minutes and HH:mm', () => {
    expect(timeToMinutes('10:45')).toBe(645);
    expect(minutesToTime(645)).toBe('10:45');
    expect(minutesToTime(0)).toBe('00:00');
  });

  it('does date arithmetic without timezone drift', () => {
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(daysBetween('2026-03-01', '2026-03-15')).toBe(14);
    expect(weekdayOf('2026-03-08')).toBe(0);
    expect(startOfWeek('2026-03-08')).toBe('2026-03-02');
    expect(startOfWeek('2026-03-02')).toBe('2026-03-02');
    expect(startOfMonth('2026-03-18')).toBe('2026-03-01');
    expect(addMonths('2026-11-01', 2)).toBe('2027-01-01');
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01');
  });
});

describe('Asia/Kathmandu (+05:45, no DST)', () => {
  it('has a 345 minute offset', () => {
    expect(zoneOffsetMinutes(utc(2026, 6, 1), KTM)).toBe(345);
  });

  it('converts wall time to UTC and back', () => {
    const instant = zonedToUtc('2026-01-15', '10:00', KTM);
    expect(instant).toBe(utc(2026, 0, 15, 4, 15));
    expect(utcToZoned(instant, KTM)).toMatchObject({ date: '2026-01-15', time: '10:00', weekday: 4 });
  });

  it('rolls the local date over before UTC does', () => {
    expect(utcToZoned(utc(2026, 0, 15, 19, 0), KTM)).toMatchObject({ date: '2026-01-16', time: '00:45' });
    expect(todayIn(utc(2026, 0, 15, 19, 0), KTM)).toBe('2026-01-16');
  });
});

describe('America/New_York DST', () => {
  it('uses -05:00 in winter and -04:00 in summer', () => {
    expect(zoneOffsetMinutes(utc(2026, 0, 15), NY)).toBe(-300);
    expect(zoneOffsetMinutes(utc(2026, 6, 15), NY)).toBe(-240);
  });

  it('handles the 2026-03-08 spring-forward gap', () => {
    expect(zonedToUtc('2026-03-08', '01:30', NY)).toBe(utc(2026, 2, 8, 6, 30));
    expect(zonedToUtc('2026-03-08', '02:30', NY)).toBeNull();
    expect(zonedToUtc('2026-03-08', '03:30', NY)).toBe(utc(2026, 2, 8, 7, 30));
    expect(startOfZonedDay('2026-03-09', NY) - startOfZonedDay('2026-03-08', NY)).toBe(23 * 3_600_000);
  });

  it('resolves the 2026-11-01 fall-back overlap to the first occurrence', () => {
    expect(zonedToUtc('2026-11-01', '01:30', NY)).toBe(utc(2026, 10, 1, 5, 30));
    expect(zonedToUtc('2026-11-01', '02:30', NY)).toBe(utc(2026, 10, 1, 7, 30));
    expect(utcToZoned(utc(2026, 10, 1, 6, 30), NY)).toMatchObject({ date: '2026-11-01', time: '01:30' });
    expect(startOfZonedDay('2026-11-02', NY) - startOfZonedDay('2026-11-01', NY)).toBe(25 * 3_600_000);
  });

  it('round-trips every hour of the transition days', () => {
    for (const date of ['2026-03-08', '2026-11-01']) {
      for (let hour = 0; hour < 24; hour += 1) {
        const time = minutesToTime(hour * 60);
        const instant = zonedToUtc(date, time, NY);
        if (instant !== null) expect(utcToZoned(instant, NY)).toMatchObject({ date, time });
      }
    }
  });
});
