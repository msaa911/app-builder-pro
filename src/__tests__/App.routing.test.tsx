/**
 * App.routing.test.tsx — LPL-004, LPL-006
 * Tests for react-router-dom migration in App.tsx
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouterWrapper } from '../test-utils/RouterWrapper';

// Mocks required by App's dependency tree
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));
vi.mock('../hooks/useProjectPersistence', () => ({
  useProjectPersistence: () => ({
    projectList: [],
    activeProjectId: null,
    activeProjectName: null,
    isRestoring: false,
    refreshProjectList: vi.fn(),
    openProject: vi.fn(),
    deleteProject: vi.fn(),
    renameProject: vi.fn(),
    createProject: vi.fn(),
    saveCurrentProject: vi.fn(),
    flushSave: vi.fn(),
  }),
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

// Lazy-import App AFTER mocks are set up
import App from '../App';

describe('App — routing (LPL-004)', () => {
  it('renders LandingPage at route "/"', () => {
    render(
      <RouterWrapper initialEntries={['/']}>
        <App />
      </RouterWrapper>
    );

    // LandingPage renders the hero-content with "Build any app"
    const heroContent = document.querySelector('[data-testid="landing-container"]');
    expect(heroContent).not.toBeNull();
    expect(heroContent?.textContent).toContain('Build any app');
  });

  it('renders BuilderPage at route "/builder"', () => {
    render(
      <RouterWrapper initialEntries={['/builder']}>
        <App />
      </RouterWrapper>
    );

    // BuilderPage renders the builder-container
    const builderContainer = document.querySelector('.builder-container');
    expect(builderContainer).not.toBeNull();
  });

  it('renders ShowcasePage at route "/showcase"', () => {
    render(
      <RouterWrapper initialEntries={['/showcase']}>
        <App />
      </RouterWrapper>
    );

    // ShowcasePage renders "My Projects" heading
    expect(screen.getByRole('heading', { name: /my projects/i })).toBeInTheDocument();
  });

  it('renders TemplatesPage at route "/templates"', () => {
    render(
      <RouterWrapper initialEntries={['/templates']}>
        <App />
      </RouterWrapper>
    );

    // TemplatesPage placeholder renders "Templates" heading
    expect(screen.getByRole('heading', { name: /templates/i })).toBeInTheDocument();
  });
});
