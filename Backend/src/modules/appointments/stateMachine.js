import { AppError } from '../../utils/AppError.js';

export const MAX_RESCHEDULES = 2;
export const COMPLETE_LEAD_MS = 15 * 60_000;
const HOUR_MS = 3_600_000;

export const TRANSITIONS = Object.freeze({
  booked: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
});

export const canTransition = (from, to) => TRANSITIONS[from]?.includes(to) ?? false;

/** Slots are held by appointments in these states; cancelled and no_show free the slot. */
export const HOLDS_SLOT = Object.freeze(['booked', 'completed']);

const deny = (code, message) => ({ code, message });

const isParticipant = (appointment, user) =>
  user.role === 'admin' ||
  (user.role === 'patient' && String(appointment.patient) === user.id) ||
  (user.role === 'doctor' && String(appointment.doctor) === user.id);

const requireBooked = (appointment, to) =>
  canTransition(appointment.status, to)
    ? null
    : deny('INVALID_STATE', `A ${appointment.status} appointment cannot become ${to}`);

const requireRole = (user, role) =>
  user.role === role ? null : deny('FORBIDDEN', `Only a ${role} can do this`);

/** Patients may only change appointments up to `cancellationCutoffHours` before they start. */
const patientWindow = (appointment, now, cutoffHours) =>
  now > appointment.startsAt.getTime() - cutoffHours * HOUR_MS
    ? deny(
        'CANCELLATION_WINDOW_PASSED',
        `Appointments can only be changed ${cutoffHours} hours or more before they start`,
      )
    : null;

const CHECKS = {
  cancel: ({ appointment, user, now, settings }) => {
    const state = requireBooked(appointment, 'cancelled');
    if (state) return state;
    if (user.role === 'patient') return patientWindow(appointment, now, settings.cancellationCutoffHours);
    if (user.role === 'doctor' && now >= appointment.startsAt.getTime()) {
      return deny('INVALID_STATE', 'This appointment has already started');
    }
    return null;
  },

  reschedule: ({ appointment, user, now, settings }) =>
    requireRole(user, 'patient') ??
    (appointment.status === 'booked'
      ? null
      : deny('INVALID_STATE', `A ${appointment.status} appointment cannot be rescheduled`)) ??
    patientWindow(appointment, now, settings.cancellationCutoffHours) ??
    (appointment.rescheduleCount >= MAX_RESCHEDULES
      ? deny('INVALID_STATE', `An appointment can be rescheduled at most ${MAX_RESCHEDULES} times`)
      : null),

  complete: ({ appointment, user, now }) =>
    requireRole(user, 'doctor') ??
    requireBooked(appointment, 'completed') ??
    (now < appointment.startsAt.getTime() - COMPLETE_LEAD_MS
      ? deny('INVALID_STATE', 'Consultations can be completed from 15 minutes before the start')
      : null),

  noShow: ({ appointment, user, now }) =>
    requireRole(user, 'doctor') ??
    requireBooked(appointment, 'no_show') ??
    (now <= appointment.startsAt.getTime()
      ? deny('INVALID_STATE', 'A no-show can only be recorded after the start time')
      : null),

  pay: ({ appointment, user, now }) =>
    requireRole(user, 'patient') ??
    (appointment.status !== 'booked' || appointment.paymentStatus !== 'unpaid'
      ? deny('INVALID_STATE', 'Only unpaid booked appointments can be paid')
      : null) ??
    (now >= appointment.startsAt.getTime()
      ? deny('INVALID_STATE', 'This appointment has already started')
      : null),

  review: ({ appointment, user }) =>
    requireRole(user, 'patient') ??
    (appointment.status !== 'completed'
      ? deny('INVALID_STATE', 'Only completed appointments can be reviewed')
      : null) ??
    (appointment.review ? deny('ALREADY_REVIEWED', 'This appointment has already been reviewed') : null),
};

/** Returns null when `action` is allowed, otherwise `{ code, message }`. */
export function check(action, ctx) {
  if (!isParticipant(ctx.appointment, ctx.user)) return deny('NOT_FOUND', 'Appointment not found');
  return CHECKS[action](ctx);
}

export function assertAllowed(action, ctx) {
  const denial = check(action, ctx);
  if (denial) throw new AppError(denial.code, denial.message);
}

/** Per-requester flags the clients use to show or hide buttons. */
export function computeActions(ctx) {
  const allowed = (action) => check(action, ctx) === null;
  return {
    canCancel: allowed('cancel'),
    canReschedule: allowed('reschedule'),
    canPay: allowed('pay'),
    canReview: allowed('review'),
    canComplete: allowed('complete'),
    canMarkNoShow: allowed('noShow'),
  };
}
