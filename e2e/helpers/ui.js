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
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
}

export async function staffLogin(page, { email, password }, home) {
  await page.goto(`${urls.staff}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(new RegExp(`${home}`));
}

/** Picks the first bookable time in the slot picker (the picker already selects the first day with openings). */
export async function pickFirstFreeSlot(scope) {
  const times = scope.getByRole('group', { name: /^Times on / });
  await expect(times).toBeVisible();
  const slot = times.getByRole('button').and(scope.locator(':enabled')).first();
  const label = (await slot.textContent()).trim();
  const date = (await times.getAttribute('aria-label')).replace('Times on ', '');
  await slot.click();
  return { label, date };
}
