/**
 * TopBar Tests - Create Backend Button
 * Phase 5 - TopBar Integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import TopBar from '../TopBar';
import { RouterWrapper } from '../../../test-utils/RouterWrapper';
import type { BuilderState } from '../../../types';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Sparkles: () => <span data-testid="icon-sparkles">Sparkles</span>,
  Share2: () => <span data-testid="icon-share">Share</span>,
  Check: () => <span data-testid="icon-check">Check</span>,
  Play: () => <span data-testid="icon-play">Play</span>,
  Settings: () => <span data-testid="icon-settings">Settings</span>,
  ChevronDown: () => <span data-testid="icon-chevron">Chevron</span>,
  Rocket: () => <span data-testid="icon-rocket">Rocket</span>,
  Database: () => <span data-testid="icon-database">Database</span>,
  Loader2: () => <span data-testid="icon-loader">Loader</span>,
  Cloud: () => <span data-testid="icon-cloud">Cloud</span>,
}));

// Mock QuotaStatus component
vi.mock('../QuotaStatus', () => ({
  QuotaStatus: () => <div data-testid="quota-status">Quota</div>,
}));

describe('TopBar', () => {
  const defaultProps = {
    projectName: 'Test Project',
    state: 'idle' as BuilderState,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Backend Button - Disabled States', () => {
    it('should be disabled when no code has been generated (hasGeneratedCode=false)', () => {
      render(
        <RouterWrapper>
          <TopBar {...defaultProps} hasGeneratedCode={false} hasOAuthToken={true} />
        </RouterWrapper>
      );

      const button = document.querySelector(
        '[data-testid="btn-create-backend"]'
      ) as HTMLButtonElement;
      expect(button).not.toBeNull();
      expect(button.disabled).toBe(true);
      expect(button.getAttribute('title')).toBe('Generate code first');
    });

    it('should be disabled when no OAuth token (hasOAuthToken=false)', () => {
      render(
        <RouterWrapper>
          <TopBar {...defaultProps} hasGeneratedCode={true} hasOAuthToken={false} />
        </RouterWrapper>
      );

      const button = document.querySelector(
        '[data-testid="btn-create-backend"]'
      ) as HTMLButtonElement;
      expect(button).not.toBeNull();
      expect(button.disabled).toBe(true);
      expect(button.getAttribute('title')).toBe('Login with Supabase');
    });

    it('should prioritize "no code" message over "no OAuth" when both conditions are true', () => {
      render(
        <RouterWrapper>
          <TopBar {...defaultProps} hasGeneratedCode={false} hasOAuthToken={false} />
        </RouterWrapper>
      );

      const button = document.querySelector(
        '[data-testid="btn-create-backend"]'
      ) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      // "Generate code first" takes precedence over "Login with Supabase"
      expect(button.getAttribute('title')).toBe('Generate code first');
    });
  });

  describe('Create Backend Button - Enabled State', () => {
    it('should be enabled when code exists AND OAuth token exists', () => {
      render(
        <RouterWrapper>
          <TopBar {...defaultProps} hasGeneratedCode={true} hasOAuthToken={true} />
        </RouterWrapper>
      );

      const button = document.querySelector(
        '[data-testid="btn-create-backend"]'
      ) as HTMLButtonElement;
      expect(button).not.toBeNull();
      expect(button.disabled).toBe(false);
      expect(button.getAttribute('title')).toBe('Create Supabase backend');
    });
  });

  describe('Create Backend Button - Loading State', () => {
    it('should show spinner and "Creating..." text when isCreatingBackend=true', () => {
      render(
        <RouterWrapper>
          <TopBar
            {...defaultProps}
            hasGeneratedCode={true}
            hasOAuthToken={true}
            isCreatingBackend={true}
          />
        </RouterWrapper>
      );

      const button = document.querySelector(
        '[data-testid="btn-create-backend"]'
      ) as HTMLButtonElement;
      expect(button).not.toBeNull();

      // Check for loading class
      expect(button.className).toContain('loading');

      // Check for spinner icon (Loader2)
      const spinner = button.querySelector('[data-testid="icon-loader"]');
      expect(spinner).not.toBeNull();

      // Check for "Creating..." text
      expect(button.textContent).toContain('Creating...');
    });

    it('should be disabled while creating backend', () => {
      render(
        <RouterWrapper>
          <TopBar
            {...defaultProps}
            hasGeneratedCode={true}
            hasOAuthToken={true}
            isCreatingBackend={true}
          />
        </RouterWrapper>
      );

      const button = document.querySelector(
        '[data-testid="btn-create-backend"]'
      ) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it('should show correct tooltip while creating', () => {
      render(
        <RouterWrapper>
          <TopBar
            {...defaultProps}
            hasGeneratedCode={true}
            hasOAuthToken={true}
            isCreatingBackend={true}
          />
        </RouterWrapper>
      );

      const button = document.querySelector(
        '[data-testid="btn-create-backend"]'
      ) as HTMLButtonElement;
      expect(button.getAttribute('title')).toBe('Creating backend...');
    });
  });

  describe('Create Backend Button - Click Handler', () => {
    it('should call onCreateBackend callback when button is clicked', () => {
      const onCreateBackend = vi.fn();
      render(
        <RouterWrapper>
          <TopBar
            {...defaultProps}
            hasGeneratedCode={true}
            hasOAuthToken={true}
            onCreateBackend={onCreateBackend}
          />
        </RouterWrapper>
      );

      const button = document.querySelector(
        '[data-testid="btn-create-backend"]'
      ) as HTMLButtonElement;
      fireEvent.click(button);

      expect(onCreateBackend).toHaveBeenCalledTimes(1);
    });

    it('should not call onCreateBackend when button is disabled (no code)', () => {
      const onCreateBackend = vi.fn();
      render(
        <RouterWrapper>
          <TopBar
            {...defaultProps}
            hasGeneratedCode={false}
            hasOAuthToken={true}
            onCreateBackend={onCreateBackend}
          />
        </RouterWrapper>
      );

      const button = document.querySelector(
        '[data-testid="btn-create-backend"]'
      ) as HTMLButtonElement;
      fireEvent.click(button);

      expect(onCreateBackend).not.toHaveBeenCalled();
    });

    it('should not call onCreateBackend when button is disabled (no OAuth)', () => {
      const onCreateBackend = vi.fn();
      render(
        <RouterWrapper>
          <TopBar
            {...defaultProps}
            hasGeneratedCode={true}
            hasOAuthToken={false}
            onCreateBackend={onCreateBackend}
          />
        </RouterWrapper>
      );

      const button = document.querySelector(
        '[data-testid="btn-create-backend"]'
      ) as HTMLButtonElement;
      fireEvent.click(button);

      expect(onCreateBackend).not.toHaveBeenCalled();
    });
  });

  describe('Create Backend Button - Default Props', () => {
    it('should have correct defaults when optional props not provided', () => {
      render(
        <RouterWrapper>
          <TopBar {...defaultProps} />
        </RouterWrapper>
      );

      const button = document.querySelector(
        '[data-testid="btn-create-backend"]'
      ) as HTMLButtonElement;
      expect(button).not.toBeNull();
      // Default: hasGeneratedCode=false, hasOAuthToken=false
      expect(button.disabled).toBe(true);
      expect(button.getAttribute('title')).toBe('Generate code first');
    });
  });

  describe('Deploy to Vercel Button', () => {
    it('should render deploy button', () => {
      render(
        <RouterWrapper>
          <TopBar {...defaultProps} />
        </RouterWrapper>
      );

      const deployBtn = document.querySelector(
        '[data-testid="btn-deploy-vercel"]'
      ) as HTMLButtonElement;
      expect(deployBtn).not.toBeNull();
    });

    it('should be disabled when no code has been generated', () => {
      render(
        <RouterWrapper>
          <TopBar {...defaultProps} hasGeneratedCode={false} isVercelAuthenticated={true} />
        </RouterWrapper>
      );

      const deployBtn = document.querySelector(
        '[data-testid="btn-deploy-vercel"]'
      ) as HTMLButtonElement;
      expect(deployBtn.disabled).toBe(true);
      expect(deployBtn.getAttribute('title')).toBe('Generate code first');
    });

    it('should show login tooltip when not Vercel authenticated', () => {
      render(
        <RouterWrapper>
          <TopBar {...defaultProps} hasGeneratedCode={true} isVercelAuthenticated={false} />
        </RouterWrapper>
      );

      const deployBtn = document.querySelector(
        '[data-testid="btn-deploy-vercel"]'
      ) as HTMLButtonElement;
      expect(deployBtn.getAttribute('title')).toBe('Login with Vercel to deploy');
    });

    it('should be enabled when code exists and authenticated with Vercel', () => {
      render(
        <RouterWrapper>
          <TopBar {...defaultProps} hasGeneratedCode={true} isVercelAuthenticated={true} />
        </RouterWrapper>
      );

      const deployBtn = document.querySelector(
        '[data-testid="btn-deploy-vercel"]'
      ) as HTMLButtonElement;
      expect(deployBtn.disabled).toBe(false);
      expect(deployBtn.getAttribute('title')).toBe('Deploy to Vercel');
    });

    it('should show spinner and "Deploying..." text when isDeploying=true', () => {
      render(
        <RouterWrapper>
          <TopBar
            {...defaultProps}
            hasGeneratedCode={true}
            isVercelAuthenticated={true}
            isDeploying={true}
          />
        </RouterWrapper>
      );

      const deployBtn = document.querySelector(
        '[data-testid="btn-deploy-vercel"]'
      ) as HTMLButtonElement;
      expect(deployBtn.className).toContain('loading');
      expect(deployBtn.textContent).toContain('Deploying...');
      expect(deployBtn.disabled).toBe(true);
    });

    it('should call onDeploy callback when button is clicked', () => {
      const onDeploy = vi.fn();
      render(
        <RouterWrapper>
          <TopBar
            {...defaultProps}
            hasGeneratedCode={true}
            isVercelAuthenticated={true}
            onDeploy={onDeploy}
          />
        </RouterWrapper>
      );

      const deployBtn = document.querySelector(
        '[data-testid="btn-deploy-vercel"]'
      ) as HTMLButtonElement;
      fireEvent.click(deployBtn);

      expect(onDeploy).toHaveBeenCalledTimes(1);
    });

    it('should not call onDeploy when button is disabled', () => {
      const onDeploy = vi.fn();
      render(
        <RouterWrapper>
          <TopBar
            {...defaultProps}
            hasGeneratedCode={false}
            isVercelAuthenticated={true}
            onDeploy={onDeploy}
          />
        </RouterWrapper>
      );

      const deployBtn = document.querySelector(
        '[data-testid="btn-deploy-vercel"]'
      ) as HTMLButtonElement;
      fireEvent.click(deployBtn);

      expect(onDeploy).not.toHaveBeenCalled();
    });
  });

  describe('Share Button', () => {
    it('should call onShare when Share button is clicked and not disabled', () => {
      const onShare = vi.fn();
      render(
        <RouterWrapper>
          <TopBar {...defaultProps} onShare={onShare} isShareDisabled={false} />
        </RouterWrapper>
      );
      const shareBtn = document.querySelector('[data-testid="btn-share"]') as HTMLButtonElement;
      expect(shareBtn).not.toBeNull();
      fireEvent.click(shareBtn);
      expect(onShare).toHaveBeenCalledTimes(1);
    });

    it('should be disabled when isShareDisabled=true', () => {
      render(
        <RouterWrapper>
          <TopBar {...defaultProps} isShareDisabled={true} onShare={vi.fn()} />
        </RouterWrapper>
      );
      const shareBtn = document.querySelector('[data-testid="btn-share"]') as HTMLButtonElement;
      expect(shareBtn.disabled).toBe(true);
    });

    it('should show "No project to share" tooltip when disabled', () => {
      render(
        <RouterWrapper>
          <TopBar {...defaultProps} isShareDisabled={true} onShare={vi.fn()} />
        </RouterWrapper>
      );
      const shareBtn = document.querySelector('[data-testid="btn-share"]') as HTMLButtonElement;
      expect(shareBtn.title).toBe('No project to share');
    });

    it('should show "Copied!" text and Check icon after click', () => {
      const onShare = vi.fn();
      render(
        <RouterWrapper>
          <TopBar {...defaultProps} onShare={onShare} isShareDisabled={false} />
        </RouterWrapper>
      );
      const shareBtn = document.querySelector('[data-testid="btn-share"]') as HTMLButtonElement;
      fireEvent.click(shareBtn);
      expect(shareBtn.textContent).toContain('Copied!');
      const checkIcon = shareBtn.querySelector('[data-testid="icon-check"]');
      expect(checkIcon).not.toBeNull();
    });

    it('should revert to Share text after 2 seconds', async () => {
      vi.useFakeTimers();
      const onShare = vi.fn();
      render(
        <RouterWrapper>
          <TopBar {...defaultProps} onShare={onShare} isShareDisabled={false} />
        </RouterWrapper>
      );
      const shareBtn = document.querySelector('[data-testid="btn-share"]') as HTMLButtonElement;
      fireEvent.click(shareBtn);
      expect(shareBtn.textContent).toContain('Copied!');
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(shareBtn.textContent).toContain('Share');
      vi.useRealTimers();
    });

    it('should NOT call onShare when already in copied state', () => {
      const onShare = vi.fn();
      render(
        <RouterWrapper>
          <TopBar {...defaultProps} onShare={onShare} isShareDisabled={false} />
        </RouterWrapper>
      );
      const shareBtn = document.querySelector('[data-testid="btn-share"]') as HTMLButtonElement;
      fireEvent.click(shareBtn); // first click
      fireEvent.click(shareBtn); // second click during copied state
      expect(onShare).toHaveBeenCalledTimes(1); // only called once
    });

    it('should not call onShare when button is disabled', () => {
      const onShare = vi.fn();
      render(
        <RouterWrapper>
          <TopBar {...defaultProps} onShare={onShare} isShareDisabled={true} />
        </RouterWrapper>
      );
      const shareBtn = document.querySelector('[data-testid="btn-share"]') as HTMLButtonElement;
      fireEvent.click(shareBtn);
      expect(onShare).not.toHaveBeenCalled();
    });
  });
});
