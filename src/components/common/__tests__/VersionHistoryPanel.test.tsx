/**
 * VersionHistoryPanel Tests
 * Task 3.1 RED → Task 3.2 GREEN
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import VersionHistoryPanel from '../VersionHistoryPanel';
import type { PersistedSnapshot } from '../../../services/storage/types';

// ─── Helpers ───────────────────────────────────────────────────────────

const makeSnapshot = (overrides: Partial<PersistedSnapshot> = {}): PersistedSnapshot => ({
  id: 'snap1',
  projectId: 'proj1',
  files: [{ path: 'src/App.tsx', content: 'export const App = () => {}' }],
  trigger: 'refine',
  messageIndex: 0,
  createdAt: Date.now(),
  ...overrides,
});

// ─── Tests ─────────────────────────────────────────────────────────────

describe('VersionHistoryPanel', () => {
  const mockOnRestore = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render snapshot list with trigger label and timestamp', () => {
    const snapshots = [
      makeSnapshot({ id: 'snap1', trigger: 'refine', createdAt: 1700000000000 }),
      makeSnapshot({ id: 'snap2', trigger: 'editor-save', createdAt: 1700000100000 }),
    ];

    render(
      <VersionHistoryPanel
        snapshots={snapshots}
        isLoading={false}
        isGenerating={false}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    // Should show trigger labels
    expect(screen.getByText('Refine')).not.toBeNull();
    expect(screen.getByText('Editor Save')).not.toBeNull();
  });

  it('should show empty state when no snapshots exist', () => {
    render(
      <VersionHistoryPanel
        snapshots={[]}
        isLoading={false}
        isGenerating={false}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByTestId('history-empty')).not.toBeNull();
  });

  it('should show loading state when isLoading is true', () => {
    render(
      <VersionHistoryPanel
        snapshots={[]}
        isLoading={true}
        isGenerating={false}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByTestId('history-loading')).not.toBeNull();
  });

  it('should disable restore button when isGenerating is true', () => {
    const snapshots = [makeSnapshot({ id: 'snap1' })];

    render(
      <VersionHistoryPanel
        snapshots={snapshots}
        isLoading={false}
        isGenerating={true}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    const restoreButtons = screen.getAllByTestId('btn-restore-snapshot');
    restoreButtons.forEach((btn) => {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it('should call onRestore with snapshot id when restore button is clicked', () => {
    const snapshots = [makeSnapshot({ id: 'snap-restore-me' })];

    render(
      <VersionHistoryPanel
        snapshots={snapshots}
        isLoading={false}
        isGenerating={false}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    const restoreBtn = screen.getByTestId('btn-restore-snapshot');
    fireEvent.click(restoreBtn);

    expect(mockOnRestore).toHaveBeenCalledWith('snap-restore-me');
  });

  it('should call onDelete with snapshot id when delete button is clicked', () => {
    const snapshots = [makeSnapshot({ id: 'snap-delete-me' })];

    render(
      <VersionHistoryPanel
        snapshots={snapshots}
        isLoading={false}
        isGenerating={false}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    const deleteBtn = screen.getByTestId('btn-delete-snapshot');
    fireEvent.click(deleteBtn);

    expect(mockOnDelete).toHaveBeenCalledWith('snap-delete-me');
  });

  it('should call onClose when close button is clicked', () => {
    render(
      <VersionHistoryPanel
        snapshots={[]}
        isLoading={false}
        isGenerating={false}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    const closeBtn = screen.getByTestId('btn-close-history');
    fireEvent.click(closeBtn);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should render snapshots in the order received (hook sorts desc)', () => {
    // The hook already returns sorted desc (newest first), so the panel
    // just renders in the order it receives — no re-sorting
    const snapshots = [
      makeSnapshot({ id: 'snap-new', createdAt: 3000 }),
      makeSnapshot({ id: 'snap-old', createdAt: 1000 }),
    ];

    const { container } = render(
      <VersionHistoryPanel
        snapshots={snapshots}
        isLoading={false}
        isGenerating={false}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    const items = container.querySelectorAll('[data-testid="snapshot-item"]');
    // First rendered item should be the first in the array (snap-new)
    expect(items[0].getAttribute('data-snapshot-id')).toBe('snap-new');
    expect(items[1].getAttribute('data-snapshot-id')).toBe('snap-old');
  });

  it('should show message index for refine triggers', () => {
    const snapshots = [
      makeSnapshot({ id: 'snap-refine', trigger: 'refine', messageIndex: 5 }),
    ];

    render(
      <VersionHistoryPanel
        snapshots={snapshots}
        isLoading={false}
        isGenerating={false}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('#5')).not.toBeNull();
  });

  it('should not show message index for editor-save triggers', () => {
    const snapshots = [
      makeSnapshot({ id: 'snap-save', trigger: 'editor-save', messageIndex: null }),
    ];

    render(
      <VersionHistoryPanel
        snapshots={snapshots}
        isLoading={false}
        isGenerating={false}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    // No message index element for editor-save
    expect(screen.queryByTestId('message-index')).toBeNull();
  });
});
