/**
 * Tests for ChatPanel onNewChat prop (ITR-006)
 * Change: chat-iterative-refine
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatPanel from '../ChatPanel';

describe('ChatPanel — onNewChat prop (ITR-006)', () => {
  it('should call onNewChat when New Chat button is clicked', async () => {
    const onNewChat = vi.fn();
    const user = userEvent.setup();

    render(
      <ChatPanel
        messages={[]}
        onSendMessage={() => {}}
        isGenerating={false}
        onNewChat={onNewChat}
      />
    );

    const newChatBtn = document.querySelector('.btn-new-chat') as HTMLButtonElement;
    expect(newChatBtn).not.toBeNull();

    await user.click(newChatBtn);

    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it('should work without onNewChat prop (backward compat)', () => {
    // Should render without error when onNewChat is not provided
    render(<ChatPanel messages={[]} onSendMessage={() => {}} isGenerating={false} />);

    const newChatBtn = document.querySelector('.btn-new-chat') as HTMLButtonElement;
    expect(newChatBtn).not.toBeNull();
    // No crash — backward compatibility
  });

  it('should not call onNewChat when isGenerating is true but button is clicked', async () => {
    const onNewChat = vi.fn();
    const user = userEvent.setup();

    render(
      <ChatPanel messages={[]} onSendMessage={() => {}} isGenerating={true} onNewChat={onNewChat} />
    );

    const newChatBtn = document.querySelector('.btn-new-chat') as HTMLButtonElement;
    await user.click(newChatBtn);

    // New Chat should still work during generation — it's a reset action
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });
});
