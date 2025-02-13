import { Router } from 'express';
import { z } from 'zod';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler, ok } from '../../utils/asyncHandler.js';
import { paginationShape } from '../../utils/pagination.js';
import { booleanQuery, objectId } from '../../utils/schemas.js';

const listSchema = { query: z.object({ ...paginationShape, unread: booleanQuery.optional() }) };
const idSchema = { params: z.object({ id: objectId }) };

export function createNotificationRoutes({ notifications, authenticate }) {
  const router = Router();
  router.use(authenticate, authorize('patient', 'doctor'));
  router.get('/', validate(listSchema), asyncHandler(async (req, res) => ok(res, await notifications.list(req.user, req.valid.query))));
  router.patch('/read-all', asyncHandler(async (req, res) => ok(res, await notifications.markAllRead(req.user))));
  router.patch('/:id/read', validate(idSchema), asyncHandler(async (req, res) => ok(res, await notifications.markRead(req.user, req.valid.params.id))));
  return router;
}
