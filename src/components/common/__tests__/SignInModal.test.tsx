/**
 * SignInModal.test.tsx — AUTH-004, AUTH-005, AUTH-006
 * Tests for SignInModal component (real auth form)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SignInModal from '../../common/SignInModal';

// ─── Mock AuthContext ────────────────────────────────────────────────
const mockLogin = vi.fn();
const mockSignup = vi.fn();
const mockLoginWithOAuth = vi.fn();
const mockClearError = vi.fn();

let mockAuthError: string | null = null;
let mockAuthLoading = false;

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    session: null,
    loading: mockAuthLoading,
    login: mockLogin,
    signup: mockSignup,
    loginWithOAuth: mockLoginWithOAuth,
    logout: vi.fn(),
    error: mockAuthError,
    clearError: mockClearError,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// ─── Test Helpers ────────────────────────────────────────────────────

function renderModal(isOpen = true, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <SignInModal isOpen={isOpen} onClose={onClose} />
    </MemoryRouter>
  );
}

// ─── SignInModal Tests ───────────────────────────────────────────────

describe('SignInModal (AUTH-004, AUTH-005, AUTH-006)', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthError = null;
    mockAuthLoading = false;
  });

  // ── Rendering ──────────────────────────────────────────────────────

  describe('rendering', () => {
    it('should render when isOpen is true', () => {
      renderModal(true, mockOnClose);
      expect(screen.getByRole('dialog', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should NOT render when isOpen is false', () => {
      renderModal(false, mockOnClose);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render email and password inputs', () => {
      renderModal(true, mockOnClose);
      expect(screen.getByTestId('input-email')).toBeInTheDocument();
      expect(screen.getByTestId('input-password')).toBeInTheDocument();
    });

    it('should render OAuth buttons (Google and GitHub)', () => {
      renderModal(true, mockOnClose);
      expect(screen.getByTestId('btn-oauth-google')).toBeInTheDocument();
      expect(screen.getByTestId('btn-oauth-github')).toBeInTheDocument();
    });

    it('should have role="dialog" and aria-label="Sign In"', () => {
      renderModal(true, mockOnClose);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-label', 'Sign In');
    });
  });

  // ── Close Behavior ─────────────────────────────────────────────────

  describe('close behavior', () => {
    it('should call onClose when close button is clicked', () => {
      renderModal(true, mockOnClose);
      const closeBtn = screen.getByTestId('signin-modal-close');
      fireEvent.click(closeBtn);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when overlay is clicked', () => {
      renderModal(true, mockOnClose);
      const overlay = screen.getByTestId('signin-modal-overlay');
      fireEvent.click(overlay);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Escape key is pressed', () => {
      renderModal(true, mockOnClose);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Login/Signup Toggle ────────────────────────────────────────────

  describe('login/signup toggle', () => {
    it('should show "Sign In" title by default (login mode)', () => {
      renderModal(true, mockOnClose);
      expect(screen.getByTestId('signin-modal-title')).toHaveTextContent('Sign In');
    });

    it('should switch to signup mode when toggle is clicked', () => {
      renderModal(true, mockOnClose);
      const toggleBtn = screen.getByTestId('btn-toggle-signup');
      fireEvent.click(toggleBtn);
      expect(screen.getByTestId('signin-modal-title')).toHaveTextContent('Create Account');
    });
  });
});
