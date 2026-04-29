/**
 * AuthContext — Global authentication context using Supabase Auth (AUTH-001)
 *
 * Provides user, session, loading, login, signup, loginWithOAuth, logout, and error state
 * to the entire app via React Context.
 *
 * ## Architecture
 * - Uses shared `supabaseClient` from `src/lib/supabase.ts`
 * - Listens to `onAuthStateChange` for reactive session updates
 * - Cleans URL hash on OAuth callback (removes token from browser history)
 * - Clear error on each new auth operation
 *
 * @module contexts/AuthContext
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { User, Session, Subscription } from '@supabase/supabase-js';
import { supabaseClient } from '../lib/supabase';

export type AuthProviderType = 'google' | 'github';

export interface AuthContextType {
  /** Current authenticated user, or null */
  user: User | null;
  /** Current session, or null */
  session: Session | null;
  /** Whether auth state is still loading (initial check) */
  loading: boolean;
  /** Sign in with email and password */
  login: (email: string, password: string) => Promise<void>;
  /** Sign up with email, password, and optional display name */
  signup: (email: string, password: string, displayName?: string) => Promise<void>;
  /** Sign in with OAuth provider (Google or GitHub) */
  loginWithOAuth: (provider: AuthProviderType) => Promise<void>;
  /** Sign out the current user */
  logout: () => Promise<void>;
  /** Last auth error message, or null */
  error: string | null;
  /** Clear the current error */
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Keys to clear from sessionStorage on auth cleanup (legacy) */
const LEGACY_SESSION_KEYS = ['sb-access-token'];

function clearLegacySessionStorage(): void {
  for (const key of LEGACY_SESSION_KEYS) {
    sessionStorage.removeItem(key);
  }
}

/** Checks if the URL contains an OAuth callback hash fragment */
function hasOAuthCallbackInUrl(): boolean {
  const hash = window.location?.hash;
  if (!hash) return false;
  return hash.includes('access_token=');
}

/** Human-readable error messages for common Supabase Auth errors */
function getAuthErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'An unexpected error occurred';

  const message = error.message;

  // Map common Supabase error messages to user-friendly text
  if (message.includes('Invalid login credentials')) {
    return 'Invalid email or password. Please try again.';
  }
  if (message.includes('User already registered')) {
    return 'An account with this email already exists.';
  }
  if (message.includes('Email not confirmed')) {
    return 'Please check your email and confirm your account.';
  }
  if (message.includes('Password should be')) {
    return 'Password must be at least 6 characters.';
  }
  if (message.includes('Unable to validate email address')) {
    return 'Please enter a valid email address.';
  }
  if (message.includes('OAuth')) {
    return 'OAuth sign in failed. Please try again.';
  }

  return message;
}

/**
 * AuthProvider wraps the app and provides auth state via context.
 *
 * On mount:
 * 1. Gets initial session via getSession()
 * 2. Subscribes to onAuthStateChange for reactive updates
 * 3. Cleans OAuth callback URL hash if present
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const subscriptionRef = useRef<Subscription | null>(null);

  /** Sign in with email + password */
  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const { error: authError } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) throw authError;
    } catch (err) {
      setError(getAuthErrorMessage(err));
      throw err;
    }
  }, []);

  /** Sign up with email + password + optional display name */
  const signup = useCallback(async (email: string, password: string, displayName?: string) => {
    setError(null);
    try {
      const { error: authError } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: displayName ? { full_name: displayName } : undefined,
        },
      });
      if (authError) throw authError;
    } catch (err) {
      setError(getAuthErrorMessage(err));
      throw err;
    }
  }, []);

  /** Sign in with OAuth provider (Google or GitHub) */
  const loginWithOAuth = useCallback(async (provider: AuthProviderType) => {
    setError(null);
    try {
      const { error: authError } = await supabaseClient.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (authError) throw authError;
    } catch (err) {
      setError(getAuthErrorMessage(err));
      throw err;
    }
  }, []);

  /** Sign out the current user */
  const logout = useCallback(async () => {
    setError(null);
    try {
      await supabaseClient.auth.signOut();
    } catch {
      // signOut may fail if session already expired — proceed with cleanup
    }
    clearLegacySessionStorage();
    setUser(null);
    setSession(null);
  }, []);

  /** Clear the current error */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * On mount: get initial session and subscribe to auth state changes.
   * The onAuthStateChange listener handles INITIAL_SESSION, SIGNED_IN,
   * SIGNED_OUT, TOKEN_REFRESHED, etc.
   */
  useEffect(() => {
    // Get initial session
    supabaseClient.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setLoading(false);
    });

    // Subscribe to auth state changes
    const { data } = supabaseClient.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    subscriptionRef.current = data.subscription;

    return () => {
      subscriptionRef.current?.unsubscribe();
    };
  }, []);

  /**
   * Clean OAuth callback URL hash on mount.
   * The SDK's detectSessionInUrl processes the hash automatically,
   * but we clean the URL for security (removes token from browser history).
   */
  useEffect(() => {
    if (hasOAuthCallbackInUrl()) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        login,
        signup,
        loginWithOAuth,
        logout,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to access the AuthContext.
 * Must be used within an AuthProvider.
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
