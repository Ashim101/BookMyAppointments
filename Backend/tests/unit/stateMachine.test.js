import { describe, expect, it } from 'vitest';
import {
  TRANSITIONS,
  assertAllowed,
  canTransition,
  check,
  computeActions,
} from '../../src/modules/appointments/stateMachine.js';

const HOUR = 3_600_000;
const START = Date.UTC(2026, 2, 10, 5, 0);
const settings = { cancellationCutoffHours: 2 };

const appointment = (overrides = {}) => ({
  patient: 'p1',
  doctor: 'd1',
  status: 'booked',
  paymentStatus: 'unpaid',
  startsAt: new Date(START),
  rescheduleCount: 0,
  review: null,
  ...overrides,
});
const patient = { id: 'p1', role: 'patient' };
const doctor = { id: 'd1', role: 'doctor' };
const admin = { id: 'admin', role: 'admin' };
const at = (offsetMs) => START + offsetMs;
const run = (action, who, now, overrides) =>
  check(action, { appointment: appointment(overrides), user: who, now, settings });

describe('transition table', () => {
  it('only allows booked appointments to move on', () => {
    expect(TRANSITIONS.booked).toEqual(['completed', 'cancelled', 'no_show']);
    for (const terminal of ['completed', 'cancelled', 'no_show']) {
      for (const next of ['booked', 'completed', 'cancelled', 'no_show']) {
        expect(canTransition(terminal, next)).toBe(false);
      }
    }
    expect(canTransition('booked', 'booked')).toBe(false);
    expect(canTransition('unknown', 'cancelled')).toBe(false);
  });
});

describe('ownership', () => {
  it('treats non-participants as not found', () => {
    expect(run('cancel', { id: 'other', role: 'patient' }, at(-10 * HOUR))?.code).toBe('NOT_FOUND');
    expect(run('complete', { id: 'other', role: 'doctor' }, at(0))?.code).toBe('NOT_FOUND');
  });
});

describe('cancel', () => {
  it('lets a patient cancel up to the cutoff, inclusive', () => {
    expect(run('cancel', patient, at(-3 * HOUR))).toBeNull();
    expect(run('cancel', patient, at(-2 * HOUR))).toBeNull();
    expect(run('cancel', patient, at(-2 * HOUR + 1))?.code).toBe('CANCELLATION_WINDOW_PASSED');
  });

  it('lets a doctor cancel until the start, and an admin at any time', () => {
    expect(run('cancel', doctor, at(-1))).toBeNull();
    expect(run('cancel', doctor, at(0))?.code).toBe('INVALID_STATE');
    expect(run('cancel', admin, at(5 * HOUR))).toBeNull();
  });

  it('rejects cancelling anything that is not booked', () => {
    for (const status of ['completed', 'cancelled', 'no_show']) {
      expect(run('cancel', admin, at(-HOUR), { status })?.code).toBe('INVALID_STATE');
    }
  });
});

describe('reschedule', () => {
  it('is for patients, inside the window, and limited to two changes', () => {
    expect(run('reschedule', patient, at(-5 * HOUR))).toBeNull();
    expect(run('reschedule', doctor, at(-5 * HOUR))?.code).toBe('FORBIDDEN');
    expect(run('reschedule', patient, at(-HOUR))?.code).toBe('CANCELLATION_WINDOW_PASSED');
    expect(run('reschedule', patient, at(-5 * HOUR), { rescheduleCount: 1 })).toBeNull();
    expect(run('reschedule', patient, at(-5 * HOUR), { rescheduleCount: 2 })?.code).toBe('INVALID_STATE');
    expect(run('reschedule', patient, at(-5 * HOUR), { status: 'cancelled' })?.code).toBe('INVALID_STATE');
  });
});

describe('complete and no-show', () => {
  it('opens completion 15 minutes before the start', () => {
    expect(run('complete', doctor, at(-16 * 60_000))?.code).toBe('INVALID_STATE');
    expect(run('complete', doctor, at(-15 * 60_000))).toBeNull();
    expect(run('complete', doctor, at(3 * HOUR))).toBeNull();
    expect(run('complete', patient, at(0))?.code).toBe('FORBIDDEN');
    expect(run('complete', admin, at(0))?.code).toBe('FORBIDDEN');
  });

  it('allows no-show strictly after the start', () => {
    expect(run('noShow', doctor, at(0))?.code).toBe('INVALID_STATE');
    expect(run('noShow', doctor, at(1))).toBeNull();
    expect(run('noShow', doctor, at(HOUR), { status: 'completed' })?.code).toBe('INVALID_STATE');
  });
});

describe('pay and review', () => {
  it('lets only the patient pay unpaid booked appointments before the start', () => {
    expect(run('pay', patient, at(-HOUR))).toBeNull();
    expect(run('pay', patient, at(-HOUR), { paymentStatus: 'paid' })?.code).toBe('INVALID_STATE');
    expect(run('pay', patient, at(HOUR))?.code).toBe('INVALID_STATE');
    expect(run('pay', doctor, at(-HOUR))?.code).toBe('FORBIDDEN');
  });

  it('lets a patient review a completed appointment once', () => {
    expect(run('review', patient, at(HOUR), { status: 'completed' })).toBeNull();
    expect(run('review', patient, at(HOUR))?.code).toBe('INVALID_STATE');
    expect(run('review', patient, at(HOUR), { status: 'completed', review: { rating: 5 } })?.code).toBe(
      'ALREADY_REVIEWED',
    );
  });
});

describe('actions and assertions', () => {
  it('computes the per requester flags', () => {
    const ctx = (user, now) => ({ appointment: appointment(), user, now, settings });
    expect(computeActions(ctx(patient, at(-5 * HOUR)))).toEqual({
      canCancel: true,
      canReschedule: true,
      canPay: true,
      canReview: false,
      canComplete: false,
      canMarkNoShow: false,
    });
    expect(computeActions(ctx(doctor, at(60_000)))).toMatchObject({
      canCancel: false,
      canComplete: true,
      canMarkNoShow: true,
      canPay: false,
    });
    expect(computeActions(ctx(admin, at(HOUR)))).toMatchObject({
      canCancel: true,
      canComplete: false,
      canReschedule: false,
    });
  });

  it('throws an AppError with the denial code', () => {
    expect(() =>
      assertAllowed('cancel', { appointment: appointment(), user: patient, now: at(-HOUR), settings }),
    ).toThrow(expect.objectContaining({ code: 'CANCELLATION_WINDOW_PASSED', status: 422 }));
    expect(() =>
      assertAllowed('cancel', { appointment: appointment(), user: patient, now: at(-5 * HOUR), settings }),
    ).not.toThrow();
  });
});
