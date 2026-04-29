/**
 * Tests for handleFileSelect in BuilderPage
 * Change: file-content-preview
 * Spec IDs: FCL-001 (async file content loading), FCL-004 (race guard)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { RouterWrapper } from '../../test-utils/RouterWrapper';
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

vi.mock('../../components/editor/CodeEditor', () => ({
  default: ({ code, fileName }: { code: string; fileName: string }) => (
    <div data-testid="code-editor">
      <span data-testid="editor-file-name">{fileName}</span>
      <pre data-testid="editor-code-content">{code}</pre>
    </div>
  ),
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
const mockRefresh = vi.fn();

vi.mock('../../hooks/useAIBuilder', () => ({
  useAIBuilder: () => ({
    generate: vi.fn(),
  }),
}));

vi.mock('../../hooks/useWebContainer', () => ({
  useWebContainer: () => ({
    mount: mockMount,
    install: mockInstall,
    runDev: mockRunDev,
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
const mockReadFile = vi.fn();

vi.mock('../../services/webcontainer/WebContainerManager', () => ({
  WebContainerManager: {
    getInstance: vi.fn(() =>
      Promise.resolve({
        readFile: mockReadFile,
        readDir: vi.fn(() => Promise.resolve([])),
        watch: vi.fn(() => ({ close: vi.fn() })),
        isWriting: false,
      })
    ),
  },
  PROTECTED_PATHS: ['/package.json', '/vite.config.ts', '/index.html'],
}));

// ===== Mock useFileTree =====
const mockFileTreeFiles = [
  { path: 'src/App.tsx' },
  { path: 'src/logo.png' },
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

describe('BuilderPage — handleFileSelect (FCL-001, FCL-004)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockReset();
    mockReadFile.mockResolvedValue('// file content from WCM');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clicking a text file triggers WCM.readFile and sets activeFile with real content', async () => {
    const user = userEvent.setup();
    mockReadFile.mockResolvedValue('export default function App() { return <div /> }');

    render(
      <RouterWrapper>
        <BuilderPage />
      </RouterWrapper>
    );

    // Switch to Code tab to see the editor
    const codeTab = screen.getByRole('button', { name: 'Code' });
    await user.click(codeTab);

    // Click on a text file in the mocked FileExplorer
    const fileBtn = screen.getByTestId('file-btn-src/App.tsx');
    await user.click(fileBtn);

    // Wait for the async handleFileSelect to complete
    await waitFor(() => {
      expect(mockReadFile).toHaveBeenCalledWith('src/App.tsx');
    });

    // The editor should show the content from WCM.readFile
    await waitFor(() => {
      expect(screen.getByTestId('editor-code-content').textContent).toBe(
        'export default function App() { return <div /> }'
      );
    });
  });

  it('clicking a binary file sets activeFile with placeholder without calling WCM.readFile', async () => {
    const user = userEvent.setup();

    render(
      <RouterWrapper>
        <BuilderPage />
      </RouterWrapper>
    );

    // Switch to Code tab
    const codeTab = screen.getByRole('button', { name: 'Code' });
    await user.click(codeTab);

    // Click on a binary file (.png)
    const fileBtn = screen.getByTestId('file-btn-src/logo.png');
    await user.click(fileBtn);

    // WCM.readFile should NOT be called for binary files
    expect(mockReadFile).not.toHaveBeenCalled();

    // The editor should show the binary placeholder
    await waitFor(() => {
      expect(screen.getByTestId('editor-code-content').textContent).toBe(
        '[Binary file \u2014 preview not available]'
      );
    });
  });

  it('WCM.readFile rejection shows error toast and sets fallback content', async () => {
    const user = userEvent.setup();
    mockReadFile.mockRejectedValue(new Error('Read failed'));

    render(
      <RouterWrapper>
        <BuilderPage />
      </RouterWrapper>
    );

    // Switch to Code tab
    const codeTab = screen.getByRole('button', { name: 'Code' });
    await user.click(codeTab);

    // Click on a text file
    const fileBtn = screen.getByTestId('file-btn-src/App.tsx');
    await user.click(fileBtn);

    // Wait for the error handling
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Failed to load'),
          type: 'error',
        })
      );
    });

    // The editor should show fallback content
    await waitFor(() => {
      expect(screen.getByTestId('editor-code-content').textContent).toBe(
        '// Error loading file content'
      );
    });
  });

  it('rapid clicks only apply the last click (race guard discards stale response)', async () => {
    const user = userEvent.setup();

    // Make readFile slow for the first call, fast for the second
    let callCount = 0;
    mockReadFile.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First click — slow
        return new Promise((resolve) => setTimeout(() => resolve('SLOW CONTENT'), 100));
      }
      // Second click — fast
      return Promise.resolve('FAST CONTENT');
    });

    render(
      <RouterWrapper>
        <BuilderPage />
      </RouterWrapper>
    );

    // Switch to Code tab
    const codeTab = screen.getByRole('button', { name: 'Code' });
    await user.click(codeTab);

    // Rapid clicks: first click App.tsx, then immediately index.ts
    const appBtn = screen.getByTestId('file-btn-src/App.tsx');
    const indexBtn = screen.getByTestId('file-btn-src/index.ts');

    await user.click(appBtn);
    await user.click(indexBtn);

    // Wait for both reads to complete
    await waitFor(() => {
      // The last click's content should be shown, NOT the stale first click
      expect(screen.getByTestId('editor-code-content').textContent).toBe('FAST CONTENT');
    });

    // The file name should reflect the last clicked file
    expect(screen.getByTestId('editor-file-name').textContent).toBe('src/index.ts');
  });
});
