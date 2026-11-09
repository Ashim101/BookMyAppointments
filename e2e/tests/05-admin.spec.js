import { expect, test } from '@playwright/test';
import { patientLogin, staffLogin } from '../helpers/ui.js';
import { admin, urls } from '../scripts/stack.mjs';

const priya = { name: 'Priya Newcomer', email: 'priya.newcomer@example.com', password: 'Sunrise2026' };
const newDoctor = { name: 'Dr. Meera Kapoor', email: 'meera.kapoor@clinic.example.com', password: 'Welcome2026x' };
// A valid 1x1 PNG, generated in the test so that no binary fixture lives in the repository.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test.describe.serial('admin console', () => {
  test('the dashboard shows real analytics from the seeded data', async ({ page }) => {
    await staffLogin(page, admin, '/admin', 'admin');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    const appointments = page.locator('div').filter({ hasText: /^Appointments/ }).first();
    await expect(appointments).toBeVisible();
    // Seeded revenue and the speciality breakdown arrive from /admin/analytics/*.
    await expect(page.getByText('Appointments by speciality')).toBeVisible();
    await expect(page.getByText('General physician').first()).toBeVisible();
    await expect(page.getByText('Top doctors')).toBeVisible();
    await expect(page.getByText(/₹\s?[\d,]+/).first()).toBeVisible();
  });

  test('creates a doctor who can then sign in and is listed to patients', async ({ page, browser }) => {
    await staffLogin(page, admin, '/admin', 'admin');
    await page.goto(`${urls.staff}/admin/doctors`);
    await page.getByRole('button', { name: 'Add doctor' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Full name').fill(newDoctor.name);
    await dialog.getByLabel('Email').fill(newDoctor.email);
    await dialog.getByLabel('Initial password').fill(newDoctor.password);
    await dialog.getByLabel('Speciality').selectOption({ label: 'Dermatologist' });
    await dialog.getByLabel('Degree').fill('MBBS, MD Dermatology');
    await dialog.getByLabel('Experience (years)').fill('9');
    await dialog.getByLabel('Consultation fees').fill('650');
    await dialog.getByLabel('About').fill('Skin and hair specialist with a focus on eczema.');
    await dialog.getByLabel('Address line 1').fill('12 Lake Road');
    await dialog.getByLabel('City').fill('Pokhara');
    await dialog.getByLabel(/Photo/).setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: PNG });
    await dialog.getByRole('button', { name: /^(Create|Add|Save)/ }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByRole('row').filter({ hasText: newDoctor.name })).toBeVisible();

    const doctorPage = await (await browser.newContext()).newPage();
    await staffLogin(doctorPage, newDoctor, '/doctor', 'doctor');
    await doctorPage.context().close();

    const patientPage = await (await browser.newContext()).newPage();
    await patientPage.goto(`${urls.patient}/doctors?search=Meera`);
    await expect(patientPage.getByRole('link', { name: new RegExp(newDoctor.name) }).first()).toBeVisible();
    await patientPage.context().close();
  });

  test('blocks a patient, who can then no longer sign in', async ({ page, browser }) => {
    await staffLogin(page, admin, '/admin', 'admin');
    await page.goto(`${urls.staff}/admin/patients`);
    await page.getByLabel('Search by name or email').fill(priya.email);
    const row = page.getByRole('row').filter({ hasText: priya.email });
    await row.getByRole('button', { name: 'Block' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Block' }).click();
    await expect(row).toContainText(/blocked/i);

    const patientPage = await (await browser.newContext()).newPage();
    await patientPage.goto(`${urls.patient}/login`);
    await patientPage.getByLabel('Email').fill(priya.email);
    await patientPage.getByLabel('Password').fill(priya.password);
    await patientPage.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(patientPage).toHaveURL(/\/login/);
    await expect(patientPage.getByRole('alert')).toContainText(/blocked|suspended|disabled/i);
    await patientPage.context().close();
  });
});
