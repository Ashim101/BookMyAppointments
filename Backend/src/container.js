import { createAnalyticsService } from './modules/analytics/analytics.service.js';
import { createAppointmentService } from './modules/appointments/appointment.service.js';
import { createAuditService } from './modules/audit/audit.service.js';
import { createGoogleVerifier } from './modules/auth/googleVerifier.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createOtpService } from './modules/auth/otp.service.js';
import { createPrincipals } from './modules/auth/principals.js';
import { createTokenService } from './modules/auth/tokens.service.js';
import { createDoctorService } from './modules/doctors/doctor.service.js';
import { createDoctorSelfService } from './modules/doctors/doctorSelf.service.js';
import { createMailer } from './modules/notifications/mailer.js';
import { createNotificationService } from './modules/notifications/notification.service.js';
import { createReminderJob } from './modules/notifications/reminderJob.js';
import { createPatientService } from './modules/patients/patient.service.js';
import { createPaymentService } from './modules/payments/payment.service.js';
import { createPaymentProvider } from './modules/payments/providers.js';
import { createRefundService } from './modules/payments/refund.service.js';
import { createReviewService } from './modules/reviews/review.service.js';
import { createSchedulingService } from './modules/scheduling/scheduling.service.js';
import { createSettingsService } from './modules/settings/settings.service.js';
import { createSpecialityService } from './modules/specialities/speciality.service.js';
import { createStorage } from './modules/uploads/storage.js';

/**
 * Wires services together. Anything that talks to the outside world (mail,
 * payments, storage, Google, the clock) can be replaced through `overrides`.
 */
export function createContainer({ config, logger, overrides = {} }) {
  const clock = overrides.clock ?? { now: () => Date.now() };
  const mailer = overrides.mailer ?? createMailer({ config, logger });
  const provider = overrides.payments ?? createPaymentProvider({ config });
  const storage = overrides.storage ?? createStorage({ config });
  const googleVerifier = 'googleVerifier' in overrides ? overrides.googleVerifier : createGoogleVerifier({ config });

  const settings = createSettingsService({ config, clock });
  const audit = createAuditService({ logger });
  const notifications = createNotificationService({ logger });
  const principals = createPrincipals({ config });
  const tokens = createTokenService({ config, clock });
  const otp = createOtpService({ config, clock, mailer });
  const auth = createAuthService({ config, clock, tokens, otp, principals, mailer, googleVerifier, logger });

  const scheduling = createSchedulingService({ settings, clock });
  const refunds = createRefundService({ provider, clock, logger });
  const appointments = createAppointmentService({ settings, scheduling, notifications, refunds, clock });
  const patients = createPatientService({ storage, tokens });
  const doctors = createDoctorService({ config, clock, settings, scheduling, storage, tokens });
  const doctorSelf = createDoctorSelfService({ settings, clock, doctors, appointments });
  const specialities = createSpecialityService();
  const reviews = createReviewService({ appointments });
  const payments = createPaymentService({ provider, appointments, notifications, refunds, clock });
  const analytics = createAnalyticsService({ settings, clock });
  const reminderJob = createReminderJob({ config, clock, mailer, notifications, logger });

  return {
    config,
    clock,
    mailer,
    storage,
    settings,
    audit,
    notifications,
    principals,
    tokens,
    auth,
    scheduling,
    appointments,
    patients,
    doctors,
    doctorSelf,
    specialities,
    reviews,
    payments,
    analytics,
    reminderJob,
  };
}
