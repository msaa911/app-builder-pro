import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CodeEditor from '../components/editor/CodeEditor';

// Mock Monaco Editor — it cannot load in jsdom (Web Worker/WASM deps)
// Mock at the @monaco-editor/react boundary as per design
// Uses controlled props: language + value (not defaultLanguage + defaultValue) — CE-001
vi.mock('@monaco-editor/react', () => ({
  default: (props: any) => (
    <div
      data-testid="monaco-editor"
      data-language={props.language}
      data-value={props.value}
      data-theme={props.theme}
      data-onchange={props.onChange ? 'true' : 'false'}
    />
  ),
}));

describe('CodeEditor', () => {
  describe('toolbar rendering', () => {
    it('should render the file name in the toolbar', () => {
      render(<CodeEditor fileName="App.tsx" />);

      expect(screen.getByText('App.tsx')).toBeInTheDocument();
    });

    it('should render default file name when not provided', () => {
      render(<CodeEditor />);

      expect(screen.getByText('App.tsx')).toBeInTheDocument();
    });

    it('should render custom file name', () => {
      render(<CodeEditor fileName="utils/helpers.ts" />);

      expect(screen.getByText('utils/helpers.ts')).toBeInTheDocument();
    });

    it('should render Save button', () => {
      render(<CodeEditor />);

      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('should render Run button', () => {
      render(<CodeEditor />);

      expect(screen.getByText('Run')).toBeInTheDocument();
    });

    it('should render the editor toolbar container', () => {
      const { container } = render(<CodeEditor />);

      expect(container.querySelector('[data-testid="editor-toolbar"]')).not.toBeNull();
    });
  });

  describe('Monaco editor mock', () => {
    it('should render the mocked Monaco editor', () => {
      render(<CodeEditor />);

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    it('should pass language prop to Monaco (controlled mode — CE-001)', () => {
      render(<CodeEditor language="python" />);

      const editor = screen.getByTestId('monaco-editor');
      expect(editor.getAttribute('data-language')).toBe('python');
    });

    it('should default to typescript language', () => {
      render(<CodeEditor />);

      const editor = screen.getByTestId('monaco-editor');
      expect(editor.getAttribute('data-language')).toBe('typescript');
    });

    it('should pass code as value prop to Monaco (controlled mode — CE-001)', () => {
      render(<CodeEditor code="const x = 42;" />);

      const editor = screen.getByTestId('monaco-editor');
      expect(editor.getAttribute('data-value')).toBe('const x = 42;');
    });

    it('should pass default code when not provided', () => {
      render(<CodeEditor />);

      const editor = screen.getByTestId('monaco-editor');
      expect(editor.getAttribute('data-value')).toContain('Welcome to App Builder Pro');
    });

    it('should pass vs-dark theme to Monaco', () => {
      render(<CodeEditor />);

      const editor = screen.getByTestId('monaco-editor');
      expect(editor.getAttribute('data-theme')).toBe('vs-dark');
    });
  });

  describe('controlled mode (CE-001)', () => {
    it('should use controlled value prop instead of defaultValue', () => {
      render(<CodeEditor code="controlled content" />);

      const editor = screen.getByTestId('monaco-editor');
      expect(editor.getAttribute('data-value')).toBe('controlled content');
    });

    it('should update displayed value when code prop changes', () => {
      const { rerender } = render(<CodeEditor code="first content" />);

      let editor = screen.getByTestId('monaco-editor');
      expect(editor.getAttribute('data-value')).toBe('first content');

      // Simulate file switch — code prop changes
      rerender(<CodeEditor code="second content" />);

      editor = screen.getByTestId('monaco-editor');
      expect(editor.getAttribute('data-value')).toBe('second content');
    });

    it('should pass onChange callback to Monaco editor', () => {
      const onChange = vi.fn();
      render(<CodeEditor onChange={onChange} />);

      const editor = screen.getByTestId('monaco-editor');
      expect(editor.getAttribute('data-onchange')).toBe('true');
    });

    it('should not pass onChange to Monaco when not provided', () => {
      render(<CodeEditor />);

      const editor = screen.getByTestId('monaco-editor');
      expect(editor.getAttribute('data-onchange')).toBe('false');
    });
  });

  describe('container structure', () => {
    it('should render code-editor-container', () => {
      const { container } = render(<CodeEditor />);

      expect(container.querySelector('[data-testid="code-editor-container"]')).not.toBeNull();
    });

    it('should render monaco-wrapper', () => {
      const { container } = render(<CodeEditor />);

      expect(container.querySelector('[data-testid="monaco-wrapper"]')).not.toBeNull();
    });

    it('should render file-info section', () => {
      const { container } = render(<CodeEditor />);

      expect(container.querySelector('[data-testid="file-info"]')).not.toBeNull();
    });

    it('should render editor-actions section', () => {
      const { container } = render(<CodeEditor />);

      expect(container.querySelector('[data-testid="editor-actions"]')).not.toBeNull();
    });
  });

  describe('button interactions', () => {
    it('should render Save button as clickable', () => {
      const { container } = render(<CodeEditor />);

      const saveButton = container.querySelector('[data-testid="btn-save"]') as HTMLButtonElement;
      expect(saveButton).not.toBeNull();
      expect(saveButton.tagName).toBe('BUTTON');
    });

    it('should render Run button as clickable', () => {
      const { container } = render(<CodeEditor />);

      const runButton = container.querySelector('[data-testid="btn-run"]') as HTMLButtonElement;
      expect(runButton).not.toBeNull();
      expect(runButton.tagName).toBe('BUTTON');
    });
  });
});
