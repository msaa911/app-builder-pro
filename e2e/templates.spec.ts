import { test, expect } from '@playwright/test';

/**
 * Templates page smoke tests.
 *
 * Verifies that the templates page renders with category sections
 * and template cards.
 */
test.describe('Templates Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/templates');
  });

  test('renders the templates container', async ({ page }) => {
    const container = page.getByTestId('templates-container');
    await expect(container).toBeVisible();
  });

  test('displays the App Builder Pro logo link', async ({ page }) => {
    const logoLink = page.getByTestId('logo-link');
    await expect(logoLink).toBeVisible();
    await expect(logoLink).toHaveAttribute('href', '/');
  });

  test('shows the page title', async ({ page }) => {
    const title = page.getByTestId('templates-title');
    await expect(title).toBeVisible();
    await expect(title).toHaveText('Templates');
  });

  test('renders at least one template category', async ({ page }) => {
    const categoryHeaders = page.getByTestId('template-category-header');
    await expect(categoryHeaders.first()).toBeVisible();
  });

  test('renders template cards with Use Template links', async ({ page }) => {
    const templateCards = page.getByTestId('template-card');
    await expect(templateCards.first()).toBeVisible();

    const useLinks = page.getByTestId('template-use-link');
    await expect(useLinks.first()).toBeVisible();
  });

  test('displays back link to landing', async ({ page }) => {
    const backLink = page.getByTestId('templates-back-link');
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute('href', '/');
  });
});
