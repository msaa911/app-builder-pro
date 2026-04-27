/**
 * useVercelOAuth hook tests
 *
 * Tests PKCE OAuth flow and hook lifecycle.
 *
 * @module hooks/deploy/__tests__
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { generateCodeVerifier, generateCodeChallenge } from '../../../services/deploy/pkce';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.location for redirect tests
const mockAssign = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  mockAssign.mockReset();
  sessionStorage.clear();
  // We need to isolate modules for each test because useVercelOAuth uses module-level state
  vi.resetModules();
  Object.defineProperty(window, 'location', {
    value: { assign: mockAssign, href: '', origin: 'http://localhost:5173' },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PKCE helpers', () => {
  it('should return a random URL-safe base64 string of correct length', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toBeTruthy();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('should return different verifiers on each call', () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(v1).not.toBe(v2);
  });

  it('should generate deterministic challenge for same verifier', async () => {
    const c1 = await generateCodeChallenge('test-verifier-123');
    const c2 = await generateCodeChallenge('test-verifier-123');
    expect(c1).toBe(c2);
  });

  it('should produce challenge different from verifier', async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    expect(challenge).not.toBe(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('useVercelOAuth', () => {
  async function getHook() {
    const { useVercelOAuth } = await import('../useVercelOAuth');
    return renderHook(() => useVercelOAuth());
  }

  it('should return idle status initially', async () => {
    const { result } = await getHook();
    expect(result.current.status).toBe('idle');
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.getToken()).toBeNull();
  });

  it('should set error when client ID is not configured on login', async () => {
    // Without VITE_VERCEL_CLIENT_ID, login should set error state
    const { result } = await getHook();

    await act(async () => {
      result.current.login();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toContain('client ID');
  });

  it('should store PKCE verifier in sessionStorage during login', async () => {
    // Even before the redirect, the verifier is stored synchronously
    // We test this by checking sessionStorage right after login() is called
    vi.doMock('../../../config/vercel', () => ({
      vercelOAuthConfig: {
        clientId: 'test-client-id',
        redirectUri: 'http://localhost:5173/callback',
        scopes: 'openid',
        authorizeUrl: 'https://vercel.com/oauth/authorize',
        tokenUrl: 'https://vercel.com/oauth/token',
      },
      vercelApiConfig: {
        baseUrl: 'https://api.vercel.com',
        deploymentsEndpoint: '/v13/deployments',
        maxPollAttempts: 150,
        pollIntervalMs: 2000,
      },
    }));

    const { useVercelOAuth } = await import('../useVercelOAuth');
    const { result } = renderHook(() => useVercelOAuth());

    act(() => {
      result.current.login();
    });

    // Verifier should be stored in sessionStorage
    const verifier = sessionStorage.getItem('vercel_oauth_verifier');
    expect(verifier).toBeTruthy();
    expect(verifier!.length).toBeGreaterThanOrEqual(43);

    vi.doUnmock('../../../config/vercel');
  });

  it('should exchange authorization code for token and store in-memory', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'vercel-token-xyz', token_type: 'Bearer' }),
    });

    const { result } = await getHook();

    // Simulate verifier stored from login
    sessionStorage.setItem('vercel_oauth_verifier', 'test-verifier');

    let token: string | null = null;
    await act(async () => {
      token = await result.current.exchangeCode('auth-code-456');
    });

    expect(token).toBe('vercel-token-xyz');
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.status).toBe('authenticated');
    expect(result.current.getToken()).toBe('vercel-token-xyz');

    // Verifier cleared after exchange
    expect(sessionStorage.getItem('vercel_oauth_verifier')).toBeNull();
  });

  it('should clear token and reset state on logout', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'vercel-token-abc', token_type: 'Bearer' }),
    });

    const { result } = await getHook();

    sessionStorage.setItem('vercel_oauth_verifier', 'v');

    await act(async () => {
      await result.current.exchangeCode('code');
    });

    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.logout();
    });

    expect(result.current.getToken()).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.status).toBe('idle');
  });

  it('should set error when token exchange fails and clear verifier', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ error: 'invalid_grant' }),
    });

    const { result } = await getHook();

    sessionStorage.setItem('vercel_oauth_verifier', 'v');

    await act(async () => {
      await result.current.exchangeCode('bad-code');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBeTruthy();
    expect(result.current.isAuthenticated).toBe(false);
    // Verifier still cleared even on failure
    expect(sessionStorage.getItem('vercel_oauth_verifier')).toBeNull();
  });

  it('should set error when verifier is missing from sessionStorage', async () => {
    const { result } = await getHook();

    // No verifier stored — exchange should fail gracefully
    let token: string | null = 'not-null';
    await act(async () => {
      token = await result.current.exchangeCode('code-without-verifier');
    });

    expect(token).toBeNull();
    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toContain('verifier');
  });

  it('should set error when login throws synchronously', async () => {
    // Mock generateCodeVerifier to throw — this triggers the catch block at lines 91-95
    vi.doMock('../../../services/deploy/pkce', () => ({
      generateCodeVerifier: () => {
        throw new Error('Crypto not available');
      },
      generateCodeChallenge: vi.fn().mockResolvedValue('challenge'),
    }));

    const { useVercelOAuth: useOAuthFresh } = await import('../useVercelOAuth');
    const { result } = renderHook(() => useOAuthFresh());

    act(() => {
      result.current.login();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toContain('Crypto not available');
    // Verifier should be cleaned from sessionStorage
    expect(sessionStorage.getItem('vercel_oauth_verifier')).toBeNull();

    vi.doUnmock('../../../services/deploy/pkce');
  });

  it('should handle non-Error thrown value in login catch', async () => {
    // Mock generateCodeVerifier to throw a non-Error value
    vi.doMock('../../../services/deploy/pkce', () => ({
      generateCodeVerifier: () => {
        throw 'string error';
      },
      generateCodeChallenge: vi.fn().mockResolvedValue('challenge'),
    }));

    const { useVercelOAuth: useOAuthFresh } = await import('../useVercelOAuth');
    const { result } = renderHook(() => useOAuthFresh());

    act(() => {
      result.current.login();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toBe('OAuth login failed');

    vi.doUnmock('../../../services/deploy/pkce');
  });
});
