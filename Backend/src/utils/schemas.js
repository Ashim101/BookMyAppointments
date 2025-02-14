import { z } from 'zod';
import { isValidDate, isValidTime } from './time.js';

export const addressDefinition = {
  line1: { type: String, default: '', trim: true, maxlength: 120 },
  line2: { type: String, default: '', trim: true, maxlength: 120 },
  city: { type: String, default: '', trim: true, maxlength: 80 },
};

export const addressSchema = z.object({
  line1: z.string().trim().max(120).default(''),
  line2: z.string().trim().max(120).default(''),
  city: z.string().trim().max(80).default(''),
});

export const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid id');
export const dateString = z.string().refine(isValidDate, 'Expected a date as YYYY-MM-DD');
export const timeString = z.string().refine(isValidTime, 'Expected a time as HH:mm');
export const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');

/** Parses a JSON-encoded multipart field, leaving undefined untouched. */
export const jsonField = (schema) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }, schema);

export const toAddressDto = (address) => ({
  line1: address?.line1 ?? '',
  line2: address?.line2 ?? '',
  city: address?.city ?? '',
});
