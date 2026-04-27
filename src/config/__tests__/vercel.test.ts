/**
 * Vercel Configuration Tests
 *
 * Tests env var fallback branches:
 * - Missing VITE_VERCEL_CLIENT_ID → warning log + empty string
 * - Missing VITE_VERCEL_REDIRECT_URI → warning log + default callback URI
 * - Present env vars → values used directly
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

describe('vercel config', () => {
  const originalEnv = { ...import.meta.env };
  const originalLocation = window.location;

  afterEach(() => {
    // Restore import.meta.env
    Object.assign(import.meta.env, originalEnv);
    // Restore window.location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    vi.resetModules();
  });

  it('should warn and return empty clientId when VITE_VERCEL_CLIENT_ID is missing', async () => {
    // Arrange: Remove the env var
    delete (import.meta.env as Record<string, unknown>).VITE_VERCEL_CLIENT_ID;
    // Keep redirect URI set to avoid double warning
    import.meta.env.VITE_VERCEL_REDIRECT_URI = 'http://localhost:5173/oauth/vercel/callback';

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Act: Dynamic import to re-evaluate the module with new env
    const { vercelOAuthConfig } = await import('../vercel');

    // Assert: Warning was logged for missing client ID
    expect(consoleWarnSpy).toHaveBeenCalled();
    const warnCalls = consoleWarnSpy.mock.calls.map((call) => call.join(' '));
    const hasClientIdWarning = warnCalls.some((msg) => msg.includes('VITE_VERCEL_CLIENT_ID'));
    expect(hasClientIdWarning).toBe(true);

    // Assert: clientId is empty string (fallback)
    expect(vercelOAuthConfig.clientId).toBe('');

    consoleWarnSpy.mockRestore();
  });

  it('should warn and return default redirect URI when VITE_VERCEL_REDIRECT_URI is missing', async () => {
    // Arrange: Set client ID but remove redirect URI
    import.meta.env.VITE_VERCEL_CLIENT_ID = 'test-vercel-client-id';
    delete (import.meta.env as Record<string, unknown>).VITE_VERCEL_REDIRECT_URI;

    // Mock window.location.origin for the fallback
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:5173' },
      writable: true,
      configurable: true,
    });

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Act: Dynamic import
    const { vercelOAuthConfig } = await import('../vercel');

    // Assert: Warning was logged for missing redirect URI
    expect(consoleWarnSpy).toHaveBeenCalled();
    const warnCalls = consoleWarnSpy.mock.calls.map((call) => call.join(' '));
    const hasRedirectUriWarning = warnCalls.some((msg) => msg.includes('VITE_VERCEL_REDIRECT_URI'));
    expect(hasRedirectUriWarning).toBe(true);

    // Assert: redirectUri falls back to window.location.origin + '/oauth/vercel/callback'
    expect(vercelOAuthConfig.redirectUri).toBe('http://localhost:5173/oauth/vercel/callback');

    consoleWarnSpy.mockRestore();
  });

  it('should use env vars directly when both are configured', async () => {
    // Arrange: Set both env vars
    import.meta.env.VITE_VERCEL_CLIENT_ID = 'my-vercel-client-id';
    import.meta.env.VITE_VERCEL_REDIRECT_URI = 'http://localhost:3000/vercel/callback';

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Act
    const { vercelOAuthConfig, vercelApiConfig, vercelConfig } = await import('../vercel');

    // Assert: No warnings when env vars are present
    const warnCalls = consoleWarnSpy.mock.calls.map((call) => call.join(' '));
    const hasVercelWarning = warnCalls.some(
      (msg) => msg.includes('VITE_VERCEL_CLIENT_ID') || msg.includes('VITE_VERCEL_REDIRECT_URI')
    );
    expect(hasVercelWarning).toBe(false);

    // Assert: Values come from env
    expect(vercelOAuthConfig.clientId).toBe('my-vercel-client-id');
    expect(vercelOAuthConfig.redirectUri).toBe('http://localhost:3000/vercel/callback');

    // Assert: Static config values
    expect(vercelApiConfig.baseUrl).toBe('https://api.vercel.com');
    expect(vercelApiConfig.deploymentsEndpoint).toBe('/v13/deployments');
    expect(vercelApiConfig.maxPollAttempts).toBe(150);
    expect(vercelApiConfig.pollIntervalMs).toBe(2000);

    // Assert: Combined config structure
    expect(vercelConfig.oauth).toBe(vercelOAuthConfig);
    expect(vercelConfig.api).toBe(vercelApiConfig);

    consoleWarnSpy.mockRestore();
  });

  it('should use default OAuth scopes', async () => {
    // Arrange
    import.meta.env.VITE_VERCEL_CLIENT_ID = 'test-id';
    import.meta.env.VITE_VERCEL_REDIRECT_URI = 'http://localhost/callback';

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Act
    const { vercelOAuthConfig } = await import('../vercel');

    // Assert: Default scopes for Vercel
    expect(vercelOAuthConfig.scopes).toBe('openid email profile offline_access');

    // Assert: OAuth endpoint URLs
    expect(vercelOAuthConfig.authorizeUrl).toBe('https://vercel.com/oauth/authorize');
    expect(vercelOAuthConfig.tokenUrl).toBe('https://vercel.com/oauth/token');

    consoleWarnSpy.mockRestore();
  });
});
