import { asyncHandler, ok } from '../../utils/asyncHandler.js';
import { toAuthUser } from './principals.js';

export function createAuthController(auth) {
  const meta = (req) => ({ ip: req.ip });
  const handle = (fn) => asyncHandler(async (req, res) => ok(res, await fn(req.valid.body, meta(req))));

  return {
    requestOtp: handle(auth.requestOtp),
    register: handle(auth.register),
    login: handle(auth.login),
    google: handle(auth.google),
    refresh: handle(auth.refresh),
    logout: handle(auth.logout),
    forgotPassword: handle(auth.forgotPassword),
    resetPassword: handle(auth.resetPassword),
    me: (req, res) => ok(res, toAuthUser(req.user)),
  };
}
