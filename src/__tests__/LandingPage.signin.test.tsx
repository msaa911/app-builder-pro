/**
 * LandingPage.signin.test.tsx — LPL-011
 * Tests for LandingPage SignInModal integration
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RouterWrapper } from '../test-utils/RouterWrapper';

// Mocks required by LandingPage dependency tree
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));
vi.mock('../components/settings/SettingsModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="settings-modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));
vi.mock('../components/privacy/PrivacyPolicyModal', () => ({
  default: () => null,
  PrivacyPolicyModal: () => null,
}));

import LandingPage from '../pages/LandingPage';

describe('LandingPage SignInModal integration (LPL-011)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should NOT show SignInModal initially', () => {
    render(
      <RouterWrapper>
        <LandingPage />
      </RouterWrapper>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should show SignInModal when Sign In button is clicked', () => {
    render(
      <RouterWrapper>
        <LandingPage />
      </RouterWrapper>
    );

    const signInBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(signInBtn);

    expect(screen.getByRole('dialog', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should close SignInModal when close button is clicked', () => {
    render(
      <RouterWrapper>
        <LandingPage />
      </RouterWrapper>
    );

    // Open modal
    const signInBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(signInBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByTestId('signin-modal-close');
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
