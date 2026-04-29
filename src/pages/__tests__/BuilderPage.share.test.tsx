/**
 * BuilderPage.share.test.tsx — topbar-share change
 * Integration tests: BuilderPage passes correct share props to TopBar
 * and handleShare clipboard logic works correctly
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, act, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import BuilderPage from '../BuilderPage';

// ===== Capture TopBar props =====
let capturedTopBarProps: Record<string, unknown> = {};
vi.mock('../../components/common/TopBar', () => ({
  default: (props: Record<string, unknown>) => {
    capturedTopBarProps = props;
    return <div data-testid="topbar-mock" />;
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

// ===== Mock useProjectPersistence with controllable activeProjectId =====
let mockActiveProjectId: string | null = null;

vi.mock('../../hooks/useProjectPersistence', () => ({
  useProjectPersistence: () => ({
    projectList: [],
    activeProjectId: mockActiveProjectId,
    activeProjectName: mockActiveProjectId ? 'Test Project' : null,
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

// ===== Clipboard mock =====
const mockWriteText = vi.fn(() => Promise.resolve());
Object.assign(navigator, {
  clipboard: { writeText: mockWriteText },
});

// ===== Tests =====
describe('BuilderPage — Share integration (topbar-share)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedTopBarProps = {};
    mockActiveProjectId = null;
  });

  it('should pass isShareDisabled=true when no active project', async () => {
    mockActiveProjectId = null;

    render(
      <MemoryRouter initialEntries={['/builder']}>
        <Routes>
          <Route path="/builder/:projectId?" element={<BuilderPage />} />
        </Routes>
      </MemoryRouter>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(capturedTopBarProps.isShareDisabled).toBe(true);
    expect(capturedTopBarProps.onShare).toBeDefined();
  });

  it('should pass isShareDisabled=false when active project exists', async () => {
    mockActiveProjectId = 'proj-abc-123';

    render(
      <MemoryRouter initialEntries={['/builder']}>
        <Routes>
          <Route path="/builder/:projectId?" element={<BuilderPage />} />
        </Routes>
      </MemoryRouter>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(capturedTopBarProps.isShareDisabled).toBe(false);
    expect(capturedTopBarProps.onShare).toBeDefined();
  });

  it('handleShare should copy project URL to clipboard and show success toast', async () => {
    mockActiveProjectId = 'proj-abc-123';
    // Override window.location.origin for deterministic URL
    const originalLocation = window.location;
    // Can't fully mock window.location in JSDOM, but we can test the clipboard call
    // The URL format is: {origin}/builder/{activeProjectId}

    render(
      <MemoryRouter initialEntries={['/builder']}>
        <Routes>
          <Route path="/builder/:projectId?" element={<BuilderPage />} />
        </Routes>
      </MemoryRouter>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    // Call the onShare callback that BuilderPage passed to TopBar
    const handleShare = capturedTopBarProps.onShare as () => void;
    expect(handleShare).toBeDefined();

    await act(async () => {
      handleShare();
    });

    // Clipboard should have been called with a URL containing the project ID
    expect(mockWriteText).toHaveBeenCalledTimes(1);
    const copiedUrl = (mockWriteText.mock.calls[0] as string[])[0];
    expect(copiedUrl).toContain('/builder/proj-abc-123');

    // Success toast
    expect(mockShowToast).toHaveBeenCalledWith({
      message: 'Link copied!',
      type: 'success',
    });
  });

  it('handleShare should show error toast when clipboard fails', async () => {
    mockActiveProjectId = 'proj-abc-123';
    mockWriteText.mockRejectedValueOnce(new Error('Clipboard denied'));

    render(
      <MemoryRouter initialEntries={['/builder']}>
        <Routes>
          <Route path="/builder/:projectId?" element={<BuilderPage />} />
        </Routes>
      </MemoryRouter>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    const handleShare = capturedTopBarProps.onShare as () => void;

    await act(async () => {
      handleShare();
    });

    // Error toast
    expect(mockShowToast).toHaveBeenCalledWith({
      message: 'Failed to copy link',
      type: 'error',
    });
  });

  it('handleShare should not call clipboard when no active project', async () => {
    mockActiveProjectId = null;

    render(
      <MemoryRouter initialEntries={['/builder']}>
        <Routes>
          <Route path="/builder/:projectId?" element={<BuilderPage />} />
        </Routes>
      </MemoryRouter>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    const handleShare = capturedTopBarProps.onShare as () => void;

    await act(async () => {
      handleShare();
    });

    expect(mockWriteText).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalled();
  });
});
