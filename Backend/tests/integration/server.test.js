import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { afterAll, describe, expect, inject, it } from 'vitest';
import { testEnv } from '../helpers/harness.js';

const SERVER = fileURLToPath(new URL('../../src/server.js', import.meta.url));

const freePort = () =>
  new Promise((resolve) => {
    const probe = net.createServer().listen(0, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

function start(env) {
  const child = spawn(process.execPath, [SERVER], {
    env: { PATH: process.env.PATH, ...env },
    // Not the Backend directory, so dotenv can never merge a developer's .env into the test environment.
    cwd: os.tmpdir(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = { stdout: '', stderr: '' };
  child.stdout.on('data', (chunk) => (output.stdout += chunk));
  child.stderr.on('data', (chunk) => (output.stderr += chunk));
  const exited = new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })));
  return { child, output, exited };
}

async function waitForHealth(port, exited) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const raced = await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 150, null))]);
    if (raced) throw new Error(`server exited early: ${JSON.stringify(raced)}`);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) return res.json();
    } catch {
      // not listening yet
    }
  }
  throw new Error('server did not become healthy');
}

const mongoUrl = new URL(inject('mongoUri'));
mongoUrl.pathname = '/bma_server_process_test';

describe('server process', () => {
  afterAll(async () => {
    const connection = await mongoose.createConnection(mongoUrl.toString()).asPromise();
    await connection.dropDatabase();
    await connection.close();
  });

  it('starts, serves traffic, runs the job and shuts down gracefully on SIGTERM', async () => {
    const port = await freePort();
    const { child, output, exited } = start({
      ...testEnv({ REMINDERS_ENABLED: 'true', LOG_LEVEL: 'info' }),
      PORT: String(port),
      MONGODB_URI: mongoUrl.toString(),
    });

    const health = await waitForHealth(port, exited);
    expect(health.data).toMatchObject({ status: 'ok', db: 'up', reminderJob: { running: true } });

    child.kill('SIGTERM');
    const result = await exited;
    expect(result).toEqual({ code: 0, signal: null });
    expect(output.stdout).toContain('shutting down');
    expect(output.stdout).toContain('shutdown complete');
    expect(output.stdout).not.toMatch(/JWT_|password/i);
  });

  it('exits non-zero with a readable message when the environment is invalid', async () => {
    const { output, exited } = start({ NODE_ENV: 'test', PORT: 'not-a-port' });
    const result = await exited;
    expect(result.code).toBe(1);
    expect(output.stderr).toContain('Invalid environment configuration');
    expect(output.stderr).toContain('JWT_ACCESS_SECRET');
    expect(output.stderr).toContain('PORT');
  });

  describe('in production', () => {
    const productionEnv = (port, extra = {}) => ({
      NODE_ENV: 'production',
      PORT: String(port),
      MONGODB_URI: mongoUrl.toString(),
      JWT_ACCESS_SECRET: 'f3a91c0d7be24a58a6d1c93e5b7f20c8d4e6a1b9',
      JWT_REFRESH_SECRET: '0b7d5e2f9a14c68d3e71f05a9c2b84d6e1a37f50',
      ADMIN_EMAIL: 'owner@clinic.test',
      ADMIN_PASSWORD_HASH: bcrypt.hashSync('Prod#Passw0rd', 4),
      CORS_ORIGINS: 'https://app.clinic.test',
      REMINDERS_ENABLED: 'false',
      BCRYPT_ROUNDS: '4',
      PAYMENTS_MODE: 'razorpay',
      RAZORPAY_KEY_ID: 'rzp_test_key',
      RAZORPAY_KEY_SECRET: 'test-key-secret',
      RAZORPAY_WEBHOOK_SECRET: 'test-webhook-secret',
      ...extra,
    });

    it.each([
      [
        'a placeholder JWT secret',
        { JWT_ACCESS_SECRET: 'change-me-change-me-change-me-change-me' },
        'JWT_ACCESS_SECRET',
      ],
      ['a short JWT secret', { JWT_REFRESH_SECRET: 'too-short-secret-value-123' }, 'JWT_REFRESH_SECRET'],
      ['a missing admin password hash', { ADMIN_PASSWORD_HASH: '' }, 'ADMIN_PASSWORD_HASH'],
      ['mock payments selected explicitly', { PAYMENTS_MODE: 'mock' }, 'PAYMENTS_MODE'],
      ['payments left on the default (mock)', { PAYMENTS_MODE: '' }, 'mock payments would mark'],
      ['a missing Razorpay webhook secret', { RAZORPAY_WEBHOOK_SECRET: '' }, 'RAZORPAY_WEBHOOK_SECRET'],
    ])('refuses to start with %s', async (_name, override, variable) => {
      const { output, exited } = start(productionEnv(await freePort(), override));
      expect((await exited).code).toBe(1);
      expect(output.stderr).toContain(variable);
    });

    it.each([
      ['by default', {}],
      ['even when debug logging is requested', { LOG_LEVEL: 'debug' }],
    ])('never logs OTPs or reset links %s', async (_name, extra) => {
      const port = await freePort();
      const { child, output, exited } = start(productionEnv(port, extra));
      await waitForHealth(port, exited);
      const email = `newcomer-${port}@example.com`;
      const post = (path, body) =>
        fetch(`http://127.0.0.1:${port}/api/auth${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
      expect((await post('/otp/request', { email })).status).toBe(200);
      expect((await post('/password/forgot', { email, role: 'patient' })).status).toBe(200);

      child.kill('SIGTERM');
      await exited;
      expect(output.stdout).toContain('email captured');
      expect(output.stdout).not.toMatch(/email body|reset-password|\b\d{6}\b/);
      if (!extra.LOG_LEVEL) expect(output.stdout).not.toContain('"level":20');
    });
  });
});
