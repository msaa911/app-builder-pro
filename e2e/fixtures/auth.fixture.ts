/**
 * Authenticated Playwright fixture for E2E testing.
 *
 * Mocks Supabase Auth at the network level using `page.route()` and seeds
 * localStorage with a mock session token before the app loads.
 *
 * ## Architecture
 * - `page.route()` intercepts all Supabase Auth HTTP calls (`/auth/v1/*`)
 * - `page.addInitScript()` injects a mock session into localStorage before React mounts
 * - `sessionStorage['__auth_mock_disabled']` flag controls whether addInitScript seeds the token
 * - The real Supabase JS SDK runs unmodified — zero app code changes
 *
 * ## Sign-out support
 * After sign-out, the fixture sets `sessionStorage['__auth_mock_disabled'] = '1'`.
 * On the next navigation, `addInitScript` reads this flag and skips seeding
 * localStorage. The SDK finds no token → getSession() returns null → auth guard
 * redirects to landing. No race conditions, no timing hacks.
 *
 * `sessionStorage` persists across same-origin navigations within the same tab
 * (unlike window properties which reset on cross-document navigation), making it
 * the right mechanism for this state.
 *
 * @module e2e/fixtures/auth.fixture
 */

import { test as base, expect, type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** sessionStorage key that disables the auth mock after sign-out */
const AUTH_MOCK_DISABLED_KEY = '__auth_mock_disabled';

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

/**
 * Read VITE_SUPABASE_URL from .env file.
 *
 * Playwright's Node.js process does NOT load .env automatically (Vite does
 * that for the dev server, but the test runner is a separate process).
 * We read the .env file directly to derive the correct localStorage key.
 */
function getSupabaseUrlFromEnv(): string {
  if (process.env.VITE_SUPABASE_URL) {
    return process.env.VITE_SUPABASE_URL;
  }

  try {
    const envPath = resolve(process.cwd(), '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    const match = envContent.match(/^VITE_SUPABASE_URL=(.+)$/m);
    return match ? match[1].trim() : '';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

/** Mock authenticated user returned by Supabase Auth */
export const mockUser = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  email: 'test@example.com',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {
    provider: 'email',
    providers: ['email'],
  },
  user_metadata: {
    full_name: 'Test User',
  },
  created_at: '2026-01-01T00:00:00.000Z',
};

/** Mock access token (JWT-like format — not a real JWT, just for testing) */
export const mockAccessToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhYWFhYWFhYS1iYmJiLWNjY2MtZGRkZC1lZWVlZWVlZWVlZWUiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImlhdCI6MTcwNDA2NDAwMCwiZXhwIjo5OTk5OTk5OTk5fQ.mock-signature';

/** Mock refresh token */
export const mockRefreshToken = 'mock-refresh-token-xxxxxxxx';

/** Mock Supabase session object (shape matches sb-xxx-auth-token localStorage value) */
export interface MockSessionToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
  user: typeof mockUser;
}

/** Create a mock session token for localStorage injection */
export function createMockSessionToken(): MockSessionToken {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: mockAccessToken,
    refresh_token: mockRefreshToken,
    expires_in: 3600,
    expires_at: expiresAt,
    token_type: 'bearer',
    user: mockUser,
  };
}

// ---------------------------------------------------------------------------
// Storage key derivation
// ---------------------------------------------------------------------------

/**
 * Derive the Supabase localStorage key from the project URL.
 *
 * Supabase JS SDK stores auth tokens under: `sb-{projectRef}-auth-token`
 * where `{projectRef}` is the first segment of the hostname.
 * E.g. `https://xyzproject.supabase.co` → `sb-xyzproject-auth-token`
 */
export function deriveStorageKey(supabaseUrl: string): string {
  if (!supabaseUrl) {
    return 'sb-placeholder-auth-token';
  }
  try {
    const url = new URL(supabaseUrl);
    const ref = url.hostname.split('.')[0];
    return `sb-${ref}-auth-token`;
  } catch {
    return 'sb-placeholder-auth-token';
  }
}

// ---------------------------------------------------------------------------
// Route interceptors
// ---------------------------------------------------------------------------

/**
 * Set up Supabase Auth route interceptors on a Playwright page.
 *
 * - GET /auth/v1/user → 200 with mock user (when enabled) / 401 (when disabled)
 * - POST /auth/v1/token* → 200 with mock session (when enabled) / 401 (when disabled)
 * - POST /auth/v1/logout → 200 OK + calls onLogout callback
 */
export async function setupAuthRouteInterceptors(
  page: Page,
  getEnabled: () => boolean,
  onLogout?: () => void
): Promise<void> {
  await page.route('*/auth/v1/user', async (route) => {
    if (!getEnabled()) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'not_authenticated', message: 'Mock disabled' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: mockUser.id,
        email: mockUser.email,
        aud: mockUser.aud,
        role: mockUser.role,
        app_metadata: mockUser.app_metadata,
        user_metadata: mockUser.user_metadata,
        created_at: mockUser.created_at,
      }),
    });
  });

  await page.route('*/auth/v1/token**', async (route) => {
    if (!getEnabled()) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', message: 'Mock disabled' }),
      });
      return;
    }
    const session = createMockSessionToken();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        expires_at: session.expires_at,
        token_type: session.token_type,
        user: session.user,
      }),
    });
  });

  await page.route('*/auth/v1/logout', async (route) => {
    onLogout?.();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
}

// ---------------------------------------------------------------------------
// Mock toggle
// ---------------------------------------------------------------------------

/** Disable the auth mock — clears token from localStorage and sets a sessionStorage flag */
export async function disableAuthMock(page: Page): Promise<void> {
  // Set sessionStorage flag so addInitScript skips seeding on next navigation
  await page.evaluate((flagKey) => {
    sessionStorage.setItem(flagKey, '1');
    // Also clear the Supabase auth token from localStorage immediately
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    }
  }, AUTH_MOCK_DISABLED_KEY);
}

/** Re-enable the auth mock — clears the sessionStorage flag and re-seeds the token */
export async function enableAuthMock(page: Page, storageKey: string): Promise<void> {
  await page.evaluate(
    ({ flagKey, tokenKey, token }) => {
      sessionStorage.removeItem(flagKey);
      localStorage.setItem(tokenKey, JSON.stringify(token));
    },
    {
      flagKey: AUTH_MOCK_DISABLED_KEY,
      tokenKey: storageKey,
      token: createMockSessionToken(),
    }
  );
}

// ---------------------------------------------------------------------------
// Authenticated page fixture
// ---------------------------------------------------------------------------

/**
 * Extended test fixture that provides an authenticated page.
 *
 * Seeds localStorage with a mock auth token via addInitScript.
 * The addInitScript checks sessionStorage for the disable flag before seeding,
 * so after sign-out the token is NOT re-seeded on navigation.
 *
 * Usage:
 * ```ts
 * import { authTest, expect } from './fixtures/auth.fixture';
 *
 * authTest('can access builder', async ({ authenticatedPage }) => {
 *   await authenticatedPage.goto('/builder');
 *   await expect(authenticatedPage).toHaveURL('/builder');
 * });
 * ```
 */
export const authTest = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    const supabaseUrl = getSupabaseUrlFromEnv();
    const storageKey = deriveStorageKey(supabaseUrl);

    // Route interceptors — logout callback disables the mock
    await setupAuthRouteInterceptors(
      page,
      () => true, // enabled via sessionStorage, not this flag
      () => {
        // Fire-and-forget: set sessionStorage flag from Node.js
        page
          .evaluate((flagKey) => {
            sessionStorage.setItem(flagKey, '1');
          }, AUTH_MOCK_DISABLED_KEY)
          .catch(() => {});
      }
    );

    // Seed localStorage with mock auth token before each navigation.
    // Checks sessionStorage disable flag — if set (after sign-out), skips seeding.
    await page.addInitScript(
      ({ token, storageKey: key, flagKey }) => {
        if (sessionStorage.getItem(flagKey) === '1') {
          return; // Mock disabled after sign-out — don't seed the token
        }
        localStorage.setItem(key, JSON.stringify(token));
      },
      {
        token: createMockSessionToken(),
        storageKey,
        flagKey: AUTH_MOCK_DISABLED_KEY,
      }
    );

    await use(page);
  },
});

// Re-export expect for convenience
export { expect };
