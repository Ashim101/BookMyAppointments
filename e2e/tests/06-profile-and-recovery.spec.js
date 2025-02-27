import { expect, test } from '@playwright/test';
import { waitForMailMatch } from '../helpers/mail.js';
import { patientLogin, patientLogout, registerPatientViaApi } from '../helpers/ui.js';
import { urls } from '../scripts/stack.mjs';

const patient = { name: 'Rohan Verma', email: 'rohan.verma@example.com', password: 'Monsoon2026' };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test.describe.serial('patient: profile and password recovery', () => {
  test('updates the profile with a photo and keeps it after a reload', async ({ page, request }) => {
    await registerPatientViaApi(request, patient);
    await patientLogin(page, patient);
    await page.goto(`${urls.patient}/profile`);
    await page.getByLabel('Phone').fill('+977 9800000000');
    await page.getByLabel('Gender').selectOption('male');
    await page.getByLabel('Date of birth').fill('1994-05-17');
    await page.getByLabel('Address line 1').fill('7 River Street');
    await page.getByLabel('City').fill('Lalitpur');
    await page.locator('input[type=file]').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(/profile (has been )?(updated|saved)/i).first()).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Phone')).toHaveValue('+977 9800000000');
    await expect(page.getByLabel('Gender')).toHaveValue('male');
    await expect(page.getByLabel('Date of birth')).toHaveValue('1994-05-17');
    await expect(page.getByLabel('City')).toHaveValue('Lalitpur');
    const src = await page.getByRole('img', { name: patient.name }).first().getAttribute('src');
    expect(src).toContain('/uploads/');
    expect((await request.get(src)).status()).toBe(200);
  });

  test('resets a forgotten password with the emailed link', async ({ page }) => {
    const newPassword = 'Typhoon2027x';
    await page.goto(`${urls.patient}/forgot-password`);
    await page.getByLabel('Email').fill(patient.email);
    await page.getByRole('button', { name: /send|reset/i }).click();

    const link = await waitForMailMatch(patient.email, /(https?:\/\/\S+\/reset-password\?\S+)/);
    expect(link.startsWith(urls.patient)).toBe(true);
    await page.goto(link);
    await page.getByLabel('New password', { exact: true }).fill(newPassword);
    await page.getByLabel('Confirm new password').fill(newPassword);
    await page.getByRole('button', { name: /reset|save|update/i }).click();

    await patientLogin(page, { email: patient.email, password: newPassword });
    await patientLogout(page, patient.name);
  });
});
