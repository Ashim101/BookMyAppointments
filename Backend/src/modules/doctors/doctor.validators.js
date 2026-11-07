import { z } from 'zod';
import { paginationShape } from '../../utils/pagination.js';
import { addressSchema, booleanQuery, dateString, jsonField, objectId } from '../../utils/schemas.js';
import { scheduleBody } from '../scheduling/schedule.validators.js';
import { password } from '../auth/auth.validators.js';

const idParams = z.object({ id: objectId });

export const listDoctorsSchema = {
  query: z.object({
    ...paginationShape,
    speciality: z.string().trim().max(80).optional(),
    search: z.string().trim().max(80).optional(),
    minFee: z.coerce.number().min(0).optional(),
    maxFee: z.coerce.number().min(0).optional(),
    available: booleanQuery.optional(),
    sort: z.enum(['rating', 'fees_asc', 'fees_desc', 'experience', 'name']).default('rating'),
  }),
};

export const doctorIdSchema = { params: idParams };

export const slotsSchema = {
  params: idParams,
  query: z.object({ from: dateString.optional(), days: z.coerce.number().int().min(1).max(14).default(7) }),
};

export const doctorReviewsSchema = { params: idParams, query: z.object(paginationShape) };

export const adminListDoctorsSchema = {
  query: z.object({
    ...paginationShape,
    search: z.string().trim().max(80).optional(),
    speciality: z.string().trim().max(80).optional(),
    active: booleanQuery.optional(),
  }),
};

const fields = {
  name: z.string().trim().min(2).max(80),
  email: z.email().max(254).transform((value) => value.trim().toLowerCase()),
  speciality: z.string().trim().min(1).max(80),
  degree: z.string().trim().max(120),
  experienceYears: z.coerce.number().int().min(0).max(80),
  about: z.string().trim().max(2000),
  fees: z.coerce.number().min(0).max(1_000_000),
  address: jsonField(addressSchema),
  schedule: jsonField(scheduleBody),
};

export const createDoctorSchema = {
  body: z.object({
    ...fields,
    password,
    degree: fields.degree.default(''),
    experienceYears: fields.experienceYears.default(0),
    about: fields.about.default(''),
    address: fields.address.default({}),
    schedule: fields.schedule.optional(),
  }),
};

export const updateDoctorSchema = { params: idParams, body: z.object(fields).partial() };
export const availabilitySchema = { params: idParams, body: z.object({ available: z.boolean() }) };
export const activeSchema = { params: idParams, body: z.object({ active: z.boolean() }) };
export const adminScheduleSchema = { params: idParams, body: scheduleBody };

export const selfProfileSchema = {
  body: z.object({
    about: fields.about,
    fees: fields.fees,
    address: addressSchema,
    available: z.boolean(),
  }).partial(),
};

export const scheduleSchema = { body: scheduleBody };

export const leaveSchema = {
  body: z.object({
    date: dateString,
    reason: z.string().trim().max(200).default(''),
    cancelAppointments: z.boolean().default(false),
  }),
};

export const leaveIdSchema = { params: idParams };
export const patientHistorySchema = { params: z.object({ patientId: objectId }) };
