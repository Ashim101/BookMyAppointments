import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler, ok } from '../../utils/asyncHandler.js';
import { paginationShape } from '../../utils/pagination.js';
import { objectId } from '../../utils/schemas.js';

const adminListSchema = {
  query: z.object({
    ...paginationShape,
    doctorId: objectId.optional(),
    maxRating: z.coerce.number().int().min(1).max(5).optional(),
  }),
};
const idSchema = { params: z.object({ id: objectId }) };

export function createReviewController(reviews) {
  return {
    create: asyncHandler(async (req, res) =>
      ok(res, await reviews.create(req.user, req.valid.params.id, req.valid.body)),
    ),
    listForDoctor: asyncHandler(async (req, res) =>
      ok(res, await reviews.listForDoctor(req.valid.params.id, req.valid.query)),
    ),
  };
}

export function createReviewAdminRoutes({ reviews, audit }) {
  const router = Router();
  router.get(
    '/',
    validate(adminListSchema),
    asyncHandler(async (req, res) => ok(res, await reviews.listAll(req.valid.query))),
  );
  router.delete(
    '/:id',
    validate(idSchema),
    audit('review.delete', { targetType: 'review' }),
    asyncHandler(async (req, res) => ok(res, await reviews.remove(req.valid.params.id))),
  );
  return router;
}
