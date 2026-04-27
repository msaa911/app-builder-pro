import React, { useState, useRef, useCallback } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { FileCode, Save, Zap } from 'lucide-react';
import './CodeEditor.css';

interface CodeEditorProps {
  fileName?: string;
  code?: string;
  language?: string;
  onChange?: (value: string | undefined) => void;
  onSave?: (file: { path: string; content: string }) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  isSaving?: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  fileName = 'App.tsx',
  code = '// Welcome to App Builder Pro\n// Your code will appear here...',
  language = 'typescript',
  onChange,
  onSave,
  onDirtyChange,
  isSaving = false,
}) => {
  const [isDirty, setIsDirty] = useState(false);
  const editorRef = useRef<any>(null);

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;

      // Bind Ctrl+S (ES-003, ES-014) — Monaco native keybinding
      if (onSave) {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          const content = editor.getValue();
          onSave({ path: fileName, content });
          setIsDirty(false);
          onDirtyChange?.(false);
        });
      }
    },
    [fileName, onSave, onDirtyChange]
  );

  const handleChange = useCallback(
    (value: string | undefined) => {
      // Compute dirty by comparing current value vs code prop (ES-002, ES-005)
      const newDirty = value !== undefined && value !== code;
      if (newDirty !== isDirty) {
        setIsDirty(newDirty);
        onDirtyChange?.(newDirty);
      }
      onChange?.(value);
    },
    [code, isDirty, onChange, onDirtyChange]
  );

  const handleSaveClick = useCallback(() => {
    if (!onSave || isSaving) return;
    const content = editorRef.current?.getValue() ?? code;
    onSave({ path: fileName, content });
    setIsDirty(false);
    onDirtyChange?.(false);
  }, [onSave, isSaving, fileName, code, onDirtyChange]);

  return (
    <div className="code-editor-container" data-testid="code-editor-container">
      <div className="editor-toolbar" data-testid="editor-toolbar">
        <div className="file-info" data-testid="file-info">
          <FileCode size={16} className="file-icon" />
          <span className="file-name">{fileName}</span>
          {isDirty && <span className="dirty-indicator" data-testid="dirty-indicator" />}
        </div>
        <div className="editor-actions" data-testid="editor-actions">
          <button
            className={`btn-save ${isDirty ? 'btn-save--dirty' : ''} ${isSaving ? 'btn-save--saving' : ''}`}
            data-testid="btn-save"
            onClick={handleSaveClick}
            disabled={isSaving}
          >
            <Save size={14} />
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>
          <button className="btn-run" data-testid="btn-run">
            <Zap size={14} />
            <span>Run</span>
          </button>
        </div>
      </div>

      <div className="monaco-wrapper" data-testid="monaco-wrapper">
        <Editor
          height="100%"
          language={language}
          value={code}
          theme="vs-dark"
          onChange={handleChange}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            automaticLayout: true,
            padding: { top: 16 },
          }}
        />
      </div>
    </div>
  );
};

export default CodeEditor;
