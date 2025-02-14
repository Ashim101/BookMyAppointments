import { Appointment } from '../appointments/appointment.model.js';
import { HOLDS_SLOT } from '../appointments/stateMachine.js';
import { AppError } from '../../utils/AppError.js';
import { addDays } from '../../utils/time.js';
import { Leave } from './leave.model.js';
import { findOfferedSlot, generateAvailability } from './engine.js';
import { toScheduleDto } from './schedule.validators.js';

/** Glue between the pure slot engine and the database. */
export function createSchedulingService({ settings, clock }) {
  async function context(doctor, from, days) {
    const to = addDays(from, days - 1);
    const [config, leaves, booked] = await Promise.all([
      settings.get(),
      Leave.find({ doctor: doctor._id, date: { $gte: from, $lte: to } })
        .select('date')
        .lean(),
      Appointment.find({ doctor: doctor._id, date: { $gte: from, $lte: to }, status: { $in: HOLDS_SLOT } })
        .select('date time')
        .lean(),
    ]);
    const bookedByDate = new Map();
    for (const { date, time } of booked) {
      if (!bookedByDate.has(date)) bookedByDate.set(date, new Set());
      bookedByDate.get(date).add(time);
    }
    return {
      schedule: toScheduleDto(doctor.schedule),
      timezone: config.timezone,
      windowDays: config.bookingWindowDays,
      now: clock.now(),
      leaveDates: new Set(leaves.map((leave) => leave.date)),
      bookedByDate,
    };
  }

  async function getAvailability(doctor, from, days) {
    const ctx = await context(doctor, from, days);
    const result = generateAvailability({ ...ctx, from, days });
    return {
      timezone: ctx.timezone,
      slotMinutes: ctx.schedule.slotMinutes,
      days: result.map((day) => ({
        date: day.date,
        weekday: day.weekday,
        slots: day.slots.map(({ time, available }) => ({ time, available })),
      })),
    };
  }

  /**
   * Returns `{ startsAt, endsAt, timezone }` when the slot can be booked now and null when it is
   * not offered at all. A slot that exists but is already held raises SLOT_TAKEN.
   */
  async function offerSlot(doctor, date, time) {
    const { bookedByDate, ...ctx } = await context(doctor, date, 1);
    const slot = findOfferedSlot({ ...ctx, date, time });
    if (!slot) return null;
    if (bookedByDate.get(date)?.has(time))
      throw new AppError('SLOT_TAKEN', 'That slot has just been taken. Please choose another.');
    return { startsAt: new Date(slot.startsAt), endsAt: new Date(slot.endsAt), timezone: ctx.timezone };
  }

  return { getAvailability, offerSlot };
}
