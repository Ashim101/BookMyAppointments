import { expect, test } from '@playwright/test';
import { patientLogin, pickSlot } from '../helpers/ui.js';
import { demoPatient, urls } from '../scripts/stack.mjs';

const priya = { email: 'priya.newcomer@example.com', password: 'Sunrise2026' };

async function openDoctor(page, patient) {
  await patientLogin(page, patient);
  await page.goto(`${urls.patient}/doctors?search=Aarav`);
  await page.getByRole('link', { name: /Dr\. Aarav Sharma/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Book an appointment' })).toBeVisible();
}

test('two patients race for the same slot: the loser gets a clear message and fresh times', async ({ browser }) => {
  const first = await (await browser.newContext()).newPage();
  const second = await (await browser.newContext()).newPage();
  try {
    await openDoctor(first, demoPatient);
    await openDoctor(second, priya);

    // Both look at the same open slot before either has booked it.
    const slotA = await pickSlot(first, { day: 'last' });
    const slotB = await pickSlot(second, { day: 'last' });
    expect(slotB).toEqual(slotA);

    await second.getByRole('button', { name: 'Confirm booking' }).click();
    await expect(second).toHaveURL(/\/my-appointments/);

    await first.getByRole('button', { name: 'Confirm booking' }).click();
    await expect(first.getByRole('alert').filter({ hasText: /refreshed the available times/ })).toBeVisible();
    await expect(first).toHaveURL(/\/doctors\//);
    // The picker reloaded and the taken time is no longer offered.
    const times = first.getByRole('group', { name: /^Times on / });
    await expect(times.getByRole('button', { name: slotA.label, disabled: false })).toHaveCount(0);
    await expect(first.getByRole('button', { name: 'Confirm booking' })).toHaveCount(0);
  } finally {
    await first.context().close();
    await second.context().close();
  }
});
