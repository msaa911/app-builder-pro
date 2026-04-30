import { test, expect } from '@playwright/test';

/**
 * Showcase page smoke tests.
 *
 * Verifies that the showcase page renders correctly.
 * In CI (no IDB data), the empty state is shown.
 */
test.describe('Showcase Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/showcase');
  });

  test('renders the showcase container', async ({ page }) => {
    const container = page.getByTestId('showcase-container');
    await expect(container).toBeVisible();
  });

  test('displays the App Builder Pro logo link', async ({ page }) => {
    const logoLink = page.getByTestId('logo-link');
    await expect(logoLink).toBeVisible();
    await expect(logoLink).toHaveAttribute('href', '/');
  });

  test('shows the page title', async ({ page }) => {
    const title = page.getByTestId('showcase-title');
    await expect(title).toBeVisible();
    await expect(title).toHaveText('My Projects');
  });

  test('displays empty state when no projects exist', async ({ page }) => {
    // In CI/fresh browser — no IDB data, so empty state is expected
    const emptyState = page.getByTestId('showcase-empty');
    await expect(emptyState).toBeVisible();

    const startLink = page.getByTestId('showcase-start-link');
    await expect(startLink).toBeVisible();
    await expect(startLink).toHaveAttribute('href', '/');
  });

  test('displays back link to landing', async ({ page }) => {
    const backLink = page.getByTestId('showcase-back-link');
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute('href', '/');
  });
});
