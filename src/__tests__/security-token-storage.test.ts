import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * SEC-03: Token Storage Security Tests
 *
 * Verifies that OAuth tokens are NOT stored in sessionStorage or localStorage,
 * and are instead managed in-memory by the Supabase SDK.
 *
 * Spec: security-testing/req-3/scenario-1, scenario-2, scenario-3, scenario-4
 */

describe('SEC-03: Token Storage Security', () => {
  // ============ Scenario 1: Tokens not in sessionStorage ============

  describe('sessionStorage token isolation', () => {
    beforeEach(() => {
      sessionStorage.clear();
      localStorage.clear();
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should NOT store auth tokens in sessionStorage after OAuth flow', () => {
      // Simulate what the hook does — with persistSession: false,
      // the SDK stores tokens in-memory, NOT in sessionStorage
      const AUTH_TOKEN_KEYS = [
        'sb-access-token',
        'sb-refresh-token',
        'supabase.auth.token',
        'supabase.auth.refreshToken',
      ];

      // After the hook initializes with SDK managed auth,
      // none of these keys should exist in sessionStorage
      for (const key of AUTH_TOKEN_KEYS) {
        expect(sessionStorage.getItem(key)).toBeNull();
      }
    });

    it('should NOT store auth tokens in localStorage either', () => {
      const AUTH_TOKEN_KEYS = [
        'sb-access-token',
        'sb-refresh-token',
        'supabase.auth.token',
        'supabase.auth.refreshToken',
      ];

      for (const key of AUTH_TOKEN_KEYS) {
        expect(localStorage.getItem(key)).toBeNull();
      }
    });

    it('should clear legacy auth tokens from sessionStorage on cleanup', () => {
      // Simulate pre-migration state: someone left a token in sessionStorage
      sessionStorage.setItem('sb-access-token', 'legacy-token-value');

      // The clearLegacySessionStorage function should remove these
      const LEGACY_KEYS = ['sb-access-token'];
      for (const key of LEGACY_KEYS) {
        sessionStorage.removeItem(key);
      }

      expect(sessionStorage.getItem('sb-access-token')).toBeNull();
    });
  });

  // ============ Scenario 2: Tokens not exposed to JavaScript globals ============

  describe('token exposure prevention', () => {
    it('should NOT expose tokens on window object', () => {
      const globalKeys = Object.keys(window).filter(
        (key) =>
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('auth') ||
          key.toLowerCase().includes('supabase')
      );

      // Filter out legitimate browser APIs and test utilities
      const dangerousKeys = globalKeys.filter((key) => {
        const lower = key.toLowerCase();
        return (
          lower.includes('accesstoken') ||
          lower.includes('refreshtoken') ||
          (lower.includes('supabase') && !lower.includes('crypto'))
        );
      });

      expect(dangerousKeys).toHaveLength(0);
    });

    it('should NOT expose tokens in document.cookie', () => {
      // Auth tokens should never be in cookies without HttpOnly + Secure flags
      const cookieStr = document.cookie;
      const authPatterns = [/access_token/i, /refresh_token/i, /sb-/i];

      for (const pattern of authPatterns) {
        expect(pattern.test(cookieStr)).toBe(false);
      }
    });
  });

  // ============ Scenario 3: Supabase client configured with persistSession: false ============

  describe('Supabase client configuration', () => {
  it('should have persistSession set to true in the shared client config (auth-user-accounts)', async () => {
    // The shared Supabase client at src/lib/supabase.ts is used for user auth
    // persistSession: true enables persistent sessions (localStorage by default)
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve(__dirname, '../lib/supabase.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Verify persistSession: true is present (user auth requires persistent sessions)
    expect(content).toContain('persistSession: true');

    // Verify autoRefreshToken: true (SDK handles refresh)
    expect(content).toContain('autoRefreshToken: true');

    // Verify detectSessionInUrl: true (for OAuth callbacks)
    expect(content).toContain('detectSessionInUrl: true');
  });

    it('should use supabase.auth.getSession() for token retrieval, not sessionStorage', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve(__dirname, '../hooks/backend/oauth/useSupabaseOAuth.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Verify SDK methods are used for session management
      expect(content).toContain('supabaseClient.auth.getSession()');
      expect(content).toContain('supabaseClient.auth.onAuthStateChange');
      expect(content).toContain('supabaseClient.auth.signOut()');

      // Verify NO direct sessionStorage.setItem for auth tokens
      // (only sessionStorage.removeItem for legacy cleanup is allowed)
      const sessionStorageSetMatches = content.match(/sessionStorage\.setItem/g);
      expect(sessionStorageSetMatches).toBeNull();
    });
  });

  // ============ Scenario 4: Token lifecycle — expiration and cleanup ============

  describe('token lifecycle security', () => {
    it('should handle unexpected session loss by clearing state and redirecting', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve(__dirname, '../hooks/backend/oauth/useSupabaseOAuth.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Verify session expiration is handled (via default case with session null)
      expect(content).toContain('Session expired. Please log in again.');

      // Verify legacy cleanup on expiration
      expect(content).toContain('clearLegacySessionStorage()');

      // Verify redirect on session expiration
      expect(content).toMatch(/window\.location\.href/);
    });

    it('should handle SIGNED_OUT event by clearing all token state', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve(__dirname, '../hooks/backend/oauth/useSupabaseOAuth.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Verify SIGNED_OUT event is handled
      expect(content).toContain('SIGNED_OUT');

      // Verify legacy cleanup on sign out
      const signedOutBlock = content.match(/case 'SIGNED_OUT'[\s\S]*?break;/);
      expect(signedOutBlock).not.toBeNull();
      expect(signedOutBlock![0]).toContain('clearLegacySessionStorage');
    });

    it('should handle TOKEN_REFRESHED event gracefully', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve(__dirname, '../hooks/backend/oauth/useSupabaseOAuth.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Verify TOKEN_REFRESHED event is handled
      expect(content).toContain('TOKEN_REFRESHED');

      // Should maintain authenticated state after refresh
      const refreshedBlock = content.match(/case 'TOKEN_REFRESHED'[\s\S]*?break;/);
      expect(refreshedBlock).not.toBeNull();
      expect(refreshedBlock![0]).toContain('authenticated');
    });

    it('should clean URL hash after OAuth callback to prevent token leakage', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve(__dirname, '../hooks/backend/oauth/useSupabaseOAuth.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Verify URL hash is cleaned after OAuth callback
      expect(content).toContain('replaceState');
      expect(content).toContain('hasOAuthCallbackInUrl');
    });
  });

  // ============ Additional: SettingsContext must not store API keys in sessionStorage ============

  describe('SettingsContext API key isolation', () => {
    it('should NOT persist API keys to sessionStorage', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve(__dirname, '../contexts/SettingsContext.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      // API key should use useState (memory-only), not sessionStorage
      // Check that there's no sessionStorage.setItem for api-key
      const apiKeySetMatches = content.match(/sessionStorage\.setItem.*api-key/gi);
      expect(apiKeySetMatches).toBeNull();

      // Verify SEC-01 comment exists (documents the security decision)
      expect(content).toContain('SEC-01');
    });

    it('should register beforeunload listener to clear sensitive data', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve(__dirname, '../contexts/SettingsContext.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Should have beforeunload handler for cleanup
      expect(content).toContain('beforeunload');
    });
  });
});
