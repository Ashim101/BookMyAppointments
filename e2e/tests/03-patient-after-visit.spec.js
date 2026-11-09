import { expect, test } from '@playwright/test';
import { patientLogin } from '../helpers/ui.js';
import { urls } from '../scripts/stack.mjs';

const patient = { name: 'Priya Newcomer', email: 'priya.newcomer@example.com', password: 'Sunrise2026' };

test.describe.serial('patient: after the consultation', () => {
  test('sees the notes and prescription, then leaves a review that appears on the doctor profile', async ({ page }) => {
    await patientLogin(page, patient);
    await page.goto(`${urls.patient}/my-appointments?tab=past`);
    const card = page.getByRole('article').filter({ hasText: 'Follow-up on my cough' });
    await expect(card).toContainText(/completed/i);

    await card.getByRole('link', { name: 'View notes and prescription' }).click();
    await expect(page.getByText('Mild bronchitis. Rest and fluids.')).toBeVisible();
    const medicine = page.getByRole('row').filter({ hasText: 'Amoxicillin' });
    await expect(medicine).toContainText('500 mg');
    await expect(medicine).toContainText('Twice a day');
    await expect(medicine).toContainText('After meals');

    await page.goto(`${urls.patient}/my-appointments?tab=past`);
    await page.getByRole('article').filter({ hasText: 'Follow-up on my cough' }).getByRole('button', { name: 'Leave a review' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('5 stars').check({ force: true });
    await dialog.getByLabel(/Comments/).fill('Clear explanation and a quick consultation.');
    await dialog.getByRole('button', { name: 'Submit review' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByRole('article').filter({ hasText: 'Follow-up on my cough' })).toContainText('Clear explanation');

    await page.getByRole('link', { name: 'Dr. Aarav Sharma' }).first().click();
    await expect(page.getByText('Clear explanation and a quick consultation.')).toBeVisible();
  });
});
