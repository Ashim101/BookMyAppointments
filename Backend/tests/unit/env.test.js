import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../../src/config/env.js';

const valid = {
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

const production = {
  NODE_ENV: 'production',
  JWT_ACCESS_SECRET: 'f3a91c0d7be24a58a6d1c93e5b7f20c8d4e6a1b9',
  JWT_REFRESH_SECRET: '0b7d5e2f9a14c68d3e71f05a9c2b84d6e1a37f50',
  ADMIN_EMAIL: 'owner@clinic.test',
  ADMIN_PASSWORD_HASH: '$2b$04$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz01234',
  CORS_ORIGINS: 'https://app.clinic.test',
};

const parseDotenv = (text) =>
  Object.fromEntries(
    text
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1).replace(/^"(.*)"$/, '$1')];
      }),
  );

describe('.env.example', () => {
  it('is a valid configuration once the two JWT secrets are filled in', () => {
    const example = parseDotenv(readFileSync(new URL('../../.env.example', import.meta.url), 'utf8'));
    expect(example.JWT_ACCESS_SECRET).toBe('');
    const config = loadConfig({
      ...example,
      JWT_ACCESS_SECRET: 'dummy-access-secret-value',
      JWT_REFRESH_SECRET: 'dummy-refresh-secret-value',
    });
    expect(config.port).toBe(4000);
    expect(config.mailFrom).toBe('BookMyAppointments <no-reply@example.com>');
    expect(config.loginLockout).toEqual({ maxFailures: 10, durationMs: 900_000 });
    expect(config.admin.email).toBeNull();
  });
});

describe('loadConfig', () => {
  it('applies defaults and treats empty strings as unset', () => {
    const config = loadConfig({
      ...valid,
      GOOGLE_CLIENT_ID: '',
      SMTP_HOST: '',
      ADMIN_EMAIL: '',
      CLOUDINARY_CLOUD_NAME: '',
    });
    expect(config.port).toBe(4000);
    expect(config.clinic).toMatchObject({
      timezone: 'Asia/Kathmandu',
      currency: 'INR',
      cancellationCutoffHours: 2,
      bookingWindowDays: 14,
    });
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
      ...production,
      PORT: '8080',
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
    expect(() => loadConfig({ ...valid, PAYMENTS_MODE: 'razorpay' })).toThrow(
      /RAZORPAY_KEY_ID: required when PAYMENTS_MODE=razorpay/,
    );
    const config = loadConfig({
      ...valid,
      PAYMENTS_MODE: 'razorpay',
      RAZORPAY_KEY_ID: 'k',
      RAZORPAY_KEY_SECRET: 's',
      RAZORPAY_WEBHOOK_SECRET: 'w',
    });
    expect(config.payments).toEqual({ mode: 'razorpay', keyId: 'k', keySecret: 's', webhookSecret: 'w' });
  });

  it('accepts a complete production configuration', () => {
    expect(loadConfig(production).isProduction).toBe(true);
  });

  it.each([
    [
      'placeholder secrets',
      { JWT_ACCESS_SECRET: 'please-change-me-please-change-me-123' },
      /JWT_ACCESS_SECRET: looks like a placeholder/,
    ],
    [
      'a repeated-character secret',
      { JWT_REFRESH_SECRET: 'a'.repeat(40) },
      /JWT_REFRESH_SECRET: looks like a placeholder/,
    ],
    [
      'short secrets',
      { JWT_ACCESS_SECRET: 'short-but-not-obvious-value-1' },
      /JWT_ACCESS_SECRET: must be at least 32/,
    ],
    [
      'identical secrets',
      { JWT_REFRESH_SECRET: production.JWT_ACCESS_SECRET },
      /must differ from JWT_ACCESS_SECRET/,
    ],
    [
      'a missing admin hash',
      { ADMIN_PASSWORD_HASH: undefined },
      /ADMIN_PASSWORD_HASH: required in production/,
    ],
    ['a missing admin email', { ADMIN_EMAIL: undefined }, /ADMIN_EMAIL: required in production/],
    ['default CORS origins', { CORS_ORIGINS: undefined }, /CORS_ORIGINS: must be set explicitly/],
  ])('refuses production with %s', (_name, override, message) => {
    expect(() => loadConfig({ ...production, ...override })).toThrow(message);
  });

  it('allows the same development defaults outside production', () => {
    expect(() => loadConfig({ ...valid, NODE_ENV: 'development' })).not.toThrow();
  });

  it('refuses mock payments next to live keys in production', () => {
    expect(() => loadConfig({ ...production, RAZORPAY_KEY_ID: 'rzp_live' })).toThrow(
      /mock payments must not run/,
    );
  });

  it('rejects a malformed admin hash and slot length', () => {
    expect(() => loadConfig({ ...valid, ADMIN_PASSWORD_HASH: 'plaintext' })).toThrow(/must be a bcrypt hash/);
    expect(() => loadConfig({ ...valid, DEFAULT_SLOT_MINUTES: '25' })).toThrow(/DEFAULT_SLOT_MINUTES/);
  });
});
