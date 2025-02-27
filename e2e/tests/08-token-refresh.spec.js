import { expect, test } from '@playwright/test';
import { patientLogin, staffLogin } from '../helpers/ui.js';
import { admin, demoPatient, urls } from '../scripts/stack.mjs';

// The e2e API issues 5-second access tokens, so waiting a little makes the stored token expire.
const EXPIRY_WAIT_MS = 6_000;

const apps = [
  {
    name: 'patient app',
    key: 'bma.patient.auth',
    login: (page) => patientLogin(page, demoPatient),
    area: `${urls.patient}/my-appointments`,
    heading: 'My appointments',
    loginUrl: /\/login/,
  },
  {
    name: 'staff app',
    key: 'bma.staff.auth',
    login: (page) => staffLogin(page, admin, '/admin', 'admin'),
    area: `${urls.staff}/admin/patients`,
    heading: 'Patients',
    loginUrl: /\/login/,
  },
];

for (const app of apps) {
  test.describe(app.name, () => {
    test('refreshes an expired access token once and keeps the session', async ({ page }) => {
      await app.login(page);
      const before = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), app.key);
      await page.waitForTimeout(EXPIRY_WAIT_MS);

      const refreshes = [];
      page.on('request', (req) => req.url().endsWith('/api/auth/refresh') && refreshes.push(req));
      await page.goto(app.area);
      await expect(page.getByRole('heading', { name: app.heading, exact: true })).toBeVisible();
      expect(page).not.toHaveURL(app.loginUrl);
      expect(refreshes).toHaveLength(1);

      const after = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), app.key);
      expect(after.refreshToken).not.toBe(before.refreshToken);
    });

    test('signs out when the refresh token is no longer valid', async ({ page }) => {
      await app.login(page);
      await page.evaluate((key) => {
        const tokens = JSON.parse(localStorage.getItem(key));
        localStorage.setItem(key, JSON.stringify({ ...tokens, refreshToken: 'revoked-or-forged' }));
      }, app.key);
      await page.waitForTimeout(EXPIRY_WAIT_MS);
      await page.goto(app.area);
      await expect(page).toHaveURL(app.loginUrl);
      expect(await page.evaluate((key) => localStorage.getItem(key), app.key)).toBeNull();
    });
  });
}
