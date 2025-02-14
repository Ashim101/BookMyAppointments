import { asyncHandler, ok } from '../../utils/asyncHandler.js';

export function createAppointmentController(appointments) {
  return {
    create: asyncHandler(async (req, res) => ok(res, await appointments.book(req.user, req.valid.body), 201)),
    list: asyncHandler(async (req, res) => ok(res, await appointments.list(req.user, req.valid.query))),
    get: asyncHandler(async (req, res) => ok(res, await appointments.get(req.user, req.valid.params.id))),
    cancel: asyncHandler(async (req, res) =>
      ok(res, await appointments.cancel(req.user, req.valid.params.id, req.valid.body)),
    ),
    reschedule: asyncHandler(async (req, res) =>
      ok(res, await appointments.reschedule(req.user, req.valid.params.id, req.valid.body)),
    ),
    complete: asyncHandler(async (req, res) =>
      ok(res, await appointments.complete(req.user, req.valid.params.id, req.valid.body)),
    ),
    noShow: asyncHandler(async (req, res) =>
      ok(res, await appointments.markNoShow(req.user, req.valid.params.id)),
    ),
  };
}
