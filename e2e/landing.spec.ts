import { test, expect } from '@playwright/test';

/**
 * Landing page smoke tests.
 *
 * Verifies that the landing page renders correctly with its
 * key structural elements visible to the user.
 */
test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the landing container', async ({ page }) => {
    const container = page.getByTestId('landing-container');
    await expect(container).toBeVisible();
  });

  test('displays the App Builder Pro logo link', async ({ page }) => {
    const logoLink = page.getByTestId('logo-link');
    await expect(logoLink).toBeVisible();
    await expect(logoLink).toHaveAttribute('href', '/');
  });

  test('renders the landing navigation bar', async ({ page }) => {
    const nav = page.getByTestId('landing-nav');
    await expect(nav).toBeVisible();
    // Navigation should contain links to Showcase and Templates
    await expect(nav.getByRole('link', { name: /showcase/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /templates/i })).toBeVisible();
  });

  test('displays the hero section with prompt input', async ({ page }) => {
    const promptInput = page.getByTestId('prompt-input');
    await expect(promptInput).toBeVisible();
    const buildButton = page.getByTestId('btn-primary');
    await expect(buildButton).toBeVisible();
    await expect(buildButton).toBeDisabled();
  });

  test('shows the feature grid with three cards', async ({ page }) => {
    const featureGrid = page.getByTestId('feature-grid');
    await expect(featureGrid).toBeVisible();
    const featureCards = featureGrid.getByTestId('feature-card');
    await expect(featureCards).toHaveCount(3);
  });
});
