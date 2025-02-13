import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler, ok } from '../../utils/asyncHandler.js';
import { createSpecialitySchema, specialityIdSchema, updateSpecialitySchema } from './speciality.validators.js';

export function createSpecialityRoutes({ specialities, cache }) {
  const router = Router();
  router.get('/', cache(30), asyncHandler(async (_req, res) => ok(res, await specialities.list())));
  return router;
}

export function createSpecialityAdminRoutes({ specialities, audit }) {
  const router = Router();
  router.get('/', asyncHandler(async (_req, res) => ok(res, await specialities.list())));
  router.post(
    '/',
    validate(createSpecialitySchema),
    audit('speciality.create', { targetType: 'speciality' }),
    asyncHandler(async (req, res) => ok(res, await specialities.create(req.valid.body), 201)),
  );
  router.patch(
    '/:id',
    validate(updateSpecialitySchema),
    audit('speciality.update', { targetType: 'speciality' }),
    asyncHandler(async (req, res) => ok(res, await specialities.update(req.valid.params.id, req.valid.body))),
  );
  router.delete(
    '/:id',
    validate(specialityIdSchema),
    audit('speciality.delete', { targetType: 'speciality' }),
    asyncHandler(async (req, res) => ok(res, await specialities.remove(req.valid.params.id))),
  );
  return router;
}
