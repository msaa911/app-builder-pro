/**
 * ChatPanel Restore Snapshot Button Tests
 * Task 3.5 RED → Task 3.6 GREEN
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import ChatPanel from '../ChatPanel';
import type { ChatMessage } from '../../../types';

// ─── Helpers ───────────────────────────────────────────────────────────

const makeMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'msg1',
  role: 'assistant',
  content: 'Here is your updated component.',
  timestamp: Date.now(),
  ...overrides,
});

// ─── Tests ─────────────────────────────────────────────────────────────

describe('ChatPanel — Restore Snapshot Button', () => {
  const mockOnSendMessage = vi.fn();
  const mockOnRestoreSnapshot = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render restore button on assistant messages when onRestoreSnapshot is provided', () => {
    const messages = [
      makeMessage({ id: 'msg1', role: 'user', content: 'Add a button' }),
      makeMessage({ id: 'msg2', role: 'assistant', content: 'Done!' }),
    ];

    render(
      <ChatPanel
        messages={messages}
        onSendMessage={mockOnSendMessage}
        isGenerating={false}
        onRestoreSnapshot={mockOnRestoreSnapshot}
      />
    );

    const restoreButtons = screen.getAllByTestId('btn-restore-version');
    // Only assistant messages get the restore button
    expect(restoreButtons).toHaveLength(1);
  });

  it('should NOT render restore button when onRestoreSnapshot is not provided', () => {
    const messages = [
      makeMessage({ id: 'msg1', role: 'assistant', content: 'Done!' }),
    ];

    render(
      <ChatPanel
        messages={messages}
        onSendMessage={mockOnSendMessage}
        isGenerating={false}
      />
    );

    expect(screen.queryByTestId('btn-restore-version')).toBeNull();
  });

  it('should NOT render restore button on user messages', () => {
    const messages = [
      makeMessage({ id: 'msg1', role: 'user', content: 'Add a button' }),
    ];

    render(
      <ChatPanel
        messages={messages}
        onSendMessage={mockOnSendMessage}
        isGenerating={false}
        onRestoreSnapshot={mockOnRestoreSnapshot}
      />
    );

    expect(screen.queryByTestId('btn-restore-version')).toBeNull();
  });

  it('should call onRestoreSnapshot with message index when restore button is clicked', () => {
    const messages = [
      makeMessage({ id: 'msg0', role: 'user', content: 'First' }),
      makeMessage({ id: 'msg1', role: 'assistant', content: 'First response' }),
      makeMessage({ id: 'msg2', role: 'user', content: 'Second' }),
      makeMessage({ id: 'msg3', role: 'assistant', content: 'Second response' }),
    ];

    render(
      <ChatPanel
        messages={messages}
        onSendMessage={mockOnSendMessage}
        isGenerating={false}
        onRestoreSnapshot={mockOnRestoreSnapshot}
      />
    );

    // Click the first assistant message restore button (message index 1)
    const restoreButtons = screen.getAllByTestId('btn-restore-version');
    fireEvent.click(restoreButtons[0]);

    expect(mockOnRestoreSnapshot).toHaveBeenCalledWith(1);
  });

  it('should disable restore button when isGenerating is true', () => {
    const messages = [
      makeMessage({ id: 'msg1', role: 'assistant', content: 'Done!' }),
    ];

    render(
      <ChatPanel
        messages={messages}
        onSendMessage={mockOnSendMessage}
        isGenerating={true}
        onRestoreSnapshot={mockOnRestoreSnapshot}
      />
    );

    const restoreBtn = screen.getByTestId('btn-restore-version') as HTMLButtonElement;
    expect(restoreBtn.disabled).toBe(true);
  });
});
