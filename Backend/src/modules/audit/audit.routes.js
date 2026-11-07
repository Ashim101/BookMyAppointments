import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler, ok } from '../../utils/asyncHandler.js';
import { paginationShape } from '../../utils/pagination.js';
import { dateString } from '../../utils/schemas.js';

const listSchema = {
  query: z.object({
    ...paginationShape,
    action: z.string().trim().max(80).optional(),
    actorRole: z.enum(['patient', 'doctor', 'admin']).optional(),
    from: dateString.optional(),
    to: dateString.optional(),
  }),
};

export function createAuditAdminRoutes({ audit }) {
  const router = Router();
  router.get('/', validate(listSchema), asyncHandler(async (req, res) => ok(res, await audit.list(req.valid.query))));
  return router;
}
