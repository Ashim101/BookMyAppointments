import { Router } from 'express';
import { isDatabaseUp } from '../../config/db.js';
import { ok } from '../../utils/asyncHandler.js';

/** Reports process liveness, the database state and, when enabled, the reminder job. */
export function createHealthRoutes({ reminderJob, config }) {
  const router = Router();
  router.get('/', (_req, res) => {
    const db = isDatabaseUp() ? 'up' : 'down';
    const job = config.reminders.enabled ? reminderJob.status() : null;
    const payload = { status: 'ok', db, uptime: Math.round(process.uptime()), ...(job && { reminderJob: job }) };
    ok(res, payload);
  });
  return router;
}
