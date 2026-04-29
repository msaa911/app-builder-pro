/**
 * SignInModal.test.tsx — LPL-010
 * Tests for SignInModal component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SignInModal from '../../common/SignInModal';

// ─── Test Helpers ────────────────────────────────────────────────────

function renderModal(isOpen = true, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <SignInModal isOpen={isOpen} onClose={onClose} />
    </MemoryRouter>
  );
}

// ─── SignInModal Tests ───────────────────────────────────────────────

describe('SignInModal (LPL-010)', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
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

    it('should display "Coming Soon" text', () => {
      renderModal(true, mockOnClose);
      expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
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
});
