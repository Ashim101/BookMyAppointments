import { expect, test } from '@playwright/test';
import { moveBookedAppointmentToPast } from '../helpers/db.js';
import { writeState } from '../helpers/state.js';
import { patientLogin, pickSlot, staffLogin } from '../helpers/ui.js';
import { doctorPassword, urls } from '../scripts/stack.mjs';

const patient = { name: 'Priya Newcomer', email: 'priya.newcomer@example.com', password: 'Sunrise2026' };
const doctor = { email: 'aarav.sharma@clinic.example.com', password: doctorPassword };

test.describe.serial('doctor: consultation with a prescription', () => {
  test('a patient books a visit that is then due', async ({ page }) => {
    await patientLogin(page, patient);
    await page.goto(`${urls.patient}/doctors`);
    await page.getByLabel('Search by name').fill('Aarav');
    await page.getByLabel('Search by name').press('Enter');
    await page.getByRole('link', { name: /Dr\. Aarav Sharma/ }).first().click();
    await pickSlot(page, { day: 'last' });
    await page.getByLabel(/Reason for visit/).fill('Follow-up on my cough');
    await page.getByRole('button', { name: 'Confirm booking' }).click();
    await expect(page).toHaveURL(/\/my-appointments/);

    writeState({ due: await moveBookedAppointmentToPast(patient.email) });
  });

  test('the doctor sees it on the calendar and in the list, then completes it', async ({ page }) => {
    await staffLogin(page, doctor, '/doctor', 'doctor');
    await page.goto(`${urls.staff}/doctor/calendar`);
    await expect(page.getByText(patient.name).first()).toBeVisible();

    await page.goto(`${urls.staff}/doctor/appointments`);
    const row = page.getByRole('row').filter({ hasText: 'Follow-up on my cough' });
    await expect(row).toContainText(/booked/i);
    await row.getByRole('button', { name: 'Complete' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Consultation notes').fill('Mild bronchitis. Rest and fluids.');
    await dialog.getByRole('button', { name: 'Add medicine' }).click();
    await dialog.getByRole('textbox', { name: 'Medicine', exact: true }).fill('Amoxicillin');
    await dialog.getByLabel('Dosage').fill('500 mg');
    await dialog.getByLabel('Frequency').fill('Twice a day');
    await dialog.getByLabel('Duration (days)').fill('5');
    await dialog.getByLabel('Instructions').fill('After meals');
    await dialog.getByRole('button', { name: 'Complete appointment' }).click();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByRole('row').filter({ hasText: 'Follow-up on my cough' })).toContainText(/completed/i);
  });
});
