import { expect, test } from '@playwright/test';
import { waitForOtp } from '../helpers/mail.js';
import { writeState } from '../helpers/state.js';
import { patientLogin, patientLogout, pickSlot } from '../helpers/ui.js';
import { urls } from '../scripts/stack.mjs';

const patient = { name: 'Priya Newcomer', email: 'priya.newcomer@example.com', password: 'Sunrise2026' };
const DOCTOR = 'Dr. Aarav Sharma';

test.describe.serial('patient: from registration to cancellation', () => {
  test('registers with an emailed OTP and is signed in', async ({ page }) => {
    await page.goto(`${urls.patient}/register`);
    await page.getByLabel('Full name').fill(patient.name);
    await page.getByLabel('Email').fill(patient.email);
    await page.getByLabel('Password').fill(patient.password);
    await page.getByRole('button', { name: 'Send verification code' }).click();

    const otp = await waitForOtp(patient.email);
    await page.getByLabel('Digit 1 of 6').fill(otp);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).not.toHaveURL(/\/register/);
    await expect(page.getByRole('button', { name: patient.name })).toBeVisible();
    await patientLogout(page, patient.name);
  });

  test('rejects a wrong OTP without creating the account', async ({ page }) => {
    const email = 'wrong.otp@example.com';
    await page.goto(`${urls.patient}/register`);
    await page.getByLabel('Full name').fill('Wrong Otp');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(patient.password);
    await page.getByRole('button', { name: 'Send verification code' }).click();
    await waitForOtp(email);
    await page.getByLabel('Digit 1 of 6').fill('000000');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.locator('#otp-error')).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test('logs in, searches, opens a doctor, books a slot and pays with the mock gateway', async ({ page }) => {
    await patientLogin(page, patient);
    await page.goto(`${urls.patient}/doctors`);
    await page.getByLabel('Search by name').fill('Aarav');
    await page.getByLabel('Search by name').press('Enter');
    await expect(page).toHaveURL(/search=Aarav/);
    await page.getByRole('link', { name: new RegExp(DOCTOR) }).first().click();
    await expect(page.getByRole('heading', { name: DOCTOR })).toBeVisible();

    const slot = await pickSlot(page, { day: 'second' });
    await page.getByLabel(/Reason for visit/).fill('Persistent cough');
    await page.getByRole('button', { name: 'Confirm booking' }).click();

    await expect(page).toHaveURL(/\/my-appointments/);
    const card = page.getByRole('article').filter({ hasText: DOCTOR }).first();
    await expect(card).toBeVisible();
    await expect(card).toContainText(/booked/i);
    writeState({ firstSlot: slot });

    await card.getByRole('button', { name: 'Pay now' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /\(test\)/ }).click();
    await expect(page.getByRole('article').filter({ hasText: DOCTOR }).first()).toContainText(/paid/i);
  });

  test('reschedules to another slot and then cancels with a reason', async ({ page }) => {
    await patientLogin(page, patient);
    await page.goto(`${urls.patient}/my-appointments`);
    const card = page.getByRole('article').filter({ hasText: DOCTOR }).first();
    await card.getByRole('button', { name: 'Reschedule' }).click();
    const dialog = page.getByRole('dialog');
    const slot = await pickSlot(dialog, { day: 'last' });
    await dialog.getByRole('button', { name: /^Move to/ }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(card).toContainText(slot.label);

    await card.getByRole('button', { name: 'Cancel', exact: true }).click();
    const cancel = page.getByRole('dialog');
    await expect(cancel).toContainText(/cancel or reschedule up to \d+ hours/);
    await cancel.getByLabel('Reason for cancelling').fill('Travelling that week');
    await cancel.getByRole('button', { name: 'Cancel appointment' }).last().click();
    await page.getByRole('tab', { name: 'Cancelled' }).click();
    await expect(page.getByRole('article').filter({ hasText: DOCTOR }).first()).toContainText(/cancelled/i);
  });
});
