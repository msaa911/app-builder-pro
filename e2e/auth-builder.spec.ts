import { authTest, expect, disableAuthMock } from './fixtures/auth.fixture';

/**
 * Authenticated Builder E2E Tests (EPA-002, EPA-003, EPA-004)
 *
 * Verifies authenticated user flows:
 * - Access /builder without redirect
 * - Session persists on reload
 * - Sign-out redirects to landing
 * - After sign-out, builder is inaccessible
 */
authTest.describe('Authenticated Builder Access', () => {
  authTest(
    'authenticated user can access /builder without redirect',
    async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/builder');

      await expect(authenticatedPage).toHaveURL(/\/builder/);

      const builderContainer = authenticatedPage.locator('.builder-container');
      await expect(builderContainer).toBeVisible();
    }
  );

  authTest('authenticated user can access /builder/:projectId', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/builder/test-project-123');

    await expect(authenticatedPage).toHaveURL(/\/builder\/test-project-123/);

    const builderContainer = authenticatedPage.locator('.builder-container');
    await expect(builderContainer).toBeVisible();
  });

  authTest('session persists on page reload', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/builder');
    await expect(authenticatedPage).toHaveURL(/\/builder/);

    await authenticatedPage.reload();

    await expect(authenticatedPage).toHaveURL(/\/builder/);
    const builderContainer = authenticatedPage.locator('.builder-container');
    await expect(builderContainer).toBeVisible();
  });
});

authTest.describe('Sign-Out Flow', () => {
  authTest(
    'sign-out button is visible after clicking user avatar',
    async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/builder');

      // Logout is inside a dropdown — open it first
      const userAvatar = authenticatedPage.getByTestId('user-avatar-name');
      await expect(userAvatar).toBeVisible();
      await userAvatar.click();

      const logoutButton = authenticatedPage.getByTestId('btn-logout');
      await expect(logoutButton).toBeVisible();
    }
  );

  authTest('clicking sign-out redirects to landing page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/builder');
    await expect(authenticatedPage).toHaveURL(/\/builder/);

    const userAvatar = authenticatedPage.getByTestId('user-avatar-name');
    await userAvatar.click();

    const logoutButton = authenticatedPage.getByTestId('btn-logout');
    await logoutButton.click();

    await expect(authenticatedPage).toHaveURL('/');
  });

  authTest('after sign-out, /builder redirects to landing', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/builder');
    await expect(authenticatedPage).toHaveURL(/\/builder/);

    // Sign out
    const userAvatar = authenticatedPage.getByTestId('user-avatar-name');
    await userAvatar.click();

    const logoutButton = authenticatedPage.getByTestId('btn-logout');
    await logoutButton.click();
    await expect(authenticatedPage).toHaveURL('/');

    // Disable mock — sessionStorage flag tells addInitScript to skip seeding
    await disableAuthMock(authenticatedPage);

    // Navigate to /builder — no token seeded → getSession() returns null → redirect
    await authenticatedPage.goto('/builder');
    await expect(authenticatedPage).toHaveURL('/');
  });
});
