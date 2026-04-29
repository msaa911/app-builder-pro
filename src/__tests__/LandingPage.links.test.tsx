/**
 * LandingPage.links.test.tsx — LPL-005
 * Tests that LandingPage nav links use React Router Link components
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('LandingPage — React Router Links (LPL-005)', () => {
  it('renders Showcase as a React Router Link to /showcase', () => {
    render(
      <RouterWrapper>
        <LandingPage />
      </RouterWrapper>
    );

    const showcaseLink = screen.getByRole('link', { name: /showcase/i });
    expect(showcaseLink).toBeInTheDocument();
    expect(showcaseLink).toHaveAttribute('href', '/showcase');
  });

  it('renders Templates as a React Router Link to /templates', () => {
    render(
      <RouterWrapper>
        <LandingPage />
      </RouterWrapper>
    );

    const templatesLink = screen.getByRole('link', { name: /templates/i });
    expect(templatesLink).toBeInTheDocument();
    expect(templatesLink).toHaveAttribute('href', '/templates');
  });

  it('nav links are NOT anchor tags with href="#"', () => {
    render(
      <RouterWrapper>
        <LandingPage />
      </RouterWrapper>
    );

    const nav = document.querySelector('[data-testid="landing-nav"]');
    expect(nav).not.toBeNull();
    // No link in nav should have href="#"
    const hashLinks = nav?.querySelectorAll('a[href="#"]');
    expect(hashLinks?.length).toBe(0);
  });
});
