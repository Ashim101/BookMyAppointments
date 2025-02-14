import { spawn } from 'node:child_process';
import net from 'node:net';
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
});
