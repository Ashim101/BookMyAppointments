import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { staffLogin } from '../helpers/ui.js';
import { admin, doctorPassword, urls } from '../scripts/stack.mjs';

const doctor = { email: 'aarav.sharma@clinic.example.com', password: doctorPassword };
const publicGet = async (request, path) => (await (await request.get(`${urls.api}/api${path}`)).json()).data;

test.describe('doctor console', () => {
  test('dashboard, profile, leaves and schedule talk to the API correctly', async ({ page, request }) => {
    await staffLogin(page, doctor, '/doctor', 'doctor');

    await page.goto(`${urls.staff}/doctor`);
    await expect(page.getByText(/earnings/i).first()).toBeVisible();

    await page.goto(`${urls.staff}/doctor/profile`);
    await page.getByLabel('Consultation fees').fill('725');
    await page.getByLabel('About').fill('General physician with a focus on preventive care.');
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(/profile (updated|saved)/i).first()).toBeVisible();
    const listed = await publicGet(request, '/doctors?search=Aarav');
    expect(listed.items[0].fees).toBe(725);

    await page.goto(`${urls.staff}/doctor/leaves`);
    await page.getByLabel('Date').fill('2027-03-15');
    await page.getByLabel('Reason').fill('Conference');
    await page.getByRole('button', { name: /add leave|add|save/i }).click();
    const leave = page.getByRole('row').filter({ hasText: 'Conference' });
    await expect(leave).toBeVisible();
    await leave.getByRole('button', { name: /Delete leave/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: /remove|delete/i }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Conference' })).toHaveCount(0);

    await page.goto(`${urls.staff}/doctor/schedule`);
    await expect(page.getByRole('heading', { name: 'Weekly schedule' })).toBeVisible();
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(/schedule (updated|saved)/i).first()).toBeVisible();
  });
});

test.describe('admin console', () => {
  test.beforeEach(async ({ page }) => {
    await staffLogin(page, admin, '/admin', 'admin');
  });

  test('settings changes reach the public settings endpoint', async ({ page, request }) => {
    await page.goto(`${urls.staff}/admin/settings`);
    await page.getByLabel('Cancellation cutoff (hours)').fill('3');
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(/settings (updated|saved)/i).first()).toBeVisible();
    expect((await publicGet(request, '/settings/public')).cancellationCutoffHours).toBe(3);
  });

  test('creates and removes a speciality', async ({ page, request }) => {
    await page.goto(`${urls.staff}/admin/specialities`);
    await page.getByRole('button', { name: /add speciality/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('Orthopedics');
    await dialog.getByLabel('Description').fill('Bones, joints and muscles.');
    await dialog.getByRole('button', { name: /save|create|add/i }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Orthopedics' })).toBeVisible();
    expect((await publicGet(request, '/specialities')).map((s) => s.slug)).toContain('orthopedics');

    await page.getByRole('button', { name: 'Delete Orthopedics' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /delete/i }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Orthopedics' })).toHaveCount(0);
  });

  test('exports appointments as CSV and filters the audit log', async ({ page }) => {
    await page.goto(`${urls.staff}/admin/appointments`);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /export/i }).click();
    const file = await (await download).path();
    expect(readFileSync(file, 'utf8').split(/\r?\n/)[0]).toBe(
      'id,date,time,patient,patientEmail,doctor,speciality,status,paymentStatus,fee,currency,createdAt',
    );

    await page.goto(`${urls.staff}/admin/audit`);
    await page.getByLabel('Action').fill('doctor.create');
    await expect(page.getByRole('row').filter({ hasText: 'Doctor create' }).first()).toBeVisible();
  });

  test('lists and moderates reviews', async ({ page }) => {
    await page.goto(`${urls.staff}/admin/reviews`);
    const row = page.getByRole('row').filter({ hasText: 'Clear explanation and a quick consultation.' });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: /Delete review by/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: /delete/i }).click();
    await expect(row).toHaveCount(0);
  });
});
