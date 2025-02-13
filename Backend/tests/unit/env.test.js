import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../../src/config/env.js';

const valid = {
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

describe('loadConfig', () => {
  it('applies defaults and treats empty strings as unset', () => {
    const config = loadConfig({ ...valid, GOOGLE_CLIENT_ID: '', SMTP_HOST: '', ADMIN_EMAIL: '', CLOUDINARY_CLOUD_NAME: '' });
    expect(config.port).toBe(4000);
    expect(config.clinic).toMatchObject({ timezone: 'Asia/Kathmandu', currency: 'INR', cancellationCutoffHours: 2, bookingWindowDays: 14 });
    expect(config.corsOrigins).toEqual(['http://localhost:5173', 'http://localhost:5174']);
    expect(config.payments.mode).toBe('mock');
    expect(config.googleClientId).toBeNull();
    expect(config.smtp).toBeNull();
    expect(config.cloudinary).toBeNull();
    expect(config.admin.email).toBeNull();
    expect(config.reminders).toMatchObject({ enabled: true, intervalMs: 600_000, leadHours: 24 });
    expect(config.logLevel).toBe('debug');
  });

  it('parses typed values', () => {
    const config = loadConfig({
      ...valid,
      PORT: '8080',
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://a.example, https://b.example ,',
      ADMIN_EMAIL: 'Admin@Example.com',
      CANCELLATION_CUTOFF_HOURS: '6',
      REMINDERS_ENABLED: 'false',
      SMTP_HOST: 'smtp.example.com',
    });
    expect(config.port).toBe(8080);
    expect(config.isProduction).toBe(true);
    expect(config.logLevel).toBe('info');
    expect(config.corsOrigins).toEqual(['https://a.example', 'https://b.example']);
    expect(config.admin.email).toBe('admin@example.com');
    expect(config.clinic.cancellationCutoffHours).toBe(6);
    expect(config.reminders.enabled).toBe(false);
    expect(config.smtp).toMatchObject({ host: 'smtp.example.com', port: 587 });
  });

  it('fails fast with a readable list of every problem', () => {
    expect.assertions(4);
    try {
      loadConfig({ JWT_ACCESS_SECRET: 'short', PORT: 'abc', CLINIC_TIMEZONE: 'Mars/Base' });
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect(err.message).toContain('JWT_ACCESS_SECRET: must be at least 16 characters');
      expect(err.message).toContain('JWT_REFRESH_SECRET');
      expect(err.message).toContain('CLINIC_TIMEZONE: unknown IANA timezone');
    }
  });

  it('requires Razorpay credentials when that mode is selected', () => {
    expect(() => loadConfig({ ...valid, PAYMENTS_MODE: 'razorpay' })).toThrow(/RAZORPAY_KEY_ID: required when PAYMENTS_MODE=razorpay/);
    const config = loadConfig({
      ...valid,
      PAYMENTS_MODE: 'razorpay',
      RAZORPAY_KEY_ID: 'k',
      RAZORPAY_KEY_SECRET: 's',
      RAZORPAY_WEBHOOK_SECRET: 'w',
    });
    expect(config.payments).toEqual({ mode: 'razorpay', keyId: 'k', keySecret: 's', webhookSecret: 'w' });
  });

  it('refuses mock payments next to live keys in production', () => {
    expect(() => loadConfig({ ...valid, NODE_ENV: 'production', RAZORPAY_KEY_ID: 'rzp_live' })).toThrow(/mock payments must not run/);
  });

  it('rejects a malformed admin hash and slot length', () => {
    expect(() => loadConfig({ ...valid, ADMIN_PASSWORD_HASH: 'plaintext' })).toThrow(/must be a bcrypt hash/);
    expect(() => loadConfig({ ...valid, DEFAULT_SLOT_MINUTES: '25' })).toThrow(/DEFAULT_SLOT_MINUTES/);
  });
});
