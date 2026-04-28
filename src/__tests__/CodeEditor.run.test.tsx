import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CodeEditor from '../components/editor/CodeEditor';

/**
 * Monaco mock — same pattern as CodeEditor.save.test.tsx
 * Captures onMount and onChange callbacks for simulation.
 */
let capturedOnMount: ((editor: any, monaco: any) => void) | null = null;
let capturedOnChange: ((value: string | undefined) => void) | null = null;

const createMockEditor = (currentValue: string) => ({
  getValue: vi.fn(() => currentValue),
  addCommand: vi.fn(),
});

const mockMonaco = {
  KeyMod: { CtrlCmd: 2048 },
  KeyCode: { KeyS: 49 },
};

vi.mock('@monaco-editor/react', () => ({
  default: (props: any) => {
    capturedOnMount = props.onMount || null;
    capturedOnChange = props.onChange || null;

    if (props.onMount) {
      const editor = createMockEditor(props.value || '');
      props.onMount(editor, mockMonaco);
    }

    return (
      <div
        data-testid="monaco-editor"
        data-language={props.language}
        data-value={props.value}
        data-theme={props.theme}
      />
    );
  },
}));

describe('CodeEditor — Run Button (ER-001 to ER-005)', () => {
  beforeEach(() => {
    capturedOnMount = null;
    capturedOnChange = null;
  });

  describe('onRun callback (ER-001)', () => {
    it('should call onRun when Run button is clicked', async () => {
      // Given
      const onRun = vi.fn();
      const user = userEvent.setup();
      render(<CodeEditor code="console.log('hello')" onRun={onRun} />);

      // When
      const runBtn = screen.getByTestId('btn-run');
      await user.click(runBtn);

      // Then
      expect(onRun).toHaveBeenCalledTimes(1);
    });

    it('should not call onRun when Run button is clicked and onRun is not provided', async () => {
      // Given — no onRun prop
      const user = userEvent.setup();
      render(<CodeEditor code="hello" />);

      // When — clicking Run should not throw
      const runBtn = screen.getByTestId('btn-run');
      await user.click(runBtn);

      // Then — no error, graceful no-op
    });
  });

  describe('Run button idle state (ER-002)', () => {
    it('should show "Run" label when isRunning=false and hasCrashed=false', () => {
      // Given
      render(<CodeEditor code="hello" isRunning={false} hasCrashed={false} />);

      // Then
      const runBtn = screen.getByTestId('btn-run');
      expect(runBtn.textContent).toContain('Run');
      expect(runBtn.classList.contains('btn-run--running')).toBe(false);
      expect(runBtn.classList.contains('btn-run--crashed')).toBe(false);
    });
  });

  describe('Run button running state (ER-002)', () => {
    it('should show "Running" label and btn-run--running class when isRunning=true', () => {
      // Given
      render(<CodeEditor code="hello" isRunning={true} hasCrashed={false} />);

      // Then
      const runBtn = screen.getByTestId('btn-run');
      expect(runBtn.textContent).toContain('Running');
      expect(runBtn.classList.contains('btn-run--running')).toBe(true);
      expect(runBtn.classList.contains('btn-run--crashed')).toBe(false);
    });
  });

  describe('Run button crashed state (ER-005)', () => {
    it('should show "Restart" label and btn-run--crashed class when hasCrashed=true', () => {
      // Given
      render(<CodeEditor code="hello" isRunning={false} hasCrashed={true} />);

      // Then
      const runBtn = screen.getByTestId('btn-run');
      expect(runBtn.textContent).toContain('Restart');
      expect(runBtn.classList.contains('btn-run--crashed')).toBe(true);
      expect(runBtn.classList.contains('btn-run--running')).toBe(false);
    });

    it('should call onRun when Restart button is clicked (restart triggers onRun)', async () => {
      // Given
      const onRun = vi.fn();
      const user = userEvent.setup();
      render(<CodeEditor code="hello" isRunning={false} hasCrashed={true} onRun={onRun} />);

      // When
      const runBtn = screen.getByTestId('btn-run');
      await user.click(runBtn);

      // Then — clicking Restart also fires onRun (BuilderPage decides what to do)
      expect(onRun).toHaveBeenCalledTimes(1);
    });
  });
});
