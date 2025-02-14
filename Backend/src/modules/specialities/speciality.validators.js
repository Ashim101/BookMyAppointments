import { z } from 'zod';
import { objectId } from '../../utils/schemas.js';

const name = z.string().trim().min(2).max(80);
const description = z.string().trim().max(500);

export const createSpecialitySchema = { body: z.object({ name, description: description.default('') }) };

export const updateSpecialitySchema = {
  params: z.object({ id: objectId }),
  body: z.object({ name: name.optional(), description: description.optional() }),
};

export const specialityIdSchema = { params: z.object({ id: objectId }) };
