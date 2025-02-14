import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createContainer } from './container.js';
import { createAuditMiddleware } from './middlewares/audit.js';
import { createAuthenticate } from './middlewares/authenticate.js';
import { cache } from './middlewares/cache.js';
import { createErrorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { createAuthLimiter } from './middlewares/rateLimiters.js';
import { createRequestContext } from './middlewares/requestContext.js';
import { createAdminRoutes } from './modules/admin/admin.routes.js';
import { createAnalyticsRoutes } from './modules/analytics/analytics.routes.js';
import { createAppointmentController } from './modules/appointments/appointment.controller.js';
import { createAppointmentRoutes } from './modules/appointments/appointment.routes.js';
import { createAuditAdminRoutes } from './modules/audit/audit.routes.js';
import { createAuthController } from './modules/auth/auth.controller.js';
import { createAuthRoutes } from './modules/auth/auth.routes.js';
import {
  createDoctorAdminRoutes,
  createDoctorRoutes,
  createDoctorSelfRoutes,
} from './modules/doctors/doctor.routes.js';
import { createHealthRoutes } from './modules/health/health.routes.js';
import { createNotificationRoutes } from './modules/notifications/notification.routes.js';
import { createPatientController } from './modules/patients/patient.controller.js';
import { createPatientAdminRoutes, createPatientRoutes } from './modules/patients/patient.routes.js';
import { createPaymentRoutes, createPaymentWebhookRoute } from './modules/payments/payment.routes.js';
import { createReviewAdminRoutes, createReviewController } from './modules/reviews/review.routes.js';
import { createSettingsAdminRoutes } from './modules/settings/settings.routes.js';
import {
  createSpecialityAdminRoutes,
  createSpecialityRoutes,
} from './modules/specialities/speciality.routes.js';
import { createLogger } from './utils/logger.js';

/**
 * Builds the Express application without listening. `deps.config` is required;
 * `deps.logger` and `deps.overrides` (clock, mailer, payments, storage,
 * googleVerifier) are optional. The service container is on `app.locals.container`.
 */
export function createApp({ config, logger = createLogger(config.logLevel), overrides } = {}) {
  const container = createContainer({ config, logger, overrides });
  const authenticate = createAuthenticate({ config, loadPrincipal: container.principals.load });
  const audit = createAuditMiddleware(container.audit);

  const app = express();
  app.locals.container = container;
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(createRequestContext(logger));
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, done) => done(null, !origin || config.corsOrigins.includes(origin)),
      maxAge: 600,
    }),
  );

  // The Razorpay signature covers the raw bytes, so this route is mounted before the JSON parser.
  app.use('/api/payments/webhook', createPaymentWebhookRoute({ payments: container.payments }));
  app.use(express.json({ limit: config.bodyLimit }));
  app.use('/uploads', express.static(container.storage.uploadDir, { index: false, maxAge: '7d' }));

  const reviewController = createReviewController(container.reviews);
  const adminRouters = {
    '/doctors': createDoctorAdminRoutes({ doctors: container.doctors, audit }),
    '/patients': createPatientAdminRoutes({ controller: createPatientController(container.patients), audit }),
    '/specialities': createSpecialityAdminRoutes({ specialities: container.specialities, audit }),
    '/reviews': createReviewAdminRoutes({ reviews: container.reviews, audit }),
    '/settings': createSettingsAdminRoutes({ settings: container.settings, audit }),
    '/audit-logs': createAuditAdminRoutes({ audit: container.audit }),
    '/analytics': createAnalyticsRoutes({ analytics: container.analytics }),
  };

  app.use('/api/health', createHealthRoutes({ reminderJob: container.reminderJob, config }));
  app.use(
    '/api/auth',
    createAuthRoutes({
      controller: createAuthController(container.auth),
      authenticate,
      limiter: createAuthLimiter(config),
    }),
  );
  app.use('/api/specialities', createSpecialityRoutes({ specialities: container.specialities, cache }));
  app.use(
    '/api/doctors',
    createDoctorRoutes({ doctors: container.doctors, reviews: container.reviews, cache }),
  );
  app.use(
    '/api/patient',
    createPatientRoutes({ controller: createPatientController(container.patients), authenticate }),
  );
  app.use(
    '/api/appointments',
    createAppointmentRoutes({
      controller: createAppointmentController(container.appointments),
      reviewController,
      authenticate,
      audit,
    }),
  );
  app.use('/api/payments', createPaymentRoutes({ payments: container.payments, authenticate }));
  app.use(
    '/api/notifications',
    createNotificationRoutes({ notifications: container.notifications, authenticate }),
  );
  app.use('/api/doctor', createDoctorSelfRoutes({ self: container.doctorSelf, authenticate, audit }));
  app.use(
    '/api/admin',
    createAdminRoutes({ authenticate, appointments: container.appointments, routers: adminRouters }),
  );

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
  return app;
}
