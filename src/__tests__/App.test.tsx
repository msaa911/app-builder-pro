import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { RouterWrapper } from '../test-utils/RouterWrapper';
import App from '../App';

vi.mock('framer-motion', () => ({ motion: { div: 'div' } }));
vi.mock('../components/settings/SettingsModal', () => ({ default: () => null }));
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

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <RouterWrapper>
        <App />
      </RouterWrapper>
    );
    expect(container.querySelector('[data-testid="app-container"]')).not.toBeNull();
  });

  it('shows LandingPage by default', () => {
    render(
      <RouterWrapper initialEntries={['/']}>
        <App />
      </RouterWrapper>
    );
    expect(document.querySelector('[data-testid="landing-container"]')).not.toBeNull();
  });

  it('shows landing header', () => {
    render(
      <RouterWrapper initialEntries={['/']}>
        <App />
      </RouterWrapper>
    );
    expect(document.querySelector('[data-testid="landing-header"]')).not.toBeNull();
  });

  it('shows landing main content', () => {
    render(
      <RouterWrapper initialEntries={['/']}>
        <App />
      </RouterWrapper>
    );
    expect(document.querySelector('[data-testid="landing-main"]')).not.toBeNull();
  });

  it('contains prompt input', () => {
    render(
      <RouterWrapper initialEntries={['/']}>
        <App />
      </RouterWrapper>
    );
    expect(document.querySelector('[data-testid="prompt-input"]')).not.toBeNull();
  });

  it('contains build button', () => {
    render(
      <RouterWrapper initialEntries={['/']}>
        <App />
      </RouterWrapper>
    );
    expect(document.querySelector('[data-testid="btn-primary"]')).not.toBeNull();
  });

  it('contains feature grid', () => {
    render(
      <RouterWrapper initialEntries={['/']}>
        <App />
      </RouterWrapper>
    );
    expect(document.querySelector('[data-testid="feature-grid"]')).not.toBeNull();
  });
});
