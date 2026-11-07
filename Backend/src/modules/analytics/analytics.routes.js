import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler, ok } from '../../utils/asyncHandler.js';
import { dateString } from '../../utils/schemas.js';

const timeseriesSchema = {
  query: z.object({
    from: dateString.optional(),
    to: dateString.optional(),
    interval: z.enum(['day', 'week', 'month']).default('day'),
  }),
};
const topDoctorsSchema = { query: z.object({ limit: z.coerce.number().int().min(1).max(50).default(5) }) };

export function createAnalyticsRoutes({ analytics }) {
  const router = Router();
  router.get('/summary', asyncHandler(async (_req, res) => ok(res, await analytics.summary())));
  router.get('/timeseries', validate(timeseriesSchema), asyncHandler(async (req, res) => ok(res, await analytics.timeseries(req.valid.query))));
  router.get('/specialities', asyncHandler(async (_req, res) => ok(res, await analytics.specialities())));
  router.get('/top-doctors', validate(topDoctorsSchema), asyncHandler(async (req, res) => ok(res, await analytics.topDoctors(req.valid.query))));
  return router;
}
