/**
 * SignInModal — Real authentication modal (AUTH-004, AUTH-005, AUTH-006)
 *
 * Replaces the "Coming Soon" placeholder with a functional auth form:
 * - Email/password login + signup toggle (AUTH-004, AUTH-006)
 * - Google and GitHub OAuth buttons (AUTH-005)
 * - Error display (AUTH-012)
 * - Loading state during auth operations (AUTH-013)
 *
 * Dismissible via close button, overlay click, and Escape key.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, type AuthProviderType } from '../../contexts/AuthContext';
import './SignInModal.css';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = 'login' | 'signup';

const SignInModal: React.FC<SignInModalProps> = ({ isOpen, onClose }) => {
  const { login, signup, loginWithOAuth, error, clearError, loading } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  // Close modal when user authenticates successfully
  useEffect(() => {
    if (isOpen && !loading && !error && isSubmitting) {
      // Auth succeeded — close modal
      setIsSubmitting(false);
      onClose();
    }
  }, [isOpen, loading, error, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await signup(email, password, displayName || undefined);
      }
    } catch {
      // Error is already set in AuthContext
      setIsSubmitting(false);
    }
  };

  const handleOAuthClick = async (provider: AuthProviderType) => {
    clearError();
    setIsSubmitting(true);

    try {
      await loginWithOAuth(provider);
      // OAuth redirects — no need to close modal here
    } catch {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
    clearError();
  };

  const isFormDisabled = isSubmitting || loading;

  return (
    <div
      className="signin-modal-overlay"
      data-testid="signin-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="signin-modal glass"
        role="dialog"
        aria-label="Sign In"
        data-testid="signin-modal"
      >
        <button
          className="signin-modal-close"
          data-testid="signin-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        <h2 className="signin-modal-title" data-testid="signin-modal-title">
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </h2>

        {/* OAuth buttons (AUTH-005) */}
        <div className="signin-oauth-buttons">
          <button
            className="signin-oauth-btn signin-oauth-google"
            data-testid="btn-oauth-google"
            onClick={() => handleOAuthClick('google')}
            disabled={isFormDisabled}
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <button
            className="signin-oauth-btn signin-oauth-github"
            data-testid="btn-oauth-github"
            onClick={() => handleOAuthClick('github')}
            disabled={isFormDisabled}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <span>Continue with GitHub</span>
          </button>
        </div>

        {/* Divider */}
        <div className="signin-divider">
          <span>or</span>
        </div>

        {/* Email/password form (AUTH-004) */}
        <form
          className="signin-email-form"
          data-testid="signin-email-form"
          onSubmit={handleEmailSubmit}
        >
          {mode === 'signup' && (
            <input
              type="text"
              className="signin-input"
              data-testid="input-display-name"
              placeholder="Display name (optional)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isFormDisabled}
              autoComplete="name"
            />
          )}

          <input
            type="email"
            className="signin-input"
            data-testid="input-email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isFormDisabled}
            autoComplete="email"
          />

          <input
            type="password"
            className="signin-input"
            data-testid="input-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={isFormDisabled}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

          {/* Error display (AUTH-012) */}
          {error && (
            <div className="signin-error" data-testid="signin-error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="signin-submit-btn"
            data-testid="btn-submit"
            disabled={isFormDisabled || !email || !password}
          >
            {isSubmitting ? (
              <span className="signin-spinner" data-testid="signin-spinner" />
            ) : null}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Login/signup toggle (AUTH-006) */}
        <p className="signin-toggle" data-testid="signin-toggle">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button
                className="signin-toggle-btn"
                data-testid="btn-toggle-signup"
                onClick={toggleMode}
                type="button"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                className="signin-toggle-btn"
                data-testid="btn-toggle-login"
                onClick={toggleMode}
                type="button"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default SignInModal;
