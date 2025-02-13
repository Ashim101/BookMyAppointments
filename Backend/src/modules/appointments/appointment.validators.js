import { z } from 'zod';
import { paginationShape } from '../../utils/pagination.js';
import { dateString, objectId, timeString } from '../../utils/schemas.js';

const idParams = z.object({ id: objectId });

export const createAppointmentSchema = {
  body: z.object({
    doctorId: objectId,
    date: dateString,
    time: timeString,
    reason: z.string().trim().max(500).default(''),
  }),
};

export const listAppointmentsSchema = {
  query: z.object({
    ...paginationShape,
    status: z.enum(['booked', 'completed', 'cancelled', 'no_show']).optional(),
    from: dateString.optional(),
    to: dateString.optional(),
    doctorId: objectId.optional(),
    patientId: objectId.optional(),
    scope: z.enum(['upcoming', 'past']).optional(),
  }),
};

export const appointmentIdSchema = { params: idParams };

export const cancelSchema = {
  params: idParams,
  body: z.object({ reason: z.string().trim().max(500).default('') }),
};

export const rescheduleSchema = {
  params: idParams,
  body: z.object({ date: dateString, time: timeString }),
};

const prescriptionItem = z.object({
  medicine: z.string().trim().min(1).max(120),
  dosage: z.string().trim().max(80).default(''),
  frequency: z.string().trim().max(80).default(''),
  durationDays: z.number().int().min(0).max(365).default(0),
  instructions: z.string().trim().max(300).default(''),
});

export const completeSchema = {
  params: idParams,
  body: z.object({
    notes: z.string().trim().max(5000).default(''),
    prescription: z.array(prescriptionItem).max(20).default([]),
  }),
};

export const reviewSchema = {
  params: idParams,
  body: z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(1000).default(''),
  }),
};
