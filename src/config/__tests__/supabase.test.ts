/**
 * Supabase Configuration Tests
 *
 * Tests env var fallback branches:
 * - Missing VITE_SUPABASE_OAUTH_CLIENT_ID → warning log + empty string
 * - Missing VITE_SUPABASE_REDIRECT_URI → warning log + default callback URI
 * - Present env vars → values used directly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('supabase config', () => {
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

  it('should warn and return empty clientId when VITE_SUPABASE_OAUTH_CLIENT_ID is missing', async () => {
    // Arrange: Remove the env var
    delete (import.meta.env as Record<string, unknown>).VITE_SUPABASE_OAUTH_CLIENT_ID;
    // Keep redirect URI set to avoid double warning
    import.meta.env.VITE_SUPABASE_REDIRECT_URI = 'http://localhost:5173/oauth/callback';
    import.meta.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    import.meta.env.VITE_SUPABASE_ANON_KEY = 'test-key';

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Act: Dynamic import to re-evaluate the module with new env
    const { supabaseOAuthConfig } = await import('../supabase');

    // Assert: Warning was logged for missing client ID
    expect(consoleWarnSpy).toHaveBeenCalled();
    const warnCalls = consoleWarnSpy.mock.calls.map((call) => call.join(' '));
    const hasClientIdWarning = warnCalls.some((msg) =>
      msg.includes('VITE_SUPABASE_OAUTH_CLIENT_ID')
    );
    expect(hasClientIdWarning).toBe(true);

    // Assert: clientId is empty string (fallback)
    expect(supabaseOAuthConfig.clientId).toBe('');

    consoleWarnSpy.mockRestore();
  });

  it('should warn and return default redirect URI when VITE_SUPABASE_REDIRECT_URI is missing', async () => {
    // Arrange: Set client ID but remove redirect URI
    import.meta.env.VITE_SUPABASE_OAUTH_CLIENT_ID = 'test-client-id';
    delete (import.meta.env as Record<string, unknown>).VITE_SUPABASE_REDIRECT_URI;
    import.meta.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    import.meta.env.VITE_SUPABASE_ANON_KEY = 'test-key';

    // Mock window.location.origin for the fallback
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:5173' },
      writable: true,
      configurable: true,
    });

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Act: Dynamic import
    const { supabaseOAuthConfig } = await import('../supabase');

    // Assert: Warning was logged for missing redirect URI
    expect(consoleWarnSpy).toHaveBeenCalled();
    const warnCalls = consoleWarnSpy.mock.calls.map((call) => call.join(' '));
    const hasRedirectUriWarning = warnCalls.some((msg) =>
      msg.includes('VITE_SUPABASE_REDIRECT_URI')
    );
    expect(hasRedirectUriWarning).toBe(true);

    // Assert: redirectUri falls back to window.location.origin + '/oauth/callback'
    expect(supabaseOAuthConfig.redirectUri).toBe('http://localhost:5173/oauth/callback');

    consoleWarnSpy.mockRestore();
  });

  it('should use env vars directly when both are configured', async () => {
    // Arrange: Set both env vars
    import.meta.env.VITE_SUPABASE_OAUTH_CLIENT_ID = 'my-client-id';
    import.meta.env.VITE_SUPABASE_REDIRECT_URI = 'http://localhost:3000/callback';
    import.meta.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    import.meta.env.VITE_SUPABASE_ANON_KEY = 'test-key';

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Act
    const { supabaseOAuthConfig, supabaseConfig } = await import('../supabase');

    // Assert: No warnings when env vars are present
    const warnCalls = consoleWarnSpy.mock.calls.map((call) => call.join(' '));
    const hasSupabaseWarning = warnCalls.some(
      (msg) =>
        msg.includes('VITE_SUPABASE_OAUTH_CLIENT_ID') || msg.includes('VITE_SUPABASE_REDIRECT_URI')
    );
    expect(hasSupabaseWarning).toBe(false);

    // Assert: Values come from env
    expect(supabaseOAuthConfig.clientId).toBe('my-client-id');
    expect(supabaseOAuthConfig.redirectUri).toBe('http://localhost:3000/callback');
    expect(supabaseConfig.apiUrl).toBe('https://test.supabase.co');
    expect(supabaseConfig.anonKey).toBe('test-key');

    consoleWarnSpy.mockRestore();
  });

  it('should use default scopes', async () => {
    // Arrange
    import.meta.env.VITE_SUPABASE_OAUTH_CLIENT_ID = 'test-id';
    import.meta.env.VITE_SUPABASE_REDIRECT_URI = 'http://localhost/callback';
    import.meta.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    import.meta.env.VITE_SUPABASE_ANON_KEY = 'test-key';

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Act
    const { supabaseOAuthConfig } = await import('../supabase');

    // Assert: Default scopes
    expect(supabaseOAuthConfig.scopes).toBe('projects:read projects:write');

    consoleWarnSpy.mockRestore();
  });
});
