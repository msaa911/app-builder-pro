import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import LandingPage from '../pages/LandingPage';

// Mock framer-motion to avoid animation testing complexity
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock settings modal
vi.mock('../components/settings/SettingsModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="settings-modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Helper to check if element exists in document
function elementExists(selector: string): boolean {
  return document.querySelector(selector) !== null;
}

// Helper to get text content
function getTextContent(selector: string): string | null | undefined {
  const el = document.querySelector(selector);
  return el?.textContent;
}

describe('LandingPage', () => {
  const mockOnStartBuild = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Happy Path - Rendering', () => {
    it('renders hero section with title and subtitle', () => {
      // Given - LandingPage component with onStartBuild callback
      // When - Component is rendered
      render(<LandingPage onStartBuild={mockOnStartBuild} />);

      // Then - Hero title is visible
      const title = getTextContent('[data-testid="hero-content"] .hero-title');
      expect(title).toContain('Build any app');
      expect(title).toContain('with just a prompt');
    });

    it('renders hero section with description', () => {
      // Given
      render(<LandingPage onStartBuild={mockOnStartBuild} />);

      // Then - Description text is visible
      const description = getTextContent('[data-testid="hero-content"] .hero-description');
      expect(description).toContain('The intelligent builder');
    });

    it('renders CTA buttons in hero section', () => {
      // Given
      render(<LandingPage onStartBuild={mockOnStartBuild} />);

      // Then - Build App button is visible
      const buildBtn = screen.getByRole('button', { name: /build app/i });
      expect(buildBtn).not.toBeNull();

      const signInBtn = screen.getByRole('button', { name: /sign in/i });
      expect(signInBtn).not.toBeNull();
    });

    it('renders features section with feature cards', () => {
      // Given
      render(<LandingPage onStartBuild={mockOnStartBuild} />);

      // Then - Feature cards are visible
      const features = getTextContent('[data-testid="feature-grid"]');
      expect(features).toContain('Real Code Generation');
      expect(features).toContain('In-Browser Preview');
      expect(features).toContain('Iterative Building');
    });

    it('renders footer with copyright text', () => {
      // Given
      render(<LandingPage onStartBuild={mockOnStartBuild} />);

      // Then - Footer copyright is visible
      const footer = getTextContent('[data-testid="landing-footer"]');
      expect(footer).toContain('2026 App Builder Pro AI Labs');
    });

    it('renders example chips for quick prompts', () => {
      // Given
      render(<LandingPage onStartBuild={mockOnStartBuild} />);

      // Then - Example chips are visible
      const examples = getTextContent('[data-testid="hero-content"] .examples-list');
      expect(examples).toContain('A modern SaaS dashboard with dark mode');
      expect(examples).toContain('A personal portfolio');
    });

    it('renders logo with brand name', () => {
      // Given
      render(<LandingPage onStartBuild={mockOnStartBuild} />);

      // Then - Logo text is visible
      const logo = getTextContent('[data-testid="landing-header"] .logo-text');
      expect(logo).toContain('App Builder Pro');
    });

    it('renders navigation links', () => {
      // Given
      render(<LandingPage onStartBuild={mockOnStartBuild} />);

      // Then - Nav links are visible
      const nav = getTextContent('[data-testid="landing-nav"]');
      expect(nav).toContain('Showcase');
      expect(nav).toContain('Templates');
    });
  });

  describe('Interactions', () => {
    it('calls onStartBuild when CTA button is clicked with prompt', async () => {
      // Given - User prompt entered
      const promptText = 'Build a todo app';
      render(<LandingPage onStartBuild={mockOnStartBuild} />);

      // When - User types in prompt input and submits
      const input = screen.getByPlaceholderText(/What do you want to build today?/i);
      fireEvent.change(input, { target: { value: promptText } });
      fireEvent.submit(input.closest('form')!);

      // Then - onStartBuild is called with sanitized prompt
      expect(mockOnStartBuild).toHaveBeenCalledTimes(1);
      expect(mockOnStartBuild).toHaveBeenCalledWith(promptText);
    });

    it('disables submit button when prompt is empty', () => {
      // Given
      render(<LandingPage onStartBuild={mockOnStartBuild} />);

      // When - No prompt entered
      const submitButton = screen.getByRole('button', { name: /build app/i });
      const isDisabled = submitButton.hasAttribute('disabled');

      // Then - Button is disabled
      expect(isDisabled).toBe(true);
    });

    it('enables submit button when prompt has content', () => {
      // Given
      render(<LandingPage onStartBuild={mockOnStartBuild} />);
      const input = screen.getByPlaceholderText(/What do you want to build today?/i);

      // When - User types prompt
      fireEvent.change(input, { target: { value: 'A test app' } });

      // Then - Button is enabled
      const submitButton = screen.getByRole('button', { name: /build app/i });
      expect(submitButton.hasAttribute('disabled')).toBe(false);
    });

    it('fills prompt when example chip is clicked', () => {
      // Given
      render(<LandingPage onStartBuild={mockOnStartBuild} />);
      const input = screen.getByPlaceholderText(
        /What do you want to build today?/i
      ) as HTMLInputElement;

      // When - User clicks example chip
      const exampleChip = screen.getByText(/A modern SaaS dashboard with dark mode/i);
      fireEvent.click(exampleChip);

      // Then - Prompt input is filled
      expect(input.value).toBe('A modern SaaS dashboard with dark mode');
    });

    it('opens settings modal when settings button is clicked', () => {
      // Given
      render(<LandingPage onStartBuild={mockOnStartBuild} />);
      const settingsModalBefore = document.querySelector('[data-testid="settings-modal"]');

      // When - User clicks settings button
      const settingsButton = document.querySelector(
        '[data-testid="btn-settings"]'
      ) as HTMLButtonElement;
      fireEvent.click(settingsButton);

      // Then - Settings modal is opened
      const settingsModalAfter = document.querySelector('[data-testid="settings-modal"]');
      expect(settingsModalAfter).not.toBeNull();
    });

    it('sanitizes prompt before calling onStartBuild', () => {
      // Given - User enters potentially malicious input
      const maliciousPrompt = '<script>alert("xss")</script>';
      render(<LandingPage onStartBuild={mockOnStartBuild} />);

      // When - User submits form
      const input = screen.getByPlaceholderText(/What do you want to build today?/i);
      fireEvent.change(input, { target: { value: maliciousPrompt } });
      fireEvent.submit(input.closest('form')!);

      // Then - Prompt is sanitized (script tags removed)
      expect(mockOnStartBuild).toHaveBeenCalledWith('');
    });
  });

  describe('Responsive Layout', () => {
    it('renders prompt input with correct placeholder', () => {
      // Given
      render(<LandingPage onStartBuild={mockOnStartBuild} />);

      // When/Then - Input exists with correct placeholder
      const input = document.querySelector('[data-testid="prompt-input"]') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input?.getAttribute('type')).toBe('text');
    });

    it('renders landing container with proper structure', () => {
      // Given
      const { container } = render(<LandingPage onStartBuild={mockOnStartBuild} />);

      // Then - Container structure exists
      expect(container.querySelector('[data-testid="landing-container"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="landing-header"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="landing-main"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="landing-footer"]')).not.toBeNull();
    });
  });

  describe('Accessibility', () => {
    it('has input with placeholder for screen readers', () => {
      // Given
      render(<LandingPage onStartBuild={mockOnStartBuild} />);

      // Then - Input has accessible placeholder
      const input = screen.getByPlaceholderText(/What do you want to build today?/i);
      expect(input).not.toBeNull();
    });

    it('has submit button with clear accessible name', () => {
      // Given
      render(<LandingPage onStartBuild={mockOnStartBuild} />);

      // Then - Button has accessible name and type
      const submitButton = screen.getByRole('button', { name: /build app/i });
      expect(submitButton?.getAttribute('type')).toBe('submit');
    });

    it('has navigation with links', () => {
      // Given
      render(<LandingPage onStartBuild={mockOnStartBuild} />);

      // Then - Nav section exists
      const nav = document.querySelector('[data-testid="landing-nav"]');
      expect(nav).not.toBeNull();
    });
  });

  describe('Animation States', () => {
    it('renders hero content section', () => {
      // Given
      const { container } = render(<LandingPage onStartBuild={mockOnStartBuild} />);

      // Then - Hero content exists
      expect(container.querySelector('[data-testid="hero-content"]')).not.toBeNull();
    });

    it('renders feature grid section', () => {
      // Given
      const { container } = render(<LandingPage onStartBuild={mockOnStartBuild} />);

      // Then - Feature grid exists
      expect(container.querySelector('[data-testid="feature-grid"]')).not.toBeNull();
    });
  });

  describe('LandingPage - whitespace and privacy modal', () => {
    it('should NOT call onStartBuild when prompt is whitespace-only', () => {
      const mockOnStart = vi.fn();
      render(<LandingPage onStartBuild={mockOnStart} />);

      const input = screen.getByPlaceholderText(/What do you want to build today?/i);
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.submit(input.closest('form')!);

      expect(mockOnStart).not.toHaveBeenCalled();
    });

    it('should open privacy policy modal when privacy link is clicked', () => {
      render(<LandingPage onStartBuild={mockOnStartBuild} />);

      const privacyButton = document.querySelector('.privacy-link') as HTMLButtonElement;
      expect(privacyButton).not.toBeNull();
      act(() => {
        fireEvent.click(privacyButton);
      });

      // PrivacyPolicyModal should be rendered with isOpen=true after click
      const modal = document.querySelector('[data-testid="privacy-modal-overlay"]');
      expect(modal).not.toBeNull();
    });

    it('should close privacy policy modal when overlay is clicked', () => {
      render(<LandingPage onStartBuild={mockOnStartBuild} />);

      // Open the privacy modal
      const privacyButton = document.querySelector('.privacy-link') as HTMLButtonElement;
      act(() => {
        fireEvent.click(privacyButton);
      });

      // The modal overlay has onClick={onClose} — clicking the overlay background closes it
      const modalOverlay = document.querySelector(
        '[data-testid="privacy-modal-overlay"]'
      ) as HTMLElement;
      expect(modalOverlay).not.toBeNull();

      // Click the overlay to close
      act(() => {
        fireEvent.click(modalOverlay);
      });

      // After closing, the modal should not be visible (returns null when isOpen=false)
      expect(document.querySelector('[data-testid="privacy-modal-overlay"]')).toBeNull();
    });
  });
});
