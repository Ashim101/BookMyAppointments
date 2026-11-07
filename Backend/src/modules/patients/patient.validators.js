import { z } from 'zod';
import { paginationShape } from '../../utils/pagination.js';
import { addressSchema, booleanQuery, dateString, jsonField, objectId } from '../../utils/schemas.js';

export const updateProfileSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: z.string().trim().max(30).regex(/^[+\d][\d\s()-]*$|^$/, 'Invalid phone number').optional(),
    gender: z.enum(['male', 'female', 'other', 'unspecified']).optional(),
    dob: z.union([dateString, z.literal('')]).optional(),
    address: jsonField(addressSchema).optional(),
  }),
};

export const listPatientsSchema = {
  query: z.object({
    ...paginationShape,
    search: z.string().trim().max(80).optional(),
    blocked: booleanQuery.optional(),
  }),
};

export const blockSchema = {
  params: z.object({ id: objectId }),
  body: z.object({ blocked: z.boolean() }),
};
