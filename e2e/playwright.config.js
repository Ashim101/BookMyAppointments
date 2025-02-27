import { defineConfig } from '@playwright/test';
import { ports, root, urls } from './scripts/stack.mjs';

const fromApp = (dir) => `${root}/${dir}`;
const viteEnv = {
  VITE_API_URL: urls.api,
  // Set explicitly so a developer's local .env files cannot leak real values into the run.
  VITE_GOOGLE_CLIENT_ID: '',
};

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  // The scenarios share one database and build on each other's data, so they run in order.
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'exec node scripts/start-backend.mjs',
      url: `${urls.api}/api/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${ports.patient} --strictPort`,
      cwd: fromApp('Book-My-Appointment'),
      env: viteEnv,
      url: urls.patient,
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${ports.staff} --strictPort`,
      cwd: fromApp('admin'),
      env: viteEnv,
      url: urls.staff,
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});
