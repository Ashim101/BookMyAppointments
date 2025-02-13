import { Router } from 'express';
import { authorize } from '../../middlewares/authorize.js';
import { imageUpload } from '../../middlewares/upload.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler, ok } from '../../utils/asyncHandler.js';
import {
  activeSchema,
  adminListDoctorsSchema,
  adminScheduleSchema,
  availabilitySchema,
  createDoctorSchema,
  doctorIdSchema,
  doctorReviewsSchema,
  leaveIdSchema,
  leaveSchema,
  listDoctorsSchema,
  patientHistorySchema,
  scheduleSchema,
  selfProfileSchema,
  slotsSchema,
  updateDoctorSchema,
} from './doctor.validators.js';

export function createDoctorRoutes({ doctors, reviews, cache }) {
  const router = Router();
  router.get('/', cache(0), validate(listDoctorsSchema), asyncHandler(async (req, res) => ok(res, await doctors.listPublic(req.valid.query))));
  router.get('/:id', cache(0), validate(doctorIdSchema), asyncHandler(async (req, res) => ok(res, await doctors.getPublic(req.valid.params.id))));
  router.get('/:id/slots', validate(slotsSchema), asyncHandler(async (req, res) => ok(res, await doctors.getSlots(req.valid.params.id, req.valid.query))));
  router.get('/:id/reviews', cache(0), validate(doctorReviewsSchema), asyncHandler(async (req, res) => ok(res, await reviews.listForDoctor(req.valid.params.id, req.valid.query))));
  return router;
}

export function createDoctorSelfRoutes({ self, authenticate, audit }) {
  const router = Router();
  router.use(authenticate, authorize('doctor'));
  const handle = (fn, status) => asyncHandler(async (req, res) => ok(res, await fn(req), status));

  router.get('/profile', handle((req) => self.getProfile(req.user)));
  router.patch('/profile', validate(selfProfileSchema), audit('doctor.profile.update', { targetType: 'doctor' }), handle((req) => self.updateProfile(req.user, req.valid.body)));
  router.get('/schedule', handle((req) => self.getSchedule(req.user)));
  router.put('/schedule', validate(scheduleSchema), audit('doctor.schedule.update', { targetType: 'doctor' }), handle((req) => self.setSchedule(req.user, req.valid.body)));
  router.get('/leaves', handle((req) => self.listLeaves(req.user)));
  router.post('/leaves', validate(leaveSchema), audit('doctor.leave.create', { targetType: 'leave' }), handle((req) => self.addLeave(req.user, req.valid.body), 201));
  router.delete('/leaves/:id', validate(leaveIdSchema), audit('doctor.leave.delete', { targetType: 'leave' }), handle((req) => self.removeLeave(req.user, req.valid.params.id)));
  router.get('/dashboard', handle((req) => self.dashboard(req.user)));
  router.get('/patients/:patientId/appointments', validate(patientHistorySchema), handle((req) => self.patientHistory(req.user, req.valid.params.patientId)));
  return router;
}

export function createDoctorAdminRoutes({ doctors, audit }) {
  const router = Router();
  const handle = (fn, status) => asyncHandler(async (req, res) => ok(res, await fn(req), status));
  const target = { targetType: 'doctor' };

  router.get('/', validate(adminListDoctorsSchema), handle((req) => doctors.listAdmin(req.valid.query)));
  router.post('/', imageUpload, validate(createDoctorSchema), audit('doctor.create', target), handle((req) => doctors.create(req.valid.body, req.file), 201));
  router.patch('/:id', imageUpload, validate(updateDoctorSchema), audit('doctor.update', target), handle((req) => doctors.update(req.valid.params.id, req.valid.body, req.file)));
  router.patch('/:id/availability', validate(availabilitySchema), audit('doctor.availability', target), handle((req) => doctors.setAvailability(req.valid.params.id, req.valid.body.available)));
  router.patch('/:id/active', validate(activeSchema), audit('doctor.active', target), handle((req) => doctors.setActive(req.valid.params.id, req.valid.body.active)));
  router.put('/:id/schedule', validate(adminScheduleSchema), audit('doctor.schedule.update', target), handle((req) => doctors.setSchedule(req.valid.params.id, req.valid.body)));
  return router;
}
