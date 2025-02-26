import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler, ok } from '../../utils/asyncHandler.js';

const updateSchema = {
  body: z
    .object({
      cancellationCutoffHours: z.number().min(0).max(168),
      bookingWindowDays: z.number().int().min(1).max(365),
      defaultSlotMinutes: z.union([
        z.literal(15),
        z.literal(20),
        z.literal(30),
        z.literal(45),
        z.literal(60),
      ]),
      currency: z
        .string()
        .length(3)
        .transform((value) => value.toUpperCase()),
    })
    .partial(),
};

export function createSettingsAdminRoutes({ settings, audit }) {
  const router = Router();
  router.get(
    '/',
    asyncHandler(async (_req, res) => ok(res, await settings.get())),
  );
  router.put(
    '/',
    validate(updateSchema),
    audit('settings.update'),
    asyncHandler(async (req, res) => ok(res, await settings.update(req.valid.body))),
  );
  return router;
}

/** The subset of the settings that clients need before anyone is signed in. */
export function createSettingsPublicRoutes({ settings }) {
  const router = Router();
  router.get(
    '/public',
    asyncHandler(async (_req, res) => {
      const { cancellationCutoffHours, bookingWindowDays, timezone, currency } = await settings.get();
      ok(res, { cancellationCutoffHours, bookingWindowDays, timezone, currency });
    }),
  );
  return router;
}
