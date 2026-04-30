import { test, expect } from '@playwright/test';

/**
 * Navigation cycle smoke tests.
 *
 * Verifies that navigation between pages works correctly
 * using the shared navigation elements (logo link, nav links, back links).
 */
test.describe('Navigation Cycle', () => {
  test('logo link navigates to landing from any page', async ({ page }) => {
    // Start on showcase
    await page.goto('/showcase');
    await expect(page.getByTestId('showcase-container')).toBeVisible();

    // Click logo → landing
    await page.getByTestId('logo-link').click();
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('landing-container')).toBeVisible();
  });

  test('navigates from landing to showcase via nav link', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing-container')).toBeVisible();

    // Click Showcase nav link
    await page
      .getByTestId('landing-nav')
      .getByRole('link', { name: /showcase/i })
      .click();
    await expect(page).toHaveURL('/showcase');
    await expect(page.getByTestId('showcase-container')).toBeVisible();
  });

  test('navigates from landing to templates via nav link', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing-container')).toBeVisible();

    // Click Templates nav link
    await page
      .getByTestId('landing-nav')
      .getByRole('link', { name: /templates/i })
      .click();
    await expect(page).toHaveURL('/templates');
    await expect(page.getByTestId('templates-container')).toBeVisible();
  });

  test('navigates back from showcase to landing via back link', async ({ page }) => {
    await page.goto('/showcase');
    await expect(page.getByTestId('showcase-container')).toBeVisible();

    // Click Back link → landing
    await page.getByTestId('showcase-back-link').click();
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('landing-container')).toBeVisible();
  });

  test('navigates back from templates to landing via back link', async ({ page }) => {
    await page.goto('/templates');
    await expect(page.getByTestId('templates-container')).toBeVisible();

    // Click Back link → landing
    await page.getByTestId('templates-back-link').click();
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('landing-container')).toBeVisible();
  });

  test('full navigation cycle: landing → showcase → landing → templates → landing', async ({
    page,
  }) => {
    await page.goto('/');

    // Landing → Showcase
    await page
      .getByTestId('landing-nav')
      .getByRole('link', { name: /showcase/i })
      .click();
    await expect(page).toHaveURL('/showcase');

    // Showcase → Landing (via back link)
    await page.getByTestId('showcase-back-link').click();
    await expect(page).toHaveURL('/');

    // Landing → Templates
    await page
      .getByTestId('landing-nav')
      .getByRole('link', { name: /templates/i })
      .click();
    await expect(page).toHaveURL('/templates');

    // Templates → Landing (via back link)
    await page.getByTestId('templates-back-link').click();
    await expect(page).toHaveURL('/');

    // Back on landing
    await expect(page.getByTestId('landing-container')).toBeVisible();
  });
});
