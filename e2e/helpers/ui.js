import { expect } from '@playwright/test';
import { urls } from '../scripts/stack.mjs';

export async function patientLogin(page, { email, password }) {
  await page.goto(`${urls.patient}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function patientLogout(page, name) {
  await page.getByRole('button', { name }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
}

export async function staffLogin(page, { email, password }, home) {
  await page.goto(`${urls.staff}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(new RegExp(`${home}`));
}

/**
 * Picks a bookable time in the slot picker. `day` is `first`, `second` or `last` among the days of the
 * visible week that still have openings. Today's slots can be inside the cancellation cutoff, so tests
 * that cancel or reschedule choose a later day.
 */
export async function pickSlot(scope, { day = 'first' } = {}) {
  const days = scope.getByRole('group', { name: 'Day' }).getByRole('button', { disabled: false });
  await expect(days.first()).toBeVisible();
  const count = await days.count();
  const index = { first: 0, second: Math.min(1, count - 1), last: count - 1 }[day];
  await days.nth(index).click();
  const times = scope.getByRole('group', { name: /^Times on / });
  await expect(times).toBeVisible();
  const slot = times.getByRole('button', { disabled: false }).first();
  const label = (await slot.textContent()).trim();
  const date = (await times.getAttribute('aria-label')).replace('Times on ', '');
  await slot.click();
  return { label, date };
}
