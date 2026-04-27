import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CodeEditor from '../components/editor/CodeEditor';

/**
 * Extended Monaco mock for save/dirty testing.
 * Captures onMount callback and provides a mock editor instance
 * that simulates getValue, addCommand (Ctrl+S binding), and onChange.
 */
let capturedOnMount: ((editor: any, monaco: any) => void) | null = null;
let capturedOnChange: ((value: string | undefined) => void) | null = null;
let mockEditorRef: { getValue: ReturnType<typeof vi.fn>; addCommand: ReturnType<typeof vi.fn> };

const createMockEditor = (currentValue: string) => {
  mockEditorRef = {
    getValue: vi.fn(() => currentValue),
    addCommand: vi.fn(),
  };
  return mockEditorRef;
};

const mockMonaco = {
  KeyMod: { CtrlCmd: 2048 },
  KeyCode: { KeyS: 49 },
};

vi.mock('@monaco-editor/react', () => ({
  default: (props: any) => {
    capturedOnMount = props.onMount || null;
    capturedOnChange = props.onChange || null;

    // Simulate onMount synchronously so the ref is captured
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
        data-onchange={props.onChange ? 'true' : 'false'}
        data-onmount={props.onMount ? 'true' : 'false'}
      />
    );
  },
}));

describe('CodeEditor — Save & Dirty Tracking', () => {
  beforeEach(() => {
    capturedOnMount = null;
    capturedOnChange = null;
  });

  describe('onSave callback (ES-001, ES-004)', () => {
    it('should call onSave with { path, content } when Save button is clicked', async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();

      render(<CodeEditor fileName="src/App.tsx" code="const x = 1;" onSave={onSave} />);

      const saveBtn = screen.getByTestId('btn-save');
      await user.click(saveBtn);

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith({
        path: 'src/App.tsx',
        content: 'const x = 1;',
      });
    });

    it('should not call onSave when Save button is clicked and onSave is not provided', async () => {
      const user = userEvent.setup();
      render(<CodeEditor fileName="App.tsx" code="hello" />);

      const saveBtn = screen.getByTestId('btn-save');
      await user.click(saveBtn);
      // No error thrown — graceful no-op
    });
  });

  describe('onDirtyChange callback (ES-002, ES-005)', () => {
    it('should call onDirtyChange(true) when editor content differs from code prop', () => {
      const onDirtyChange = vi.fn();
      render(<CodeEditor code="original content" onDirtyChange={onDirtyChange} />);

      // Simulate Monaco onChange with different value
      act(() => {
        capturedOnChange?.('modified content');
      });

      expect(onDirtyChange).toHaveBeenCalledWith(true);
    });

    it('should call onDirtyChange(false) when editor content matches code prop again', () => {
      const onDirtyChange = vi.fn();
      render(<CodeEditor code="original content" onDirtyChange={onDirtyChange} />);

      // Simulate edit — dirty
      act(() => {
        capturedOnChange?.('modified content');
      });
      expect(onDirtyChange).toHaveBeenCalledWith(true);

      // Simulate revert — clean
      act(() => {
        capturedOnChange?.('original content');
      });
      expect(onDirtyChange).toHaveBeenCalledWith(false);
    });

    it('should NOT call onDirtyChange when onChange is not provided', () => {
      render(<CodeEditor code="hello" />);
      // Simulate change — should not throw
      act(() => {
        capturedOnChange?.('something else');
      });
    });
  });

  describe('dirty indicator (ES-006)', () => {
    it('should show a dirty indicator when editor content differs from code prop', () => {
      const onDirtyChange = vi.fn();
      const { container } = render(
        <CodeEditor fileName="App.tsx" code="original" onDirtyChange={onDirtyChange} />
      );

      // Initially — no dirty indicator
      expect(container.querySelector('.dirty-indicator')).toBeNull();

      // Simulate edit
      act(() => {
        capturedOnChange?.('modified');
      });

      // Now dirty indicator should appear
      expect(container.querySelector('.dirty-indicator')).not.toBeNull();
    });

    it('should remove dirty indicator after save button is clicked', async () => {
      const onSave = vi.fn();
      const onDirtyChange = vi.fn();
      const user = userEvent.setup();
      const { container } = render(
        <CodeEditor
          fileName="App.tsx"
          code="original"
          onSave={onSave}
          onDirtyChange={onDirtyChange}
        />
      );

      // Simulate edit
      act(() => {
        capturedOnChange?.('modified');
      });
      expect(container.querySelector('.dirty-indicator')).not.toBeNull();

      // Click save — should clear dirty
      const saveBtn = screen.getByTestId('btn-save');
      await user.click(saveBtn);

      expect(container.querySelector('.dirty-indicator')).toBeNull();
    });
  });

  describe('Ctrl+S binding (ES-003, ES-014)', () => {
    it('should bind Ctrl+S via editor.addCommand in onMount', () => {
      render(<CodeEditor fileName="App.tsx" code="hello" onSave={vi.fn()} />);

      // The mock editor's addCommand should have been called
      expect(mockEditorRef.addCommand).toHaveBeenCalled();

      // Check that it was called with CtrlCmd + KeyS keybinding
      const callArgs = mockEditorRef.addCommand.mock.calls[0];
      expect(callArgs[0]).toBe(2048 + 49); // KeyMod.CtrlCmd + KeyCode.KeyS
    });

    it('should trigger onSave when Ctrl+S command callback is invoked', () => {
      const onSave = vi.fn();
      render(<CodeEditor fileName="App.tsx" code="hello world" onSave={onSave} />);

      // Extract the callback passed to addCommand
      const saveCallback = mockEditorRef.addCommand.mock.calls[0][1];

      // Invoke it (simulates Ctrl+S)
      act(() => {
        saveCallback();
      });

      expect(onSave).toHaveBeenCalledWith({
        path: 'App.tsx',
        content: 'hello world',
      });
    });
  });

  describe('isSaving prop (ES-007)', () => {
    it('should disable Save button and show saving text when isSaving=true', () => {
      render(<CodeEditor fileName="App.tsx" code="hello" isSaving={true} />);

      const saveBtn = screen.getByTestId('btn-save') as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(true);
      expect(saveBtn.textContent).toContain('Saving');
      expect(saveBtn.classList.contains('btn-save--saving')).toBe(true);
    });

    it('should enable Save button when isSaving=false', () => {
      render(<CodeEditor fileName="App.tsx" code="hello" isSaving={false} />);

      const saveBtn = screen.getByTestId('btn-save') as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(false);
      expect(saveBtn.textContent).toContain('Save');
    });

    it('should default isSaving to false', () => {
      render(<CodeEditor fileName="App.tsx" code="hello" />);

      const saveBtn = screen.getByTestId('btn-save') as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(false);
    });
  });

  describe('Save button dirty styling (ES-006)', () => {
    it('should apply btn-save--dirty class when editor is dirty', () => {
      const onDirtyChange = vi.fn();
      const { container } = render(
        <CodeEditor fileName="App.tsx" code="original" onDirtyChange={onDirtyChange} />
      );

      const saveBtn = container.querySelector('[data-testid="btn-save"]') as HTMLButtonElement;
      expect(saveBtn.classList.contains('btn-save--dirty')).toBe(false);

      // Simulate edit
      act(() => {
        capturedOnChange?.('modified');
      });

      expect(saveBtn.classList.contains('btn-save--dirty')).toBe(true);
    });
  });
});
