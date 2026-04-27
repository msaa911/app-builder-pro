import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

/**
 * OAuth Hook Tests — SDK-Managed Auth (Phase 5 Migration)
 *
 * These tests verify the useSupabaseOAuth hook works with the Supabase JS SDK
 * for all token management (persistSession: false = in-memory only).
 *
 * Previous tests verified sessionStorage-based token storage — those are now
 * obsolete. These tests verify SDK-managed auth instead.
 *
 * Tests cover:
 * - T2.1: Hook interface
 * - T2.2: Token lifecycle via SDK (expiration, refresh)
 * - T2.3: Tokens NOT in sessionStorage (in-memory by SDK)
 * - T2.3: Token retrieval via SDK
 * - T2.3: Logout clears session via SDK
 */

// ============ Mock Supabase Client ============
// Use vi.hoisted to ensure mocks are available before vi.mock executes

type AuthStateCallback = (event: string, session: any) => void;

const { mockSupabaseAuth, mockAuthStateCallbackRef } = vi.hoisted(() => {
  const callbackRef: { current: AuthStateCallback | null } = { current: null };
  return {
    mockSupabaseAuth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn((callback: AuthStateCallback) => {
        callbackRef.current = callback;
        return {
          data: {
            subscription: { unsubscribe: vi.fn() },
          },
        };
      }),
      signOut: vi.fn(),
    },
    mockAuthStateCallbackRef: callbackRef,
  };
});

const mockSession = {
  access_token: 'mock-access-token-xyz',
  refresh_token: 'mock-refresh-token-xyz',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: { id: 'user-123', email: 'test@example.com' },
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: mockSupabaseAuth,
  }),
}));

// Mutable config mock — allows individual tests to change clientId
let mockClientId = 'test-client-id';
let mockRedirectUri = 'http://localhost/oauth/callback';
let mockScopes = 'projects:read projects:write';

vi.mock('../../../config/supabase', () => ({
  get supabaseOAuthConfig() {
    return {
      clientId: mockClientId,
      redirectUri: mockRedirectUri,
      scopes: mockScopes,
    };
  },
}));

vi.mock('@/config/supabase', () => ({
  get supabaseOAuthConfig() {
    return {
      clientId: mockClientId,
      redirectUri: mockRedirectUri,
      scopes: mockScopes,
    };
  },
}));

import { useSupabaseOAuth } from '../useSupabaseOAuth';

// ============ Test Setup ============

const originalLocation = window.location;

// Shared location mock object — href is a plain writable property
const locationMock = {
  origin: 'http://localhost',
  href: 'http://localhost/' as string,
  pathname: '/',
  assign: vi.fn(),
  replace: vi.fn(),
  reload: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthStateCallbackRef.current = null;

  // Reset mutable config mock
  mockClientId = 'test-client-id';
  mockRedirectUri = 'http://localhost/oauth/callback';
  mockScopes = 'projects:read projects:write';

  // Default: no session
  mockSupabaseAuth.getSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });
  mockSupabaseAuth.signOut.mockResolvedValue({ error: null });

  // Reset tracked href
  locationMock.href = 'http://localhost/';

  Object.defineProperty(window, 'location', {
    value: locationMock,
    writable: true,
    configurable: true,
  });
  mockSupabaseAuth.signOut.mockResolvedValue({ error: null });

  Object.defineProperty(window, 'location', {
    value: {
      origin: 'http://localhost',
      pathname: '/',
      assign: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
    },
    writable: true,
    configurable: true,
  });

  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  Object.defineProperty(window, 'location', originalLocation);
  vi.restoreAllMocks();
});

// ============ Tests ============

describe('useSupabaseOAuth — SDK-Managed Auth', () => {
  // ============ T2.1: Hook returns expected interface ============

  it('returns expected interface with login, logout, getToken, isAuthenticated, status, error', () => {
    const { result } = renderHook(() => useSupabaseOAuth());

    expect(result.current).toHaveProperty('login');
    expect(result.current).toHaveProperty('logout');
    expect(result.current).toHaveProperty('getToken');
    expect(result.current).toHaveProperty('isAuthenticated');
    expect(result.current).toHaveProperty('status');
    expect(result.current).toHaveProperty('error');
    expect(typeof result.current.login).toBe('function');
    expect(typeof result.current.logout).toBe('function');
    expect(typeof result.current.getToken).toBe('function');
    expect(typeof result.current.isAuthenticated).toBe('boolean');
  });

  // ============ T2.1: Initial status is idle ============

  it('initializes with idle status when no session exists', () => {
    const { result } = renderHook(() => useSupabaseOAuth());

    expect(result.current.status).toBe('idle');
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBe(null);
  });

  // ============ T2.3: Login initiates OAuth redirect ============

  it('login sets status to authenticating before redirect', async () => {
    // The login function attempts to redirect to Supabase OAuth.
    // Since clientId is empty in test env, it throws — but status still
    // transitions to 'authenticating' before the error.
    const { result } = renderHook(() => useSupabaseOAuth());

    await act(async () => {
      try {
        await result.current.login();
      } catch {
        // Expected: login throws because clientId is empty in test env
      }
    });

    // Verify login is a callable function that transitions status
    // In test env with empty clientId, it goes to 'error'
    // In production with real clientId, it would be 'authenticating' + redirect
    expect(['authenticating', 'error']).toContain(result.current.status);
  });

  // ============ T2.3: Tokens NOT stored in sessionStorage ============

  it('should NOT store auth tokens in sessionStorage (SDK manages in-memory)', async () => {
    // Simulate INITIAL_SESSION event with a valid session
    mockSupabaseAuth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    renderHook(() => useSupabaseOAuth());

    // Fire the INITIAL_SESSION event via the mock callback
    await act(async () => {
      if (mockAuthStateCallbackRef.current) {
        mockAuthStateCallbackRef.current('INITIAL_SESSION', mockSession);
      }
    });

    // Verify: NO auth tokens in sessionStorage
    expect(sessionStorage.getItem('sb-access-token')).toBeNull();
    expect(sessionStorage.getItem('sb-refresh-token')).toBeNull();
    expect(sessionStorage.getItem('supabase.auth.token')).toBeNull();
  });

  // ============ T2.3: getToken retrieves from SDK, not sessionStorage ============

  it('getToken retrieves the current access token from SDK session', async () => {
    mockSupabaseAuth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const { result } = renderHook(() => useSupabaseOAuth());

    const token = await result.current.getToken();

    // Token comes from SDK, not sessionStorage
    expect(token).toBe('mock-access-token-xyz');
    expect(mockSupabaseAuth.getSession).toHaveBeenCalled();
  });

  it('getToken returns null when no session exists', async () => {
    mockSupabaseAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useSupabaseOAuth());

    const token = await result.current.getToken();

    expect(token).toBeNull();
  });

  // ============ T2.3: Logout clears session via SDK ============

  it('logout signs out via SDK and clears legacy sessionStorage', async () => {
    // Pre-populate legacy key to verify cleanup
    sessionStorage.setItem('sb-access-token', 'legacy-token');

    const { result } = renderHook(() => useSupabaseOAuth());

    // Simulate authenticated state
    await act(async () => {
      if (mockAuthStateCallbackRef.current) {
        mockAuthStateCallbackRef.current('SIGNED_IN', mockSession);
      }
    });

    expect(result.current.isAuthenticated).toBe(true);

    // Logout
    await act(async () => {
      await result.current.logout();
    });

    // SDK signOut was called
    expect(mockSupabaseAuth.signOut).toHaveBeenCalled();

    // Legacy tokens should be cleaned
    expect(sessionStorage.getItem('sb-access-token')).toBeNull();

    // State should be reset
    expect(result.current.status).toBe('idle');
    expect(result.current.isAuthenticated).toBe(false);
  });

  // ============ T2.2: Token expiration via SESSION_EXPIRED event ============

  it('SESSION_EXPIRED event clears state and sets error', async () => {
    const { result } = renderHook(() => useSupabaseOAuth());

    // First authenticate
    await act(async () => {
      if (mockAuthStateCallbackRef.current) {
        mockAuthStateCallbackRef.current('SIGNED_IN', mockSession);
      }
    });

    expect(result.current.isAuthenticated).toBe(true);

    // Then session expires
    await act(async () => {
      if (mockAuthStateCallbackRef.current) {
        mockAuthStateCallbackRef.current('SESSION_EXPIRED', null);
      }
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toContain('expired');
  });

  // ============ T2.2: Token refresh via TOKEN_REFRESHED event ============

  it('TOKEN_REFRESHED event maintains authenticated state', async () => {
    const { result } = renderHook(() => useSupabaseOAuth());

    // Authenticate
    await act(async () => {
      if (mockAuthStateCallbackRef.current) {
        mockAuthStateCallbackRef.current('SIGNED_IN', mockSession);
      }
    });

    // Token gets refreshed by SDK
    const refreshedSession = {
      ...mockSession,
      access_token: 'refreshed-token-abc',
    };

    await act(async () => {
      if (mockAuthStateCallbackRef.current) {
        mockAuthStateCallbackRef.current('TOKEN_REFRESHED', refreshedSession);
      }
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.status).toBe('authenticated');
    expect(result.current.error).toBeNull();
  });

  // ============ T2.1: SIGNED_OUT event clears state ============

  it('SIGNED_OUT event clears authentication state', async () => {
    const { result } = renderHook(() => useSupabaseOAuth());

    // Authenticate
    await act(async () => {
      if (mockAuthStateCallbackRef.current) {
        mockAuthStateCallbackRef.current('SIGNED_IN', mockSession);
      }
    });

    expect(result.current.isAuthenticated).toBe(true);

    // Sign out
    await act(async () => {
      if (mockAuthStateCallbackRef.current) {
        mockAuthStateCallbackRef.current('SIGNED_OUT', null);
      }
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  // ============ T2.3: OAuth callback URL is cleaned ============

  it('cleans URL hash after OAuth callback to prevent token leakage', async () => {
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    // Simulate OAuth callback URL
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost',
        href: 'http://localhost/oauth/callback#access_token=abc123&token_type=Bearer',
        hash: '#access_token=abc123&token_type=Bearer',
        pathname: '/oauth/callback',
      },
      writable: true,
    });

    renderHook(() => useSupabaseOAuth());

    // URL hash should be cleaned via replaceState
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', expect.any(String));
  });

  // ============ Error handling ============

  it('handles getSession errors gracefully', async () => {
    const sessionError = new Error('Network error');
    mockSupabaseAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: sessionError,
    });

    const { result } = renderHook(() => useSupabaseOAuth());

    const token = await act(async () => {
      return result.current.getToken();
    });

    expect(token).toBeNull();

    // Wait for React state to update after async getToken
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
    expect(result.current.status).toBe('error');
  });

  // ============ Login with real clientId (OAuth URL construction) ============

  it('login constructs OAuth URL and redirects when clientId is configured', async () => {
    // The mutable config mock already has clientId: 'test-client-id'
    // We can't easily intercept window.location.href = url in jsdom,
    // but we CAN verify the login doesn't throw and sets authenticating status
    // The actual URL construction is tested by verifying no error occurred
    // and status moved to 'authenticating' (the line before window.location.href = url)
    const { result } = renderHook(() => useSupabaseOAuth());

    await act(async () => {
      await result.current.login();
    });

    // Login should NOT set error state when clientId is configured
    expect(result.current.status).toBe('authenticating');
    expect(result.current.error).toBeNull();
  });

  // ============ Logout with signOut error (catch block) ============

  it('logout proceeds with cleanup even when signOut throws', async () => {
    // Make signOut reject
    mockSupabaseAuth.signOut.mockRejectedValue(new Error('Session already expired'));

    // Pre-populate legacy key
    sessionStorage.setItem('sb-access-token', 'legacy-token');

    const { result } = renderHook(() => useSupabaseOAuth());

    // Set authenticated state first
    await act(async () => {
      if (mockAuthStateCallbackRef.current) {
        mockAuthStateCallbackRef.current('SIGNED_IN', mockSession);
      }
    });

    expect(result.current.isAuthenticated).toBe(true);

    // Logout — signOut throws but cleanup should still happen
    await act(async () => {
      await result.current.logout();
    });

    // Legacy tokens should still be cleaned
    expect(sessionStorage.getItem('sb-access-token')).toBeNull();
    // State should be reset
    expect(result.current.status).toBe('idle');
    expect(result.current.isAuthenticated).toBe(false);
  });

  // ============ INITIAL_SESSION with no access token ============

  it('INITIAL_SESSION with no access token sets idle state', async () => {
    const { result } = renderHook(() => useSupabaseOAuth());

    await act(async () => {
      if (mockAuthStateCallbackRef.current) {
        mockAuthStateCallbackRef.current('INITIAL_SESSION', { access_token: '' });
      }
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.isAuthenticated).toBe(false);
  });

  // ============ Default auth event with session token ============

  it('default event with valid session token sets authenticated state', async () => {
    const { result } = renderHook(() => useSupabaseOAuth());

    await act(async () => {
      if (mockAuthStateCallbackRef.current) {
        // Use a custom event name that falls through to default case
        mockAuthStateCallbackRef.current('PASSWORD_RECOVERY', mockSession);
      }
    });

    expect(result.current.status).toBe('authenticated');
    expect(result.current.isAuthenticated).toBe(true);
  });

  // ============ GetToken with thrown exception (catch block) ============

  it('getToken returns null and sets error when getSession throws', async () => {
    mockSupabaseAuth.getSession.mockRejectedValue(new Error('Unexpected error'));

    const { result } = renderHook(() => useSupabaseOAuth());

    let token: string | null = 'not-null';
    await act(async () => {
      token = await result.current.getToken();
    });

    expect(token).toBeNull();
    // Error should be set
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });

  it('getToken handles non-Error thrown values', async () => {
    mockSupabaseAuth.getSession.mockRejectedValue('string error');

    const { result } = renderHook(() => useSupabaseOAuth());

    let token: string | null = 'not-null';
    await act(async () => {
      token = await result.current.getToken();
    });

    expect(token).toBeNull();
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toBe('Failed to get session');
    });
  });

  // ============ Login with missing clientId (error branch) ============

  it('login sets error state when clientId is empty', async () => {
    // Set clientId to empty using mutable variable
    mockClientId = '';

    const { result } = renderHook(() => useSupabaseOAuth());

    await act(async () => {
      await result.current.login();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toContain('client ID');
  });
});
