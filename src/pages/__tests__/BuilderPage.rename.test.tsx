/**
 * BuilderPage.rename.test.tsx — file-rename change
 * Integration tests: BuilderPage passes correct rename props to FileExplorer
 * and handleRenameItem updates activeFile path correctly
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { RouterWrapper } from '../../test-utils/RouterWrapper';
import BuilderPage from '../BuilderPage';

// ===== Capture FileExplorer props =====
let capturedFileExplorerProps: Record<string, unknown> = {};
vi.mock('../../components/editor/FileExplorer', () => ({
  default: (props: Record<string, unknown>) => {
    capturedFileExplorerProps = props;
    return <div data-testid="file-explorer-mock" />;
  },
}));

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

// ===== Mock TopBar =====
vi.mock('../../components/common/TopBar', () => ({
  default: () => <div data-testid="topbar-mock" />,
}));

// ===== Mock Child Components =====
vi.mock('../../components/chat/ChatPanel', () => ({
  default: () => <div data-testid="chat-panel" />,
}));

vi.mock('../../components/preview/PreviewPanel', () => ({
  default: () => <div data-testid="preview-panel" />,
}));

vi.mock('../../components/editor/CodeEditor', () => ({
  default: () => <div data-testid="code-editor" />,
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
    refine: vi.fn(),
    isGenerating: false,
    error: null,
    lastPrompt: '',
  }),
}));

const mockRenameItem = vi.fn(() => Promise.resolve());
vi.mock('../../hooks/useFileTree', () => ({
  useFileTree: () => ({
    files: [],
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    createFile: vi.fn(),
    createFolder: vi.fn(),
    deleteItem: vi.fn(),
    renameItem: mockRenameItem,
  }),
}));

vi.mock('../../hooks/useWebContainer', () => ({
  useWebContainer: () => ({
    mount: vi.fn(),
    install: vi.fn(),
    runDev: vi.fn(),
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

vi.mock('../../services/webcontainer/WebContainerManager', () => ({
  WebContainerManager: {
    getInstance: vi.fn(() =>
      Promise.resolve({
        readFile: vi.fn(() => Promise.resolve('// file content')),
        readDir: vi.fn(() => Promise.resolve([])),
        watch: vi.fn(() => ({ close: vi.fn() })),
        isWriting: false,
      })
    ),
  },
  PROTECTED_PATHS: ['/package.json', '/vite.config.ts', '/index.html'],
}));

vi.mock('../../utils/mergeFiles', () => ({
  mergeFiles: vi.fn(),
}));

vi.mock('../../utils/fileDiff', () => ({
  computeFileDiff: vi.fn(() => []),
  formatDiffSummary: vi.fn(() => ''),
}));

vi.mock('../../hooks/useProjectPersistence', () => ({
  useProjectPersistence: () => ({
    projectList: [],
    activeProjectId: null,
    activeProjectName: null,
    isRestoring: false,
    refreshProjectList: vi.fn(),
    openProject: vi.fn(),
    deleteProject: vi.fn(),
    renameProject: vi.fn(),
    createProject: vi.fn(),
    saveCurrentProject: vi.fn(),
    flushSave: vi.fn(),
  }),
}));

// ===== Helper: render BuilderPage and switch to Code tab =====
async function renderBuilderPageOnCodeTab() {
  const user = userEvent.setup();
  render(
    <RouterWrapper initialEntries={['/builder']}>
      <BuilderPage />
    </RouterWrapper>
  );

  // Wait for initial render
  await act(async () => {
    await new Promise((r) => setTimeout(r, 100));
  });

  // Switch to Code tab so FileExplorer renders
  const codeTab = screen.getByRole('button', { name: 'Code' });
  await user.click(codeTab);

  // Wait for FileExplorer mock to capture props
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });

  return user;
}

// ===== Tests =====
describe('BuilderPage — Rename integration (file-rename)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedFileExplorerProps = {};
  });

  it('should pass onRenameItem prop to FileExplorer', async () => {
    await renderBuilderPageOnCodeTab();

    expect(capturedFileExplorerProps.onRenameItem).toBeDefined();
    expect(typeof capturedFileExplorerProps.onRenameItem).toBe('function');
  });

  it('handleRenameItem should call fileTree.renameItem with constructed newPath', async () => {
    await renderBuilderPageOnCodeTab();

    const handleRenameItem = capturedFileExplorerProps.onRenameItem as (item: {
      path: string;
      newName: string;
    }) => void;

    await act(async () => {
      handleRenameItem({ path: 'src/utils.ts', newName: 'helpers.ts' });
    });

    expect(mockRenameItem).toHaveBeenCalledTimes(1);
    expect(mockRenameItem).toHaveBeenCalledWith('src/utils.ts', 'src/helpers.ts');
  });

  it('handleRenameItem should construct root-level path correctly', async () => {
    await renderBuilderPageOnCodeTab();

    const handleRenameItem = capturedFileExplorerProps.onRenameItem as (item: {
      path: string;
      newName: string;
    }) => void;

    await act(async () => {
      handleRenameItem({ path: 'README.md', newName: 'README.txt' });
    });

    expect(mockRenameItem).toHaveBeenCalledWith('README.md', 'README.txt');
  });

  it('handleRenameItem should show error toast when rename fails (FREN-009)', async () => {
    mockRenameItem.mockRejectedValueOnce(new Error('Cannot rename protected path'));

    await renderBuilderPageOnCodeTab();

    const handleRenameItem = capturedFileExplorerProps.onRenameItem as (item: {
      path: string;
      newName: string;
    }) => void;

    await act(async () => {
      handleRenameItem({ path: 'package.json', newName: 'pkg.json' });
    });

    expect(mockShowToast).toHaveBeenCalledWith({
      message: 'Cannot rename protected path',
      type: 'error',
    });
  });
});
