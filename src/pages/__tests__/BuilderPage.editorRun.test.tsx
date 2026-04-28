/**
 * Tests for editor run flow in BuilderPage
 * Change: editor-run-to-webcontainer
 * Spec IDs: ER-001 (onRun callback), ER-002 (isRunning state),
 * ER-005 (hasCrashed state), ER-009 (onDevExit), ER-010 (isDevRunning)
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

// Mock CodeEditor — captures onRun, isRunning, hasCrashed props
let capturedEditorOnRun: (() => void) | null = null;
let capturedEditorIsRunning: boolean | null = null;
let capturedEditorHasCrashed: boolean | null = null;

vi.mock('../../components/editor/CodeEditor', () => ({
  default: ({
    onRun,
    isRunning,
    hasCrashed,
  }: {
    onRun?: () => void;
    isRunning?: boolean;
    hasCrashed?: boolean;
  }) => {
    capturedEditorOnRun = onRun || null;
    capturedEditorIsRunning = isRunning ?? null;
    capturedEditorHasCrashed = hasCrashed ?? null;
    return (
      <div data-testid="code-editor">
        <span data-testid="editor-is-running">{isRunning ? 'true' : 'false'}</span>
        <span data-testid="editor-has-crashed">{hasCrashed ? 'true' : 'false'}</span>
        <button data-testid="editor-run-trigger" onClick={onRun} />
      </div>
    );
  },
}));

vi.mock('../../components/editor/FileExplorer', () => ({
  default: () => <div data-testid="file-explorer" />,
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
const mockUpdateFiles = vi.fn();
const mockRestartDev = vi.fn();
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
    updateFiles: mockUpdateFiles,
    restartDev: mockRestartDev,
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
vi.mock('../../hooks/useFileTree', () => ({
  useFileTree: () => ({
    files: [],
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

describe('BuilderPage — Editor Run Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockResolvedValue('// file content');
    mockWriteFile.mockResolvedValue(undefined);
    mockIsWriting = false;
    capturedEditorOnRun = null;
    capturedEditorIsRunning = null;
    capturedEditorHasCrashed = null;
    mockRestartDev.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CodeEditor receives onRun prop (ER-001)', () => {
    it('should pass onRun callback to CodeEditor', async () => {
      // When
      render(<BuilderPage initialPrompt="" />);

      // Switch to Code tab (default is preview — CodeEditor only renders on code tab)
      const codeTab = screen.getByRole('button', { name: 'Code' });
      await userEvent.click(codeTab);

      // Then — CodeEditor receives an onRun prop
      await waitFor(() => {
        expect(capturedEditorOnRun).not.toBeNull();
        expect(typeof capturedEditorOnRun).toBe('function');
      });
    });
  });

  describe('onRun calls restartDev (ER-001, ER-008)', () => {
    it('should call restartDev when onRun is triggered', async () => {
      // Given
      render(<BuilderPage initialPrompt="" />);

      // Switch to Code tab so CodeEditor mounts and captures props
      const codeTab = screen.getByRole('button', { name: 'Code' });
      await userEvent.click(codeTab);

      // Wait for CodeEditor to mount
      await waitFor(() => {
        expect(capturedEditorOnRun).not.toBeNull();
      });

      // When — trigger onRun
      await act(async () => {
        capturedEditorOnRun?.();
      });

      // Then — restartDev was called
      expect(mockRestartDev).toHaveBeenCalled();
    });
  });

  describe('isRunning passed to CodeEditor (ER-002)', () => {
    it('should pass isRunning=false to CodeEditor initially', async () => {
      // When
      render(<BuilderPage initialPrompt="" />);

      // Switch to Code tab so CodeEditor mounts and captures props
      const codeTab = screen.getByRole('button', { name: 'Code' });
      await userEvent.click(codeTab);

      // Then
      await waitFor(() => {
        expect(capturedEditorIsRunning).toBe(false);
      });
    });
  });

  describe('hasCrashed and toast on dev exit (ER-005, ER-006)', () => {
    it('should show error toast when dev process exits with code !== 0', async () => {
      // Given — set up WCM mock with onDevExit callback capture
      let capturedOnDevExit: ((code: number) => void) | null = null;

      const { WebContainerManager: WCM } =
        await import('../../services/webcontainer/WebContainerManager');

      // Override getInstance to capture onDevExit setter
      const originalGetInstance = WCM.getInstance;
      const mockWcmInstance = {
        readFile: mockReadFile,
        readDir: vi.fn(() => Promise.resolve([])),
        watch: vi.fn(() => ({ close: vi.fn() })),
        writeFile: mockWriteFile,
        get isWriting() {
          return mockIsWriting;
        },
        set onDevExit(cb: (code: number) => void) {
          capturedOnDevExit = cb;
        },
      };
      (WCM.getInstance as ReturnType<typeof vi.fn>).mockResolvedValue(mockWcmInstance);

      render(<BuilderPage initialPrompt="" />);

      // Wait for the useEffect to wire up onDevExit
      await waitFor(() => {
        expect(capturedOnDevExit).not.toBeNull();
      });

      // When — dev process exits with error code
      await act(async () => {
        capturedOnDevExit!(1);
      });

      // Then — toast shown with error message
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('unexpectedly'),
          type: 'error',
        })
      );
    });

    it('should NOT show toast when dev process exits with code 0', async () => {
      // Given
      let capturedOnDevExit: ((code: number) => void) | null = null;

      const { WebContainerManager: WCM } =
        await import('../../services/webcontainer/WebContainerManager');

      const mockWcmInstance = {
        readFile: mockReadFile,
        readDir: vi.fn(() => Promise.resolve([])),
        watch: vi.fn(() => ({ close: vi.fn() })),
        writeFile: mockWriteFile,
        get isWriting() {
          return mockIsWriting;
        },
        set onDevExit(cb: (code: number) => void) {
          capturedOnDevExit = cb;
        },
      };
      (WCM.getInstance as ReturnType<typeof vi.fn>).mockResolvedValue(mockWcmInstance);

      render(<BuilderPage initialPrompt="" />);

      await waitFor(() => {
        expect(capturedOnDevExit).not.toBeNull();
      });

      // When — dev process exits cleanly
      await act(async () => {
        capturedOnDevExit!(0);
      });

      // Then — no error toast
      expect(mockShowToast).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    });
  });
});
