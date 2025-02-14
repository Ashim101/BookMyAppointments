import { forbidden } from '../utils/AppError.js';

export const authorize =
  (...roles) =>
  (req, _res, next) =>
    roles.includes(req.user?.role) ? next() : next(forbidden('Your role cannot perform this action'));
