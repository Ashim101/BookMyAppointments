import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import {
  forgotSchema,
  googleSchema,
  loginSchema,
  otpRequestSchema,
  refreshSchema,
  registerSchema,
  resetSchema,
} from './auth.validators.js';

export function createAuthRoutes({ controller, authenticate, limiter }) {
  const router = Router();
  router.use(limiter);
  router.post('/otp/request', validate(otpRequestSchema), controller.requestOtp);
  router.post('/register', validate(registerSchema), controller.register);
  router.post('/login', validate(loginSchema), controller.login);
  router.post('/google', validate(googleSchema), controller.google);
  router.post('/refresh', validate(refreshSchema), controller.refresh);
  router.post('/logout', validate(refreshSchema), controller.logout);
  router.post('/password/forgot', validate(forgotSchema), controller.forgotPassword);
  router.post('/password/reset', validate(resetSchema), controller.resetPassword);
  router.get('/me', authenticate, controller.me);
  return router;
}
