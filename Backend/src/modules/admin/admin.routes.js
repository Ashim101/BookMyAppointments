import { Router } from 'express';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { streamCsv } from '../../utils/csv.js';
import { listAppointmentsSchema } from '../appointments/appointment.validators.js';

export const EXPORT_COLUMNS = ['id', 'date', 'time', 'patient', 'patientEmail', 'doctor', 'speciality', 'status', 'paymentStatus', 'fee', 'currency', 'createdAt'];

export const toExportRow = (a) => [
  String(a._id),
  a.date,
  a.time,
  a.patientInfo.name,
  a.patientInfo.email,
  a.doctorInfo.name,
  a.doctorInfo.specialityName,
  a.status,
  a.paymentStatus,
  a.fee,
  a.currency,
  a.createdAt,
];

/** Mounts every `/api/admin/*` router behind admin authentication. */
export function createAdminRoutes({ authenticate, appointments, routers }) {
  const router = Router();
  router.use(authenticate, authorize('admin'));

  router.get(
    '/appointments/export',
    validate(listAppointmentsSchema),
    asyncHandler((req, res) =>
      streamCsv(res, {
        filename: 'appointments.csv',
        columns: EXPORT_COLUMNS,
        cursor: appointments.exportCursor(req.user, req.valid.query),
        toRow: toExportRow,
      }),
    ),
  );

  for (const [path, child] of Object.entries(routers)) router.use(path, child);
  return router;
}
