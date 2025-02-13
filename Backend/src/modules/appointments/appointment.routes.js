import { Router } from 'express';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import {
  appointmentIdSchema,
  cancelSchema,
  completeSchema,
  createAppointmentSchema,
  listAppointmentsSchema,
  rescheduleSchema,
  reviewSchema,
} from './appointment.validators.js';

export function createAppointmentRoutes({ controller, reviewController, authenticate, audit }) {
  const router = Router();
  router.use(authenticate);

  router.post('/', authorize('patient'), validate(createAppointmentSchema), controller.create);
  router.get('/', validate(listAppointmentsSchema), controller.list);
  router.get('/:id', validate(appointmentIdSchema), controller.get);
  router.patch(
    '/:id/cancel',
    validate(cancelSchema),
    audit('appointment.cancel', { targetType: 'appointment', roles: ['doctor', 'admin'] }),
    controller.cancel,
  );
  router.patch('/:id/reschedule', authorize('patient'), validate(rescheduleSchema), controller.reschedule);
  router.patch(
    '/:id/complete',
    authorize('doctor'),
    validate(completeSchema),
    audit('appointment.complete', { targetType: 'appointment' }),
    controller.complete,
  );
  router.patch(
    '/:id/no-show',
    authorize('doctor'),
    validate(appointmentIdSchema),
    audit('appointment.no_show', { targetType: 'appointment' }),
    controller.noShow,
  );
  router.post('/:id/review', authorize('patient'), validate(reviewSchema), reviewController.create);
  return router;
}
