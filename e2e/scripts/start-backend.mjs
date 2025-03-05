// Brings up everything the API needs and then runs it in the foreground:
// MongoDB (a throwaway mongo:7 container unless E2E_MONGODB_URI is set), the demo seed, the server.
// Playwright starts and stops this script, so a single SIGTERM tears the whole backend down.
//
// The server runs with cwd = e2e/.run so that dotenv cannot pick up a developer's Backend/.env;
// every setting below is passed explicitly.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { admin, backendLog, mongoUri, ports, root, runDir, urls } from './stack.mjs';

const CONTAINER = 'bma-e2e-mongo';
const ownsMongo = !process.env.E2E_MONGODB_URI;

const backendDir = path.join(root, 'Backend');
const requireFromBackend = createRequire(path.join(backendDir, 'package.json'));
const bcrypt = requireFromBackend('bcrypt');
const { MongoClient } = createRequire(import.meta.url)('mongodb');

rmSync(runDir, { recursive: true, force: true });
mkdirSync(runDir, { recursive: true });

const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  NODE_ENV: 'development',
  PORT: String(ports.api),
  PUBLIC_URL: urls.api,
  MONGODB_URI: mongoUri,
  JWT_ACCESS_SECRET: 'e2e-access-secret-not-for-production',
  JWT_REFRESH_SECRET: 'e2e-refresh-secret-not-for-production',
  BCRYPT_ROUNDS: '4',
  // Short-lived access tokens make every long scenario exercise the clients' silent token refresh.
  ACCESS_TOKEN_TTL: '5s',
  ADMIN_EMAIL: admin.email,
  ADMIN_PASSWORD_HASH: bcrypt.hashSync(admin.password, 4),
  CORS_ORIGINS: `${urls.patient},${urls.staff}`,
  APP_URL_PATIENT: urls.patient,
  APP_URL_ADMIN: urls.staff,
  AUTH_RATE_LIMIT_MAX: '5000',
  LOGIN_MAX_FAILURES: '1000',
  REMINDERS_ENABLED: 'false',
  // Mock payments are only allowed outside production, which is why this stack runs as development.
  PAYMENTS_MODE: 'mock',
  // CI supplies a key it generated; otherwise a fresh one per run. The database is throwaway, so nothing
  // outlives the key and none is ever committed.
  DATA_ENCRYPTION_KEYS: process.env.DATA_ENCRYPTION_KEYS ?? `e2e:${randomBytes(32).toString('base64')}`,
  DATA_ENCRYPTION_ACTIVE_KEY_ID: process.env.DATA_ENCRYPTION_ACTIVE_KEY_ID ?? 'e2e',
  UPLOAD_DIR: path.join(runDir, 'uploads'),
  // Debug level makes the mailer log message bodies, which is how the tests read OTPs.
  LOG_LEVEL: 'debug',
};

function docker(...args) {
  return spawnSync('docker', args, { encoding: 'utf8' });
}

function stopMongo() {
  if (ownsMongo) docker('rm', '-f', CONTAINER);
}

async function waitForMongo() {
  const deadline = Date.now() + 60_000;
  for (;;) {
    const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 1000 });
    try {
      await client.connect();
      await client.db().command({ ping: 1 });
      return;
    } catch (err) {
      if (Date.now() > deadline) throw new Error(`MongoDB did not come up: ${err.message}`);
      await new Promise((r) => setTimeout(r, 500));
    } finally {
      await client.close().catch(() => {});
    }
  }
}

let server;
function shutdown() {
  if (!server) {
    stopMongo();
    process.exit(0);
  }
  server.kill('SIGTERM');
  // The server's own graceful shutdown may hang; do not leave it (or the container) behind.
  setTimeout(() => server.kill('SIGKILL'), 8000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);


try {
  if (ownsMongo) {
    docker('rm', '-f', CONTAINER);
    const started = docker('run', '-d', '--rm', '--name', CONTAINER, '-p', `127.0.0.1:${ports.mongo}:27017`, 'mongo:7');
    if (started.status !== 0) throw new Error(`could not start mongo:7: ${started.stderr}`);
  }
  await waitForMongo();

  const seed = spawnSync('node', [path.join(backendDir, 'scripts/seed.js'), '--reset'], {
    cwd: runDir,
    env,
    encoding: 'utf8',
  });
  if (seed.status !== 0) throw new Error(`seed failed:\n${seed.stdout}\n${seed.stderr}`);

  const log = createWriteStream(backendLog);
  server = spawn('node', [path.join(backendDir, 'src/server.js')], { cwd: runDir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  server.on('exit', (code) => {
    stopMongo();
    process.exit(code ?? 1);
  });
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  stopMongo();
  process.exit(1);
}
