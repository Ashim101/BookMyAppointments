import { describe, expect, it } from 'vitest';
import { findOfferedSlot, generateAvailability, generateDaySlots } from '../../src/modules/scheduling/engine.js';

const KTM = 'Asia/Kathmandu';
const NY = 'America/New_York';

const weekdaySchedule = {
  slotMinutes: 30,
  weekly: [1, 2, 3, 4, 5].map((day) => ({ day, start: '10:00', end: '13:00', breaks: [{ start: '11:00', end: '11:30' }] })),
};

// 2026-01-12 is a Monday; 03:00 UTC is 08:45 in Kathmandu.
const morning = Date.UTC(2026, 0, 12, 3, 0);
const base = { timezone: KTM, windowDays: 14, now: morning };
const times = (slots) => slots.map((slot) => slot.time);

describe('generateDaySlots', () => {
  it('steps through working hours and skips breaks', () => {
    const slots = generateDaySlots({ ...base, schedule: weekdaySchedule, date: '2026-01-12' });
    expect(times(slots)).toEqual(['10:00', '10:30', '11:30', '12:00', '12:30']);
    expect(slots[0].startsAt).toBe(Date.UTC(2026, 0, 12, 4, 15));
    expect(slots[0].endsAt - slots[0].startsAt).toBe(30 * 60_000);
  });

  it('returns nothing on days without hours and on leave days', () => {
    expect(generateDaySlots({ ...base, schedule: weekdaySchedule, date: '2026-01-17' })).toEqual([]);
    expect(generateDaySlots({ ...base, schedule: weekdaySchedule, date: '2026-01-13', leaveDates: new Set(['2026-01-13']) })).toEqual([]);
  });

  it('only keeps slots that fit entirely inside working hours', () => {
    const schedule = { slotMinutes: 45, weekly: [{ day: 1, start: '09:00', end: '10:45', breaks: [] }] };
    expect(times(generateDaySlots({ ...base, schedule, date: '2026-01-19' }))).toEqual(['09:00', '09:45']);
  });

  it('marks booked slots, past slots and slots inside the 30 minute lead as unavailable', () => {
    const now = Date.UTC(2026, 0, 12, 4, 45); // 10:30 in Kathmandu
    const slots = generateDaySlots({
      ...base,
      now,
      schedule: weekdaySchedule,
      date: '2026-01-12',
      bookedTimes: new Set(['12:00']),
    });
    const availability = Object.fromEntries(slots.map((slot) => [slot.time, slot.available]));
    expect(availability).toEqual({ '10:00': false, '10:30': false, '11:30': true, '12:00': false, '12:30': true });
  });

  it('allows a slot exactly 30 minutes away', () => {
    const now = Date.UTC(2026, 0, 12, 4, 15) - 30 * 60_000; // 09:30 local
    const slot = findOfferedSlot({ ...base, now, schedule: weekdaySchedule, date: '2026-01-12', time: '10:00' });
    expect(slot).not.toBeNull();
  });

  it('respects the booking window', () => {
    const inside = generateDaySlots({ ...base, windowDays: 7, schedule: weekdaySchedule, date: '2026-01-19' });
    const outside = generateDaySlots({ ...base, windowDays: 7, schedule: weekdaySchedule, date: '2026-01-20' });
    expect(inside.every((slot) => slot.available)).toBe(true);
    expect(outside.length).toBeGreaterThan(0);
    expect(outside.every((slot) => !slot.available)).toBe(true);
  });

  it('uses the clinic date, not the UTC date, to decide what is in the past', () => {
    // 20:00 UTC on 2026-01-12 is already 01:45 on the 13th in Kathmandu.
    const now = Date.UTC(2026, 0, 12, 20, 0);
    const monday = generateDaySlots({ ...base, now, schedule: weekdaySchedule, date: '2026-01-12' });
    expect(monday.every((slot) => !slot.available)).toBe(true);
    const tuesday = generateDaySlots({ ...base, now, schedule: weekdaySchedule, date: '2026-01-13' });
    expect(tuesday.every((slot) => slot.available)).toBe(true);
  });
});

describe('generateAvailability', () => {
  it('builds consecutive days with booked times applied', () => {
    const days = generateAvailability({
      ...base,
      schedule: weekdaySchedule,
      from: '2026-01-15',
      days: 4,
      bookedByDate: new Map([['2026-01-16', new Set(['10:00'])]]),
    });
    expect(days.map((day) => [day.date, day.weekday])).toEqual([
      ['2026-01-15', 4],
      ['2026-01-16', 5],
      ['2026-01-17', 6],
      ['2026-01-18', 0],
    ]);
    expect(days[1].slots[0]).toMatchObject({ time: '10:00', available: false });
    expect(days[2].slots).toEqual([]);
  });
});

describe('daylight saving time in America/New_York', () => {
  const sunday = { slotMinutes: 60, weekly: [{ day: 0, start: '00:00', end: '06:00', breaks: [] }] };
  const ny = { timezone: NY, windowDays: 400, schedule: sunday };

  it('skips the non-existent 02:00 slot on 2026-03-08', () => {
    const slots = generateDaySlots({ ...ny, now: Date.UTC(2026, 2, 1), date: '2026-03-08' });
    expect(times(slots)).toEqual(['00:00', '01:00', '03:00', '04:00', '05:00']);
    expect(slots[1].startsAt).toBe(Date.UTC(2026, 2, 8, 6, 0));
    expect(slots[2].startsAt).toBe(Date.UTC(2026, 2, 8, 7, 0));
  });

  it('offers the repeated 01:00 hour only once on 2026-11-01', () => {
    const slots = generateDaySlots({ ...ny, now: Date.UTC(2026, 9, 25), date: '2026-11-01' });
    expect(times(slots)).toEqual(['00:00', '01:00', '02:00', '03:00', '04:00', '05:00']);
    expect(slots[1].startsAt).toBe(Date.UTC(2026, 10, 1, 5, 0));
    expect(slots[2].startsAt).toBe(Date.UTC(2026, 10, 1, 7, 0));
  });

  it('computes lead time from real instants across the transition', () => {
    // 05:45 UTC is 01:45 EDT, the first 01:xx occurrence of 2026-11-01.
    const now = Date.UTC(2026, 10, 1, 5, 45);
    const slots = generateDaySlots({ ...ny, now, date: '2026-11-01' });
    // 02:00 EST is only 75 real minutes away; the 01:00 slot is already past.
    expect(slots.find((slot) => slot.time === '01:00').available).toBe(false);
    expect(slots.find((slot) => slot.time === '02:00').available).toBe(true);
    const tooSoon = generateDaySlots({ ...ny, now: Date.UTC(2026, 10, 1, 6, 45), date: '2026-11-01' });
    expect(tooSoon.find((slot) => slot.time === '02:00').available).toBe(false);
  });
});
