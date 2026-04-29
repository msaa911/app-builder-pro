/**
 * LandingPage.navigate.test.tsx — LPL-007
 * Tests that "Get Started" / prompt submission navigates to /builder
 * with the prompt in location.state
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RouterWrapper } from '../test-utils/RouterWrapper';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

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

/** Helper component that reads location.state and renders it */
function LocationStateDisplay() {
  const location = useLocation();
  return (
    <div data-testid="location-state">
      <span data-testid="location-pathname">{location.pathname}</span>
      <span data-testid="location-prompt">{(location.state as any)?.prompt ?? 'NO_PROMPT'}</span>
    </div>
  );
}

describe('LandingPage — navigation to /builder (LPL-007)', () => {
  it('navigates to /builder with prompt in location.state when form is submitted', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/builder" element={<LocationStateDisplay />} />
        </Routes>
      </MemoryRouter>
    );

    // Type a prompt
    const input = screen.getByPlaceholderText(/What do you want to build today?/i);
    fireEvent.change(input, { target: { value: 'A cool todo app' } });

    // Submit the form
    const form = input.closest('form')!;
    fireEvent.submit(form);

    // After navigation, we should be at /builder with the prompt
    const pathnameEl = document.querySelector('[data-testid="location-pathname"]');
    const promptEl = document.querySelector('[data-testid="location-prompt"]');

    expect(pathnameEl?.textContent).toBe('/builder');
    expect(promptEl?.textContent).toBe('A cool todo app');
  });

  it('navigates to /builder with sanitized prompt in location.state', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/builder" element={<LocationStateDisplay />} />
        </Routes>
      </MemoryRouter>
    );

    // Type a prompt with script tags (should be sanitized)
    const input = screen.getByPlaceholderText(/What do you want to build today?/i);
    fireEvent.change(input, { target: { value: '<script>alert("xss")</script>' } });

    // Submit the form
    const form = input.closest('form')!;
    fireEvent.submit(form);

    // After navigation, the prompt should be sanitized
    const promptEl = document.querySelector('[data-testid="location-prompt"]');
    expect(promptEl?.textContent).toBe(''); // sanitizeInput strips script tags
  });

  it('does NOT navigate when prompt is whitespace-only', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/builder" element={<LocationStateDisplay />} />
        </Routes>
      </MemoryRouter>
    );

    // Type whitespace-only prompt
    const input = screen.getByPlaceholderText(/What do you want to build today?/i);
    fireEvent.change(input, { target: { value: ' ' } });

    // Submit the form
    const form = input.closest('form')!;
    fireEvent.submit(form);

    // Should NOT have navigated — still on landing page
    const pathnameEl = document.querySelector('[data-testid="location-pathname"]');
    // Should NOT exist because we're still on LandingPage (no LocationStateDisplay rendered)
    expect(pathnameEl).toBeNull();
  });
});
