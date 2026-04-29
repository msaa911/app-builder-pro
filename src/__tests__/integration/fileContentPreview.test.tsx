/**
 * Integration test for file-content-preview change
 * Full flow: FileExplorer click → handleFileSelect → WCM.readFile → CodeEditor shows content
 * Spec IDs: FCL-001 (async file content loading), CE-001 (controlled editor)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { RouterWrapper } from '../../test-utils/RouterWrapper';
import BuilderPage from '../../pages/BuilderPage';

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

// CodeEditor mock — captures code prop (CE-001 controlled mode)
vi.mock('../../components/editor/CodeEditor', () => ({
  default: ({ code, fileName }: { code: string; fileName: string }) => (
    <div data-testid="code-editor">
      <span data-testid="editor-file-name">{fileName}</span>
      <pre data-testid="editor-code-content">{code}</pre>
    </div>
  ),
}));

// FileExplorer mock — calls onFileSelect(path) (path only, no content)
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
vi.mock('../../hooks/useAIBuilder', () => ({
  useAIBuilder: () => ({
    generate: vi.fn(),
  }),
}));

vi.mock('../../hooks/useWebContainer', () => ({
  useWebContainer: () => ({
    mount: vi.fn(),
    install: vi.fn(),
    runDev: vi.fn(),
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
  { path: 'src/utils.ts' },
  { path: 'src/logo.png' },
];

vi.mock('../../hooks/useFileTree', () => ({
  useFileTree: () => ({
    files: mockFileTreeFiles,
    isLoading: false,
    error: null,
    refresh: vi.fn().mockResolvedValue(undefined),
    createFile: vi.fn(),
    createFolder: vi.fn(),
    deleteItem: vi.fn(),
  }),
}));

describe('file-content-preview integration (FCL-001, CE-001)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockImplementation((path: string) => {
      const contentMap: Record<string, string> = {
        'src/App.tsx': 'export default function App() { return <div>Hello</div> }',
        'src/utils.ts': 'export const id = (x: any) => x;',
        'src/logo.png': '[Binary file — preview not available]',
      };
      return Promise.resolve(contentMap[path] ?? '');
    });
  });

  it('full flow: FileExplorer click → handleFileSelect → readFile → CodeEditor shows content', async () => {
    const user = userEvent.setup();

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

    // Verify WCM.readFile was called with the correct path
    await waitFor(() => {
      expect(mockReadFile).toHaveBeenCalledWith('src/App.tsx');
    });

    // Verify CodeEditor displays the content from WCM.readFile
    await waitFor(() => {
      expect(screen.getByTestId('editor-code-content').textContent).toBe(
        'export default function App() { return <div>Hello</div> }'
      );
    });

    // Verify file name is shown
    expect(screen.getByTestId('editor-file-name').textContent).toBe('src/App.tsx');
  });

  it('switching files updates CodeEditor content (CE-001 controlled mode)', async () => {
    const user = userEvent.setup();

    render(
      <RouterWrapper>
        <BuilderPage />
      </RouterWrapper>
    );

    // Switch to Code tab
    const codeTab = screen.getByRole('button', { name: 'Code' });
    await user.click(codeTab);

    // Click first file
    const appBtn = screen.getByTestId('file-btn-src/App.tsx');
    await user.click(appBtn);

    await waitFor(() => {
      expect(screen.getByTestId('editor-code-content').textContent).toBe(
        'export default function App() { return <div>Hello</div> }'
      );
    });

    // Click second file
    const utilsBtn = screen.getByTestId('file-btn-src/utils.ts');
    await user.click(utilsBtn);

    await waitFor(() => {
      expect(screen.getByTestId('editor-code-content').textContent).toBe(
        'export const id = (x: any) => x;'
      );
    });

    // File name should also update
    expect(screen.getByTestId('editor-file-name').textContent).toBe('src/utils.ts');
  });

  it('clicking a binary file shows placeholder without calling readFile', async () => {
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
    const pngBtn = screen.getByTestId('file-btn-src/logo.png');
    await user.click(pngBtn);

    // WCM.readFile should NOT be called for binary files
    expect(mockReadFile).not.toHaveBeenCalled();

    // The editor should show the binary placeholder
    await waitFor(() => {
      expect(screen.getByTestId('editor-code-content').textContent).toBe(
        '[Binary file — preview not available]'
      );
    });
  });
});
