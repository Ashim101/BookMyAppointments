import { z } from 'zod';

const isValidZone = (zone) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

const csv = (fallback) =>
  z
    .string()
    .default(fallback)
    .transform((value) =>
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    );

const bool = z.enum(['true', 'false']).transform((value) => value === 'true');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/bookmyappointments'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
    PUBLIC_URL: z.url().optional(),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    JSON_BODY_LIMIT: z.string().default('100kb'),
    UPLOAD_DIR: z.string().default('uploads'),

    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

    JWT_ACCESS_SECRET: z.string().min(16, 'must be at least 16 characters'),
    JWT_REFRESH_SECRET: z.string().min(16, 'must be at least 16 characters'),
    ACCESS_TOKEN_TTL: z.string().default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),

    ADMIN_EMAIL: z.email().optional(),
    ADMIN_PASSWORD_HASH: z.string().startsWith('$2', 'must be a bcrypt hash').optional(),

    CORS_ORIGINS: csv('http://localhost:5173,http://localhost:5174'),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(30),
    LOGIN_MAX_FAILURES: z.coerce.number().int().min(1).default(10),
    LOGIN_LOCKOUT_MINUTES: z.coerce.number().min(0.01).default(15),
    AUTH_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().min(0.01).default(15),

    CLINIC_TIMEZONE: z.string().default('Asia/Kathmandu').refine(isValidZone, 'unknown IANA timezone'),
    CURRENCY: z.string().length(3).toUpperCase().default('INR'),
    CANCELLATION_CUTOFF_HOURS: z.coerce.number().min(0).max(168).default(2),
    BOOKING_WINDOW_DAYS: z.coerce.number().int().min(1).max(365).default(14),
    DEFAULT_SLOT_MINUTES: z.coerce
      .number()
      .int()
      .refine((v) => [15, 20, 30, 45, 60].includes(v))
      .default(30),

    APP_URL_PATIENT: z.url().default('http://localhost:5173'),
    APP_URL_ADMIN: z.url().default('http://localhost:5174'),

    GOOGLE_CLIENT_ID: z.string().optional(),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),

    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().default('BookMyAppointments <no-reply@example.com>'),

    PAYMENTS_MODE: z.enum(['mock', 'razorpay']).default('mock'),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

    REMINDERS_ENABLED: bool.default(true),
    REMINDER_INTERVAL_MINUTES: z.coerce.number().min(0.01).default(10),
    REMINDER_LEAD_HOURS: z.coerce.number().min(0.01).default(24),
  })
  .superRefine((env, ctx) => {
    if (env.PAYMENTS_MODE === 'razorpay') {
      for (const key of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET']) {
        if (!env[key])
          ctx.addIssue({ code: 'custom', path: [key], message: 'required when PAYMENTS_MODE=razorpay' });
      }
    }
    if (env.NODE_ENV === 'production' && env.PAYMENTS_MODE === 'mock' && env.RAZORPAY_KEY_ID) {
      ctx.addIssue({
        code: 'custom',
        path: ['PAYMENTS_MODE'],
        message: 'mock payments must not run alongside live keys in production',
      });
    }
  });

export class ConfigError extends Error {
  constructor(issues) {
    super(
      `Invalid environment configuration:\n${issues.map((i) => `  - ${i.path.join('.') || 'env'}: ${i.message}`).join('\n')}`,
    );
    this.name = 'ConfigError';
  }
}

export function loadConfig(source = process.env) {
  const present = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ''),
  );
  const parsed = schema.safeParse(present);
  if (!parsed.success) throw new ConfigError(parsed.error.issues);
  const e = parsed.data;

  const cloudinary =
    e.CLOUDINARY_CLOUD_NAME && e.CLOUDINARY_API_KEY && e.CLOUDINARY_API_SECRET
      ? {
          cloudName: e.CLOUDINARY_CLOUD_NAME,
          apiKey: e.CLOUDINARY_API_KEY,
          apiSecret: e.CLOUDINARY_API_SECRET,
        }
      : null;

  return Object.freeze({
    env: e.NODE_ENV,
    isProduction: e.NODE_ENV === 'production',
    port: e.PORT,
    mongoUri: e.MONGODB_URI,
    logLevel:
      e.LOG_LEVEL ?? (e.NODE_ENV === 'production' ? 'info' : e.NODE_ENV === 'test' ? 'silent' : 'debug'),
    publicUrl: (e.PUBLIC_URL ?? `http://localhost:${e.PORT}`).replace(/\/$/, ''),
    trustProxy: e.TRUST_PROXY,
    bodyLimit: e.JSON_BODY_LIMIT,
    uploadDir: e.UPLOAD_DIR,
    bcryptRounds: e.BCRYPT_ROUNDS,
    jwt: {
      accessSecret: e.JWT_ACCESS_SECRET,
      refreshSecret: e.JWT_REFRESH_SECRET,
      accessTtl: e.ACCESS_TOKEN_TTL,
      refreshTtlDays: e.REFRESH_TOKEN_TTL_DAYS,
    },
    admin: { email: e.ADMIN_EMAIL?.toLowerCase() ?? null, passwordHash: e.ADMIN_PASSWORD_HASH ?? null },
    corsOrigins: e.CORS_ORIGINS,
    loginLockout: {
      maxFailures: e.LOGIN_MAX_FAILURES,
      durationMs: Math.round(e.LOGIN_LOCKOUT_MINUTES * 60_000),
    },
    authRateLimit: {
      max: e.AUTH_RATE_LIMIT_MAX,
      windowMs: Math.round(e.AUTH_RATE_LIMIT_WINDOW_MINUTES * 60_000),
    },
    clinic: {
      timezone: e.CLINIC_TIMEZONE,
      currency: e.CURRENCY,
      cancellationCutoffHours: e.CANCELLATION_CUTOFF_HOURS,
      bookingWindowDays: e.BOOKING_WINDOW_DAYS,
      defaultSlotMinutes: e.DEFAULT_SLOT_MINUTES,
    },
    appUrls: { patient: e.APP_URL_PATIENT.replace(/\/$/, ''), admin: e.APP_URL_ADMIN.replace(/\/$/, '') },
    googleClientId: e.GOOGLE_CLIENT_ID ?? null,
    cloudinary,
    smtp: e.SMTP_HOST ? { host: e.SMTP_HOST, port: e.SMTP_PORT, user: e.SMTP_USER, pass: e.SMTP_PASS } : null,
    mailFrom: e.MAIL_FROM,
    payments: {
      mode: e.PAYMENTS_MODE,
      keyId: e.RAZORPAY_KEY_ID ?? null,
      keySecret: e.RAZORPAY_KEY_SECRET ?? null,
      webhookSecret: e.RAZORPAY_WEBHOOK_SECRET ?? null,
    },
    reminders: {
      enabled: e.REMINDERS_ENABLED,
      intervalMs: Math.round(e.REMINDER_INTERVAL_MINUTES * 60_000),
      leadHours: e.REMINDER_LEAD_HOURS,
    },
  });
}
