/**
 * Tests for Toast warn type + action prop (ITR-007, ITR-009)
 * Change: chat-iterative-refine
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../Toast';

// Test component with warn + action buttons
function TestComponent() {
  const { showToast } = useToast();

  return (
    <div>
      <button
        data-testid="btn-warn"
        onClick={() =>
          showToast({
            message: 'AI overwrote 2 file(s)',
            type: 'warn',
            duration: 8000,
            action: {
              label: 'Undo',
              callback: () => {},
            },
          })
        }
      >
        Show Warn
      </button>
      <button
        data-testid="btn-warn-no-action"
        onClick={() =>
          showToast({
            message: 'Warning without action',
            type: 'warn',
          })
        }
      >
        Show Warn No Action
      </button>
      <button
        data-testid="btn-warn-with-action"
        onClick={() =>
          showToast({
            message: 'Overwrite detected',
            type: 'warn',
            duration: 8000,
            action: {
              label: 'Undo',
              callback: () => {
                // callback logic is tested by the caller
              },
            },
          })
        }
      >
        Show Warn With Action
      </button>
    </div>
  );
}

describe('Toast System — warn type + action prop (ITR-007, ITR-009)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('warn toast type', () => {
    it('should display warn toast with correct message', async () => {
      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('btn-warn'));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(screen.getByText('AI overwrote 2 file(s)')).toBeInTheDocument();
    });

    it('should render warn toast with toast-warn class', async () => {
      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('btn-warn'));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      const toast = screen.getByRole('alert');
      expect(toast).toHaveClass('toast-warn');
    });

    it('should auto-dismiss warn toast after specified duration', async () => {
      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('btn-warn'));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(screen.getByText('AI overwrote 2 file(s)')).toBeInTheDocument();

      // Advance past 8000ms duration + 300ms exit animation
      await act(async () => {
        vi.advanceTimersByTime(8000);
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(screen.queryByText('AI overwrote 2 file(s)')).not.toBeInTheDocument();
    });
  });

  describe('action prop', () => {
    it('should render action button when action prop is provided', async () => {
      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('btn-warn-with-action'));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    });

    it('should NOT render action button when action prop is absent', async () => {
      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('btn-warn-no-action'));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Only the close button should exist, no Undo button
      const allButtons = screen.getAllByRole('button');
      // The close button exists, but no "Undo" button
      expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    });

    it('should call action callback when action button is clicked', async () => {
      const mockCallback = vi.fn();

      function TestComponentWithCallback() {
        const { showToast } = useToast();
        return (
          <button
            data-testid="btn-warn-callback"
            onClick={() =>
              showToast({
                message: 'Overwrite!',
                type: 'warn',
                action: {
                  label: 'Undo',
                  callback: mockCallback,
                },
              })
            }
          >
            Show Warn
          </button>
        );
      }

      render(
        <ToastProvider>
          <TestComponentWithCallback />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('btn-warn-callback'));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      const undoBtn = screen.getByRole('button', { name: 'Undo' });
      fireEvent.click(undoBtn);

      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('action button click triggers callback and dismisses toast', async () => {
      const mockCallback = vi.fn();

      function TestComponentWithCallback() {
        const { showToast } = useToast();
        return (
          <button
            data-testid="btn-warn-dismiss"
            onClick={() =>
              showToast({
                message: 'Dismiss me',
                type: 'warn',
                action: {
                  label: 'Undo',
                  callback: mockCallback,
                },
              })
            }
          >
            Show Warn
          </button>
        );
      }

      render(
        <ToastProvider>
          <TestComponentWithCallback />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('btn-warn-dismiss'));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      const undoBtn = screen.getByRole('button', { name: 'Undo' });
      fireEvent.click(undoBtn);

      expect(mockCallback).toHaveBeenCalled();

      // Toast should dismiss after clicking the action button
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
    });
  });
});
