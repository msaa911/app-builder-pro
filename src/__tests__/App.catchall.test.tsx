/**
 * App.catchall.test.tsx — LPL-006
 * Tests that unknown routes redirect to "/"
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RouterWrapper } from '../test-utils/RouterWrapper';

// Mocks required by App's dependency tree
vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
}));
vi.mock('../components/settings/SettingsModal', () => ({ default: () => null }));
vi.mock('../components/privacy/PrivacyPolicyModal', () => ({
  default: () => null,
  PrivacyPolicyModal: () => null,
}));
vi.mock('../hooks/useWebContainer', () => ({ useWebContainer: () => ({}) }));
vi.mock('../hooks/useAIBuilder', () => ({ useAIBuilder: () => ({}) }));
vi.mock('../contexts/SettingsContext', () => ({
  useSettings: () => ({ getEffectiveApiKey: () => '', modelId: '' }),
  SettingsProvider: ({ children }: any) => <>{children}</>,
}));
vi.mock('../hooks/useCookieConsent', () => ({
  useCookieConsent: () => ({ hasConsented: true, acceptAll: vi.fn(), rejectNonEssential: vi.fn() }),
}));
vi.mock('../components/common/Toast', () => ({
  ToastProvider: ({ children }: any) => <>{children}</>,
  useToast: () => ({ showToast: vi.fn() }),
}));

import App from '../App';

describe('App — catch-all redirect (LPL-006)', () => {
  it('redirects unknown route "/" to landing page (shows LandingPage)', async () => {
    render(
      <RouterWrapper initialEntries={['/nonexistent-page']}>
        <App />
      </RouterWrapper>
    );

    // After redirect, LandingPage should be rendered
    await waitFor(() => {
      const landingContainer = document.querySelector('[data-testid="landing-container"]');
      expect(landingContainer).not.toBeNull();
    });
  });

  it('redirects /random-nested/route to landing page', async () => {
    render(
      <RouterWrapper initialEntries={['/random-nested/route']}>
        <App />
      </RouterWrapper>
    );

    await waitFor(() => {
      const landingContainer = document.querySelector('[data-testid="landing-container"]');
      expect(landingContainer).not.toBeNull();
    });
  });
});
