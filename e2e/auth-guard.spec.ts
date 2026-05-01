import { test, expect } from '@playwright/test';
import { authTest } from './fixtures/auth.fixture';

/**
 * Auth guard smoke tests.
 *
 * Verifies that unauthenticated users are redirected away
 * from protected routes (e.g. /builder), and that
 * authenticated users can access them.
 *
 * Two describe blocks provide a clear contrast:
 * - "Unauthenticated" — default Playwright context (no session)
 * - "Authenticated" — uses authTest fixture with mocked Supabase session
 */

// ---------------------------------------------------------------------------
// Unauthenticated scenarios (default Playwright context)
// ---------------------------------------------------------------------------
test.describe('Auth Guard — Unauthenticated', () => {
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

// ---------------------------------------------------------------------------
// Authenticated scenarios (using authTest fixture)
// ---------------------------------------------------------------------------
authTest.describe('Auth Guard — Authenticated', () => {
  authTest('allows authenticated user to access /builder', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/builder');

    // Should NOT be redirected — stays on /builder
    await expect(authenticatedPage).toHaveURL(/\/builder/);

    // Builder container should be visible
    const builderContainer = authenticatedPage.locator('.builder-container');
    await expect(builderContainer).toBeVisible();
  });

  authTest(
    'allows authenticated user to access /builder/:projectId',
    async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/builder/project-456');

      // Should NOT be redirected — stays on /builder/project-456
      await expect(authenticatedPage).toHaveURL(/\/builder\/project-456/);

      // Builder container visible
      const builderContainer = authenticatedPage.locator('.builder-container');
      await expect(builderContainer).toBeVisible();
    }
  );
});
