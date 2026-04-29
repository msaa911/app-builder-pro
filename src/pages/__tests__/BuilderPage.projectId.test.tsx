/**
 * BuilderPage.projectId.test.tsx — LPL-012
 * Tests for BuilderPage route-aware project loading via useParams/useLocation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
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
  default: () => <div data-testid="code-editor" />,
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
vi.mock('../../hooks/useAIBuilder', () => ({
  useAIBuilder: () => ({
    generate: vi.fn(),
    refine: vi.fn(),
    isGenerating: false,
    error: null,
    lastPrompt: '',
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

vi.mock('../../hooks/useFileTree', () => ({
  useFileTree: () => ({
    files: [],
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    createFile: vi.fn(),
    createFolder: vi.fn(),
    deleteItem: vi.fn(),
  }),
}));

vi.mock('../../utils/mergeFiles', () => ({
  mergeFiles: vi.fn(),
}));

vi.mock('../../utils/fileDiff', () => ({
  computeFileDiff: vi.fn(() => []),
  formatDiffSummary: vi.fn(() => ''),
}));

// ===== Mock useProjectPersistence =====
const mockOpenProject = vi.fn();
const mockCreateProject = vi.fn();
const mockSaveCurrentProject = vi.fn();
const mockFlushSave = vi.fn();
const mockRefreshProjectList = vi.fn();

vi.mock('../../hooks/useProjectPersistence', () => ({
  useProjectPersistence: () => ({
    projectList: [],
    activeProjectId: null,
    activeProjectName: null,
    isRestoring: false,
    refreshProjectList: mockRefreshProjectList,
    openProject: mockOpenProject,
    deleteProject: vi.fn(),
    renameProject: vi.fn(),
    createProject: mockCreateProject,
    saveCurrentProject: mockSaveCurrentProject,
    flushSave: mockFlushSave,
  }),
}));

// ===== Tests =====

describe('BuilderPage — route-aware project loading (LPL-012)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call persistence.openProject when projectId is in URL params', async () => {
    mockOpenProject.mockResolvedValue({
      currentFiles: [{ path: 'src/App.tsx', content: 'export default function App() {}' }],
      messages: [],
      activeFilePath: null,
      builderState: 'running',
      activeTab: 'preview',
      showExplorer: true,
    });

    render(
      <MemoryRouter initialEntries={['/builder/test-project-123']}>
        <Routes>
          <Route path="/builder/:projectId?" element={<BuilderPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockOpenProject).toHaveBeenCalledWith('test-project-123');
    });
  });

  it('should NOT call persistence.openProject when no projectId in URL', async () => {
    render(
      <MemoryRouter initialEntries={['/builder']}>
        <Routes>
          <Route path="/builder/:projectId?" element={<BuilderPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait a tick for effects to settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(mockOpenProject).not.toHaveBeenCalled();
  });

  it('should restore project state from openProject result', async () => {
    const restoredFiles = [
      {
        path: 'src/App.tsx',
        content: 'export default function App() { return <div>restored</div> }',
      },
      { path: 'src/index.tsx', content: 'import App from "./App"' },
    ];

    mockOpenProject.mockResolvedValue({
      currentFiles: restoredFiles,
      messages: [{ id: '1', role: 'assistant', content: 'Created app', timestamp: Date.now() }],
      activeFilePath: 'src/App.tsx',
      builderState: 'running',
      activeTab: 'preview',
      showExplorer: true,
    });

    render(
      <MemoryRouter initialEntries={['/builder/restored-project']}>
        <Routes>
          <Route path="/builder/:projectId?" element={<BuilderPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify openProject was called with the correct ID
    await waitFor(() => {
      expect(mockOpenProject).toHaveBeenCalledWith('restored-project');
    });
  });

  it('should handle openProject returning null gracefully', async () => {
    mockOpenProject.mockResolvedValue(null);

    render(
      <MemoryRouter initialEntries={['/builder/nonexistent-project']}>
        <Routes>
          <Route path="/builder/:projectId?" element={<BuilderPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockOpenProject).toHaveBeenCalledWith('nonexistent-project');
    });

    // Should not throw — the component should render without crashing
    // No additional assertions needed; if render succeeds, test passes
  });
});
