/**
 * TopBar History Button Tests
 * Task 3.3 RED → Task 3.4 GREEN
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import TopBar from '../TopBar';
import { RouterWrapper } from '../../../test-utils/RouterWrapper';
import type { BuilderState } from '../../../types';

// Mock lucide-react icons — add History to the existing set
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
  LogOut: () => <span data-testid="icon-logout">LogOut</span>,
  User: () => <span data-testid="icon-user">User</span>,
  History: () => <span data-testid="icon-history">History</span>,
}));

// Mock QuotaStatus component
vi.mock('../QuotaStatus', () => ({
  QuotaStatus: () => <div data-testid="quota-status">Quota</div>,
}));

// Mock AuthContext
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, logout: vi.fn() }),
}));

describe('TopBar — History Button', () => {
  const defaultProps = {
    projectName: 'Test Project',
    state: 'idle' as BuilderState,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render History button when onOpenHistory prop is provided', () => {
    const onOpenHistory = vi.fn();
    render(
      <RouterWrapper>
        <TopBar {...defaultProps} onOpenHistory={onOpenHistory} />
      </RouterWrapper>
    );

    const historyBtn = document.querySelector('[data-testid="btn-open-history"]');
    expect(historyBtn).not.toBeNull();
  });

  it('should NOT render History button when onOpenHistory prop is not provided', () => {
    render(
      <RouterWrapper>
        <TopBar {...defaultProps} />
      </RouterWrapper>
    );

    const historyBtn = document.querySelector('[data-testid="btn-open-history"]');
    expect(historyBtn).toBeNull();
  });

  it('should call onOpenHistory when History button is clicked', () => {
    const onOpenHistory = vi.fn();
    render(
      <RouterWrapper>
        <TopBar {...defaultProps} onOpenHistory={onOpenHistory} />
      </RouterWrapper>
    );

    const historyBtn = document.querySelector('[data-testid="btn-open-history"]') as HTMLButtonElement;
    fireEvent.click(historyBtn);

    expect(onOpenHistory).toHaveBeenCalledTimes(1);
  });

  it('should have correct title attribute for accessibility', () => {
    const onOpenHistory = vi.fn();
    render(
      <RouterWrapper>
        <TopBar {...defaultProps} onOpenHistory={onOpenHistory} />
      </RouterWrapper>
    );

    const historyBtn = document.querySelector('[data-testid="btn-open-history"]') as HTMLButtonElement;
    expect(historyBtn.getAttribute('title')).toBe('Version History');
  });
});
