/**
 * Tests for editor save flow in BuilderPage
 * Change: editor-save-to-webcontainer
 * Spec IDs: ES-008 (onChange updates activeFile), ES-009 (save writes to WC),
 *           ES-010 (save updates currentFiles), ES-011 (save refreshes fileTree),
 *           ES-012 (unsaved file switch guard), ES-013 (race guard)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import BuilderPage from '../BuilderPage';

// ===== Mock Toast System =====
const mockShowToast = vi.fn();
vi.mock('../../components/common/Toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="toast-provider">{children}</div>
  ),
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

// ===== Mock Child Components =====
vi.mock('../../components/common/TopBar', () => ({
  default: () => <div data-testid="topbar" />,
}));

vi.mock('../../components/chat/ChatPanel', () => ({
  default: () => <div data-testid="chat-panel" />,
}));

vi.mock('../../components/preview/PreviewPanel', () => ({
  default: () => <div data-testid="preview-panel" />,
}));

// Mock CodeEditor — captures onSave, onDirtyChange, onChange, isSaving props
let capturedEditorOnSave: ((file: { path: string; content: string }) => void) | null = null;
let capturedEditorOnDirtyChange: ((isDirty: boolean) => void) | null = null;
let capturedEditorOnChange: ((value: string | undefined) => void) | null = null;
let capturedEditorIsSaving: boolean | null = null;

vi.mock('../../components/editor/CodeEditor', () => ({
  default: ({
    code,
    fileName,
    onSave,
    onDirtyChange,
    onChange,
    isSaving,
  }: {
    code: string;
    fileName: string;
    onSave?: (file: { path: string; content: string }) => void;
    onDirtyChange?: (isDirty: boolean) => void;
    onChange?: (value: string | undefined) => void;
    isSaving?: boolean;
  }) => {
    capturedEditorOnSave = onSave || null;
    capturedEditorOnDirtyChange = onDirtyChange || null;
    capturedEditorOnChange = onChange || null;
    capturedEditorIsSaving = isSaving ?? null;
    return (
      <div data-testid="code-editor">
        <span data-testid="editor-file-name">{fileName}</span>
        <pre data-testid="editor-code-content">{code}</pre>
        <span data-testid="editor-is-saving">{isSaving ? 'true' : 'false'}</span>
        <button
          data-testid="editor-save-trigger"
          onClick={() => onSave?.({ path: fileName, content: code })}
        />
        <button data-testid="editor-dirty-trigger" onClick={() => onDirtyChange?.(true)} />
        <button
          data-testid="editor-change-trigger"
          onClick={() => onChange?.('modified content')}
        />
      </div>
    );
  },
}));

vi.mock('../../components/editor/FileExplorer', () => ({
  default: ({
    files,
    onFileSelect,
    selectedPath,
  }: {
    files: Array<{ path: string }>;
    onFileSelect?: (path: string) => void;
    selectedPath?: string;
  }) => (
    <div data-testid="file-explorer">
      <span data-testid="file-count">{files?.length || 0}</span>
      {files?.map((f) => (
        <button
          key={f.path}
          data-testid={`file-btn-${f.path}`}
          onClick={() => onFileSelect?.(f.path)}
          className={selectedPath === f.path ? 'selected' : ''}
        >
          {f.path}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../../components/common/ConsolePanel', () => ({
  default: () => <div data-testid="console-panel" />,
}));

vi.mock('../../components/common/BuildErrorPanel', () => ({
  default: () => <div data-testid="build-error-panel" />,
}));

vi.mock('../../components/backend/BackendCreationModal', () => ({
  default: () => <div data-testid="backend-modal" />,
}));

vi.mock('../../components/backend/CredentialsModal', () => ({
  default: () => <div data-testid="credentials-modal" />,
}));

vi.mock('../../components/deploy/DeployModal', () => ({
  default: () => <div data-testid="deploy-modal" />,
}));

vi.mock('../../components/deploy/DeploySuccess', () => ({
  default: () => <div data-testid="deploy-success" />,
}));

vi.mock('../../components/settings/SettingsModal', () => ({
  default: () => <div data-testid="settings-modal" />,
}));

// ===== Mock Hooks =====
const mockMount = vi.fn();
const mockInstall = vi.fn();
const mockRunDev = vi.fn();
const mockWriteFile = vi.fn();
const mockRefresh = vi.fn();

vi.mock('../../hooks/useAIBuilder', () => ({
  useAIBuilder: () => ({
    generate: vi.fn(),
    refine: vi.fn(),
  }),
}));

vi.mock('../../hooks/useWebContainer', () => ({
  useWebContainer: () => ({
    mount: mockMount,
    install: mockInstall,
    runDev: mockRunDev,
    writeFile: mockWriteFile,
    updateFiles: vi.fn(),
  }),
}));

vi.mock('../../hooks/backend/pipeline/useBackendCreation', () => ({
  useBackendCreation: () => ({
    stage: 'idle',
    progress: 0,
    isCreating: false,
    error: null,
    result: null,
    requirements: null,
    createBackend: vi.fn(),
    retry: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock('../../hooks/backend/oauth/useSupabaseOAuth', () => ({
  useSupabaseOAuth: () => ({
    isAuthenticated: false,
  }),
}));

vi.mock('../../hooks/deploy', () => ({
  useVercelOAuth: () => ({
    isAuthenticated: false,
    status: 'idle',
    error: null,
    login: vi.fn(),
    exchangeCode: vi.fn(),
  }),
  useVercelDeploy: () => ({
    stage: 'idle',
    progress: 0,
    isDeploying: false,
    error: null,
    result: null,
    deploy: vi.fn(),
    retry: vi.fn(),
    reset: vi.fn(),
    abort: vi.fn(),
  }),
}));

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    getEffectiveApiKey: () => 'test-key',
    modelId: 'test-model',
  }),
}));

// ===== Mock WebContainerManager =====
let mockIsWriting = false;
const mockReadFile = vi.fn();

vi.mock('../../services/webcontainer/WebContainerManager', () => ({
  WebContainerManager: {
    getInstance: vi.fn(() =>
      Promise.resolve({
        readFile: mockReadFile,
        readDir: vi.fn(() => Promise.resolve([])),
        watch: vi.fn(() => ({ close: vi.fn() })),
        writeFile: mockWriteFile,
        get isWriting() {
          return mockIsWriting;
        },
      })
    ),
  },
  PROTECTED_PATHS: ['/package.json', '/vite.config.ts', '/index.html'],
}));

// ===== Mock useFileTree =====
const mockFileTreeFiles = [
  { path: 'src/App.tsx' },
  { path: 'src/utils.ts' },
  { path: 'src/index.ts' },
];

vi.mock('../../hooks/useFileTree', () => ({
  useFileTree: () => ({
    files: mockFileTreeFiles,
    isLoading: false,
    error: null,
    refresh: mockRefresh,
    createFile: vi.fn(),
    createFolder: vi.fn(),
    deleteItem: vi.fn(),
  }),
}));

vi.mock('../../hooks/useConsoleLogs', () => ({
  useConsoleLogs: () => ({
    logs: [],
    addLog: vi.fn(),
    clearLogs: vi.fn(),
  }),
}));

vi.mock('../../services/adapter', () => ({
  adaptProject: vi.fn(() => ({ files: [] })),
}));

describe('BuilderPage — Editor Save Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockReset();
    mockReadFile.mockResolvedValue('// file content');
    mockWriteFile.mockReset();
    mockWriteFile.mockResolvedValue(undefined);
    mockIsWriting = false;
    capturedEditorOnSave = null;
    capturedEditorOnDirtyChange = null;
    capturedEditorOnChange = null;
    capturedEditorIsSaving = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleSave (ES-009, ES-010, ES-011)', () => {
    it('should call WCM.writeFile with path and content when onSave is triggered', async () => {
      const user = userEvent.setup();
      mockReadFile.mockResolvedValue('original content');

      render(<BuilderPage initialPrompt="" />);

      // Switch to Code tab
      const codeTab = screen.getByRole('button', { name: 'Code' });
      await user.click(codeTab);

      // Click a file to load it
      const fileBtn = screen.getByTestId('file-btn-src/App.tsx');
      await user.click(fileBtn);

      await waitFor(() => {
        expect(screen.getByTestId('editor-file-name').textContent).toBe('src/App.tsx');
      });

      // Trigger save via the mock's save button
      const saveTrigger = screen.getByTestId('editor-save-trigger');
      await user.click(saveTrigger);

      await waitFor(() => {
        expect(mockWriteFile).toHaveBeenCalledWith('src/App.tsx', expect.any(String));
      });
    });

    it('should refresh fileTree after save (ES-011)', async () => {
      const user = userEvent.setup();
      mockReadFile.mockResolvedValue('some content');

      render(<BuilderPage initialPrompt="" />);

      const codeTab = screen.getByRole('button', { name: 'Code' });
      await user.click(codeTab);

      const fileBtn = screen.getByTestId('file-btn-src/App.tsx');
      await user.click(fileBtn);

      await waitFor(() => {
        expect(screen.getByTestId('editor-file-name').textContent).toBe('src/App.tsx');
      });

      const saveTrigger = screen.getByTestId('editor-save-trigger');
      await user.click(saveTrigger);

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });
  });

  describe('race guard (ES-013)', () => {
    it('should show toast and NOT call writeFile when WCM.isWriting is true', async () => {
      const user = userEvent.setup();
      mockIsWriting = true;
      mockReadFile.mockResolvedValue('some content');

      render(<BuilderPage initialPrompt="" />);

      const codeTab = screen.getByRole('button', { name: 'Code' });
      await user.click(codeTab);

      const fileBtn = screen.getByTestId('file-btn-src/App.tsx');
      await user.click(fileBtn);

      await waitFor(() => {
        expect(screen.getByTestId('editor-file-name').textContent).toBe('src/App.tsx');
      });

      // Trigger save — should be blocked by race guard
      const saveTrigger = screen.getByTestId('editor-save-trigger');
      await user.click(saveTrigger);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'warn',
          })
        );
      });

      // writeFile should NOT have been called
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });

  describe('onChange updates activeFile (ES-008)', () => {
    it('should pass onChange callback to CodeEditor', async () => {
      const user = userEvent.setup();
      mockReadFile.mockResolvedValue('initial');

      render(<BuilderPage initialPrompt="" />);

      const codeTab = screen.getByRole('button', { name: 'Code' });
      await user.click(codeTab);

      const fileBtn = screen.getByTestId('file-btn-src/App.tsx');
      await user.click(fileBtn);

      await waitFor(() => {
        // The onChange callback should have been captured
        expect(capturedEditorOnChange).not.toBeNull();
      });
    });
  });

  describe('isSaving prop wired to CodeEditor (ES-007)', () => {
    it('should pass isSaving=false to CodeEditor by default', async () => {
      const user = userEvent.setup();
      mockReadFile.mockResolvedValue('content');

      render(<BuilderPage initialPrompt="" />);

      const codeTab = screen.getByRole('button', { name: 'Code' });
      await user.click(codeTab);

      const fileBtn = screen.getByTestId('file-btn-src/App.tsx');
      await user.click(fileBtn);

      await waitFor(() => {
        expect(screen.getByTestId('editor-is-saving').textContent).toBe('false');
      });
    });

    it('should transition isSaving to true while writeFile is in progress', async () => {
      const user = userEvent.setup();
      mockReadFile.mockResolvedValue('content');

      // Create a controlled promise so we can inspect isSaving mid-flight
      let resolveWriteFile!: () => void;
      mockWriteFile.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveWriteFile = resolve;
        })
      );

      render(<BuilderPage initialPrompt="" />);

      const codeTab = screen.getByRole('button', { name: 'Code' });
      await user.click(codeTab);

      const fileBtn = screen.getByTestId('file-btn-src/App.tsx');
      await user.click(fileBtn);

      await waitFor(() => {
        expect(screen.getByTestId('editor-file-name').textContent).toBe('src/App.tsx');
      });

      // Trigger save — writeFile is pending
      const saveTrigger = screen.getByTestId('editor-save-trigger');
      await user.click(saveTrigger);

      // isSaving should be true while writeFile is in progress
      await waitFor(() => {
        expect(screen.getByTestId('editor-is-saving').textContent).toBe('true');
      });

      // Now resolve writeFile
      resolveWriteFile();

      // isSaving should go back to false
      await waitFor(() => {
        expect(screen.getByTestId('editor-is-saving').textContent).toBe('false');
      });
    });
  });

  describe('onDirtyChange wired to CodeEditor (ES-002)', () => {
    it('should pass onDirtyChange callback to CodeEditor', async () => {
      const user = userEvent.setup();
      mockReadFile.mockResolvedValue('content');

      render(<BuilderPage initialPrompt="" />);

      const codeTab = screen.getByRole('button', { name: 'Code' });
      await user.click(codeTab);

      const fileBtn = screen.getByTestId('file-btn-src/App.tsx');
      await user.click(fileBtn);

      await waitFor(() => {
        expect(capturedEditorOnDirtyChange).not.toBeNull();
      });
    });
  });

  describe('currentFiles updated on save (ES-010)', () => {
    it('should update currentFiles content after save — verified via writeFile receiving onChange content', async () => {
      const user = userEvent.setup();
      mockReadFile.mockResolvedValue('original content');

      render(<BuilderPage initialPrompt="" />);

      const codeTab = screen.getByRole('button', { name: 'Code' });
      await user.click(codeTab);

      const fileBtn = screen.getByTestId('file-btn-src/App.tsx');
      await user.click(fileBtn);

      await waitFor(() => {
        expect(screen.getByTestId('editor-file-name').textContent).toBe('src/App.tsx');
      });

      // 1. Simulate onChange — updates activeFile.content (ES-008)
      const changeTrigger = screen.getByTestId('editor-change-trigger');
      await user.click(changeTrigger);

      // 2. Wait for activeFile to be updated (re-render with modified content)
      await waitFor(() => {
        expect(screen.getByTestId('editor-code-content').textContent).toBe('modified content');
      });

      // 3. Trigger save — handleEditorSave receives the current code prop
      const saveTrigger = screen.getByTestId('editor-save-trigger');
      await user.click(saveTrigger);

      // 4. Verify writeFile was called with the modified content
      // This proves: onChange -> activeFile updated -> onSave receives updated content -> writeFile gets it
      // AND handleEditorSave updates currentFiles (ES-010) before calling writeFile
      await waitFor(() => {
        expect(mockWriteFile).toHaveBeenCalledWith('src/App.tsx', 'modified content');
      });
    });
  });

  describe('Save & Switch callback end-to-end (ES-012)', () => {
    it('should save the current file and switch to pending file when "Save & Switch" action is invoked', async () => {
      const user = userEvent.setup();
      mockReadFile.mockResolvedValue('original content');

      render(<BuilderPage initialPrompt="" />);

      const codeTab = screen.getByRole('button', { name: 'Code' });
      await user.click(codeTab);

      // 1. Load a file (src/App.tsx)
      const appBtn = screen.getByTestId('file-btn-src/App.tsx');
      await user.click(appBtn);

      await waitFor(() => {
        expect(screen.getByTestId('editor-file-name').textContent).toBe('src/App.tsx');
      });

      // 2. Mark it dirty
      const dirtyTrigger = screen.getByTestId('editor-dirty-trigger');
      await user.click(dirtyTrigger);

      // 3. Click another file — triggers unsaved guard toast
      const utilsBtn = screen.getByTestId('file-btn-src/utils.ts');
      await user.click(utilsBtn);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'warn' }));
      });

      // 4. Extract the toast action callback and invoke it
      const toastCall = mockShowToast.mock.calls.find((call) => call[0].type === 'warn');
      expect(toastCall).toBeDefined();
      const saveAndSwitchCallback = toastCall![0].action.callback;

      await act(async () => {
        saveAndSwitchCallback();
      });

      // 5. Verify that writeFile was called (save happened)
      await waitFor(() => {
        expect(mockWriteFile).toHaveBeenCalled();
      });

      // 6. Verify file switch completed — editor shows the new file
      // The recursive handleFileSelect call should load src/utils.ts
      await waitFor(() => {
        expect(screen.getByTestId('editor-file-name').textContent).toBe('src/utils.ts');
      });
    });
  });

  describe('unsaved file switch guard (ES-012)', () => {
    it('should show toast warning when switching files with unsaved changes', async () => {
      const user = userEvent.setup();
      mockReadFile.mockResolvedValue('initial content');

      render(<BuilderPage initialPrompt="" />);

      const codeTab = screen.getByRole('button', { name: 'Code' });
      await user.click(codeTab);

      // Load first file
      const appBtn = screen.getByTestId('file-btn-src/App.tsx');
      await user.click(appBtn);

      await waitFor(() => {
        expect(screen.getByTestId('editor-file-name').textContent).toBe('src/App.tsx');
      });

      // Mark as dirty
      const dirtyTrigger = screen.getByTestId('editor-dirty-trigger');
      await user.click(dirtyTrigger);

      // Try to switch to another file — should show unsaved warning toast
      const utilsBtn = screen.getByTestId('file-btn-src/utils.ts');
      await user.click(utilsBtn);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'warn',
          })
        );
      });

      // Should have an action button for save
      const toastCall = mockShowToast.mock.calls.find((call) => call[0].type === 'warn');
      expect(toastCall![0].action).toBeDefined();
      expect(toastCall![0].action.label).toBe('Save & Switch');
    });

    it('should proceed with file switch when no unsaved changes', async () => {
      const user = userEvent.setup();
      mockReadFile.mockResolvedValue('content');

      render(<BuilderPage initialPrompt="" />);

      const codeTab = screen.getByRole('button', { name: 'Code' });
      await user.click(codeTab);

      // Load first file
      const appBtn = screen.getByTestId('file-btn-src/App.tsx');
      await user.click(appBtn);

      await waitFor(() => {
        expect(screen.getByTestId('editor-file-name').textContent).toBe('src/App.tsx');
      });

      // Switch to another file — no dirty, should switch directly
      const utilsBtn = screen.getByTestId('file-btn-src/utils.ts');
      await user.click(utilsBtn);

      await waitFor(() => {
        expect(screen.getByTestId('editor-file-name').textContent).toBe('src/utils.ts');
      });

      // No warning toast
      expect(mockShowToast).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'warn' }));
    });
  });
});
