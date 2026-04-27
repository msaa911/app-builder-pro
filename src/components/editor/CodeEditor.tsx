import React from 'react';
import Editor from '@monaco-editor/react';
import { FileCode, Save, Zap } from 'lucide-react';
import './CodeEditor.css';

interface CodeEditorProps {
  fileName?: string;
  code?: string;
  language?: string;
  onChange?: (value: string | undefined) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  fileName = 'App.tsx',
  code = '// Welcome to App Builder Pro\n// Your code will appear here...',
  language = 'typescript',
  onChange,
}) => {
  return (
    <div className="code-editor-container" data-testid="code-editor-container">
      <div className="editor-toolbar" data-testid="editor-toolbar">
        <div className="file-info" data-testid="file-info">
          <FileCode size={16} className="file-icon" />
          <span className="file-name">{fileName}</span>
        </div>
        <div className="editor-actions" data-testid="editor-actions">
          <button className="btn-save" data-testid="btn-save">
            <Save size={14} />
            <span>Save</span>
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
          onChange={onChange}
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
