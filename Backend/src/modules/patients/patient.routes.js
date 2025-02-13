import { Router } from 'express';
import { authorize } from '../../middlewares/authorize.js';
import { imageUpload } from '../../middlewares/upload.js';
import { validate } from '../../middlewares/validate.js';
import { blockSchema, listPatientsSchema, updateProfileSchema } from './patient.validators.js';

export function createPatientRoutes({ controller, authenticate }) {
  const router = Router();
  router.use(authenticate, authorize('patient'));
  router.get('/profile', controller.getProfile);
  router.patch('/profile', imageUpload, validate(updateProfileSchema), controller.updateProfile);
  return router;
}

export function createPatientAdminRoutes({ controller, audit }) {
  const router = Router();
  router.get('/', validate(listPatientsSchema), controller.list);
  router.patch('/:id/block', validate(blockSchema), audit('patient.block', { targetType: 'patient' }), controller.setBlocked);
  return router;
}
