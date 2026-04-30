import { test, expect } from '@playwright/test';

/**
 * Auth guard smoke tests.
 *
 * Verifies that unauthenticated users are redirected away
 * from protected routes (e.g. /builder).
 *
 * Playwright fresh browser context = always unauthenticated.
 * No Supabase mocking needed — the default state has no user.
 */
test.describe('Auth Guard', () => {
  test('redirects unauthenticated user from /builder to /', async ({ page }) => {
    await page.goto('/builder');

    // Should be redirected to landing page
    await expect(page).toHaveURL('/');

    // Landing container should be visible (confirms we're on landing)
    const landingContainer = page.getByTestId('landing-container');
    await expect(landingContainer).toBeVisible();
  });

  test('redirects unauthenticated user from /builder/123 to /', async ({ page }) => {
    await page.goto('/builder/123');

    // Should be redirected to landing page
    await expect(page).toHaveURL('/');

    const landingContainer = page.getByTestId('landing-container');
    await expect(landingContainer).toBeVisible();
  });

  test('does not redirect on public routes', async ({ page }) => {
    // Public routes should NOT redirect
    await page.goto('/showcase');
    await expect(page).toHaveURL('/showcase');

    await page.goto('/templates');
    await expect(page).toHaveURL('/templates');
  });
});
