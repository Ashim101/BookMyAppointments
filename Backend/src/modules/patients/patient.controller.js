import { asyncHandler, ok } from '../../utils/asyncHandler.js';

export function createPatientController(patients) {
  return {
    getProfile: asyncHandler(async (req, res) => ok(res, await patients.getProfile(req.user.id))),
    updateProfile: asyncHandler(async (req, res) => ok(res, await patients.updateProfile(req.user.id, req.valid.body, req.file))),
    list: asyncHandler(async (req, res) => ok(res, await patients.list(req.valid.query))),
    setBlocked: asyncHandler(async (req, res) => ok(res, await patients.setBlocked(req.valid.params.id, req.valid.body.blocked))),
  };
}
