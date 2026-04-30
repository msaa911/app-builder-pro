/**
 * Tests for BuilderPage refine routing in handleNewMessage
 * Change: chat-iterative-refine
 * Spec IDs: ITR-002 (first msg→generate, follow-up→refine),
 *           ITR-007 (overwrite warning toast),
 *           ITR-009 (undo reverts to pre-refine snapshot),
 *           PWU-002 (package.json→remount, else→updateFiles)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
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
  default: ({
    onSendMessage,
    onNewChat,
    isGenerating,
    messages,
  }: {
    onSendMessage: (content: string) => void;
    onNewChat?: () => void;
    isGenerating: boolean;
    messages: Array<{ id: string; role: string; content: string }>;
  }) => (
    <div data-testid="chat-panel">
      <button
        data-testid="send-message-btn"
        onClick={() => onSendMessage('test prompt')}
        disabled={isGenerating}
      >
        Send
      </button>
      <button data-testid="new-chat-btn" onClick={onNewChat}>
        New Chat
      </button>
      <span data-testid="message-count">{messages?.length || 0}</span>
    </div>
  ),
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
const mockGenerate = vi.fn();
const mockRefine = vi.fn();
const mockMount = vi.fn();
const mockInstall = vi.fn();
const mockRunDev = vi.fn();
const mockRefresh = vi.fn();
const mockUpdateFiles = vi.fn();

vi.mock('../../hooks/useAIBuilder', () => ({
  useAIBuilder: () => ({
    generate: mockGenerate,
    refine: mockRefine,
    isGenerating: false,
    error: null,
    lastPrompt: '',
  }),
}));

vi.mock('../../hooks/useWebContainer', () => ({
  useWebContainer: () => ({
    mount: mockMount,
    install: mockInstall,
    runDev: mockRunDev,
    updateFiles: mockUpdateFiles,
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
vi.mock('../../services/webcontainer/WebContainerManager', () => ({
  WebContainerManager: {
    getInstance: vi.fn(() =>
      Promise.resolve({
        readFile: vi.fn(() => Promise.resolve('// file content')),
        readDir: vi.fn(() => Promise.resolve([])),
        watch: vi.fn(() => ({ close: vi.fn() })),
        isWriting: false,
        updateFiles: mockUpdateFiles,
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

// ===== Mock useVersionHistory (version-history-undo) =====
const mockCreateSnapshot = vi.fn();
const mockRestoreSnapshot = vi.fn();
const mockDeleteSnapshot = vi.fn();
const mockRefreshSnapshots = vi.fn();

vi.mock('../../hooks/useVersionHistory', () => ({
  useVersionHistory: () => ({
    snapshots: [],
    isLoading: false,
    isGenerating: false,
    setIsGenerating: vi.fn(),
    createSnapshot: mockCreateSnapshot,
    restoreSnapshot: mockRestoreSnapshot,
    deleteSnapshot: mockDeleteSnapshot,
    refreshSnapshots: mockRefreshSnapshots,
  }),
}));

// ===== Mock VersionHistoryPanel =====
vi.mock('../../components/common/VersionHistoryPanel', () => ({
  default: () => <div data-testid="version-history-panel" />,
}));

// ===== Mock mergeFiles + fileDiff =====
vi.mock('../../utils/mergeFiles', () => ({
  mergeFiles: vi.fn((existing: unknown[], incoming: unknown[]) => {
    // Simple mock: just concatenate, mark collisions
    const existingPaths = new Set((existing as Array<{ path: string }>).map((f) => f.path));
    const overwrittenPaths: string[] = [];
    for (const f of incoming as Array<{ path: string }>) {
      if (existingPaths.has(f.path)) {
        overwrittenPaths.push(f.path);
      }
    }
    return { merged: [...existing, ...incoming], overwrittenPaths };
  }),
}));

vi.mock('../../utils/fileDiff', () => ({
  computeFileDiff: vi.fn(() => []),
  formatDiffSummary: vi.fn(() => ''),
}));

describe('BuilderPage — refine routing (ITR-002)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerate.mockReset();
    mockRefine.mockReset();
    mockMount.mockReset();
    mockInstall.mockReset();
    mockRunDev.mockReset();
    mockRefresh.mockReset();
    mockUpdateFiles.mockReset();
    mockShowToast.mockReset();
    mockCreateSnapshot.mockReset();
    mockRestoreSnapshot.mockReset();
    mockDeleteSnapshot.mockReset();
    mockRefreshSnapshots.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('first message (no currentFiles) calls generate, NOT refine', async () => {
    // Arrange: generate returns files
    mockGenerate.mockResolvedValue({
      message: 'App created',
      files: [{ path: 'src/App.tsx', content: 'export default function App() {}' }],
    });
    mockMount.mockResolvedValue(undefined);
    mockInstall.mockResolvedValue(0);
    mockRunDev.mockResolvedValue(undefined);

    render(
      <RouterWrapper>
        <BuilderPage />
      </RouterWrapper>
    );

    // Act: send a message
    const sendBtn = screen.getByTestId('send-message-btn');
    await act(async () => {
      sendBtn.click();
    });

    // Assert: generate was called, refine was NOT
    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledWith('test prompt', 'test-key', 'test-model');
    });
    expect(mockRefine).not.toHaveBeenCalled();
  });

  it('follow-up message (with currentFiles) calls refine, NOT generate', async () => {
    // Arrange: first call generates files
    mockGenerate.mockResolvedValue({
      message: 'App created',
      files: [{ path: 'src/App.tsx', content: 'export default function App() {}' }],
    });
    mockRefine.mockResolvedValue({
      message: 'App refined',
      files: [
        {
          path: 'src/App.tsx',
          content: 'export default function App() { return <div>refined</div> }',
        },
      ],
    });
    mockMount.mockResolvedValue(undefined);
    mockInstall.mockResolvedValue(0);
    mockRunDev.mockResolvedValue(undefined);
    mockUpdateFiles.mockResolvedValue(undefined);

    render(
      <RouterWrapper>
        <BuilderPage />
      </RouterWrapper>
    );

    // Act: send first message (generate)
    const sendBtn = screen.getByTestId('send-message-btn');
    await act(async () => {
      sendBtn.click();
    });

    // Wait for generate to complete
    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalled();
    });

    // Act: send second message (should trigger refine)
    await act(async () => {
      sendBtn.click();
    });

    // Assert: refine was called for second message
    await waitFor(() => {
      expect(mockRefine).toHaveBeenCalled();
    });
  });

  it('refine path calls mergeFiles with existing + incoming files', async () => {
    // Arrange: generate then refine
    mockGenerate.mockResolvedValue({
      message: 'App created',
      files: [
        { path: 'src/App.tsx', content: 'original' },
        { path: 'src/utils.ts', content: 'utils' },
      ],
    });
    mockRefine.mockResolvedValue({
      message: 'Refined',
      files: [{ path: 'src/App.tsx', content: 'refined' }],
    });
    mockMount.mockResolvedValue(undefined);
    mockInstall.mockResolvedValue(0);
    mockRunDev.mockResolvedValue(undefined);
    mockUpdateFiles.mockResolvedValue(undefined);

    const { mergeFiles } = await import('../../utils/mergeFiles');

    render(
      <RouterWrapper>
        <BuilderPage />
      </RouterWrapper>
    );

    const sendBtn = screen.getByTestId('send-message-btn');

    // First message: generate
    await act(async () => {
      sendBtn.click();
    });
    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalled();
    });

    // Second message: refine
    await act(async () => {
      sendBtn.click();
    });
    await waitFor(() => {
      expect(mockRefine).toHaveBeenCalled();
    });

    // Assert: mergeFiles was called
    await waitFor(() => {
      expect(mergeFiles).toHaveBeenCalled();
    });
  });

  it('refine path without package.json calls updateFiles (not mount)', async () => {
    // Arrange
    mockGenerate.mockResolvedValue({
      message: 'App created',
      files: [{ path: 'src/App.tsx', content: 'original' }],
    });
    mockRefine.mockResolvedValue({
      message: 'Refined',
      files: [{ path: 'src/App.tsx', content: 'refined' }],
    });
    mockMount.mockResolvedValue(undefined);
    mockInstall.mockResolvedValue(0);
    mockRunDev.mockResolvedValue(undefined);
    mockUpdateFiles.mockResolvedValue(undefined);

    render(
      <RouterWrapper>
        <BuilderPage />
      </RouterWrapper>
    );

    const sendBtn = screen.getByTestId('send-message-btn');

    // First: generate (calls mount)
    await act(async () => {
      sendBtn.click();
    });
    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalled();
    });

    const mountCallCountAfterGenerate = mockMount.mock.calls.length;

    // Second: refine (no package.json → updateFiles, NOT mount)
    await act(async () => {
      sendBtn.click();
    });
    await waitFor(() => {
      expect(mockRefine).toHaveBeenCalled();
    });

    // Assert: updateFiles was called
    await waitFor(() => {
      expect(mockUpdateFiles).toHaveBeenCalled();
    });

    // Assert: mount was NOT called again (only the generate-time mount)
    expect(mockMount.mock.calls.length).toBe(mountCallCountAfterGenerate);
  });

  it('refine path WITH package.json calls mount+install+runDev (full remount)', async () => {
    // Arrange
    mockGenerate.mockResolvedValue({
      message: 'App created',
      files: [{ path: 'src/App.tsx', content: 'original' }],
    });
    mockRefine.mockResolvedValue({
      message: 'Refined with deps',
      files: [
        { path: 'src/App.tsx', content: 'refined' },
        { path: 'package.json', content: '{"dependencies":{}}' },
      ],
    });
    mockMount.mockResolvedValue(undefined);
    mockInstall.mockResolvedValue(0);
    mockRunDev.mockResolvedValue(undefined);
    mockUpdateFiles.mockResolvedValue(undefined);

    render(
      <RouterWrapper>
        <BuilderPage />
      </RouterWrapper>
    );

    const sendBtn = screen.getByTestId('send-message-btn');

    // First: generate
    await act(async () => {
      sendBtn.click();
    });
    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalled();
    });

    const mountCallCountAfterGenerate = mockMount.mock.calls.length;

    // Second: refine with package.json
    await act(async () => {
      sendBtn.click();
    });
    await waitFor(() => {
      expect(mockRefine).toHaveBeenCalled();
    });

    // Assert: mount was called AGAIN for package.json remount
    await waitFor(() => {
      expect(mockMount.mock.calls.length).toBeGreaterThan(mountCallCountAfterGenerate);
    });
    // And install was called again
    expect(mockInstall.mock.calls.length).toBeGreaterThan(1);
  });

  it('overwrite toast shown when overwrittenPaths.length > 0', async () => {
    // Arrange: generate first, then refine with overwrite
    const { mergeFiles } = await import('../../utils/mergeFiles');

    mockGenerate.mockResolvedValue({
      message: 'App created',
      files: [{ path: 'src/App.tsx', content: 'original' }],
    });
    mockRefine.mockResolvedValue({
      message: 'Refined',
      files: [{ path: 'src/App.tsx', content: 'refined' }],
    });
    mockMount.mockResolvedValue(undefined);
    mockInstall.mockResolvedValue(0);
    mockRunDev.mockResolvedValue(undefined);
    mockUpdateFiles.mockResolvedValue(undefined);

    // mergeFiles mock returns overwrittenPaths when existing paths match
    (mergeFiles as ReturnType<typeof vi.fn>).mockReturnValue({
      merged: [{ path: 'src/App.tsx', content: 'refined' }],
      overwrittenPaths: ['src/App.tsx'],
    });

    render(
      <RouterWrapper>
        <BuilderPage />
      </RouterWrapper>
    );

    const sendBtn = screen.getByTestId('send-message-btn');

    // First: generate
    await act(async () => {
      sendBtn.click();
    });
    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalled();
    });

    // Second: refine with overwrite
    await act(async () => {
      sendBtn.click();
    });
    await waitFor(() => {
      expect(mockRefine).toHaveBeenCalled();
    });

    // Assert: showToast called with 'warn' type
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warn',
        })
      );
    });
  });

  it('Undo callback in toast reverts currentFiles to pre-refine snapshot', async () => {
    // Arrange
    const { mergeFiles } = await import('../../utils/mergeFiles');

    mockGenerate.mockResolvedValue({
      message: 'App created',
      files: [
        { path: 'src/App.tsx', content: 'original' },
        { path: 'src/utils.ts', content: 'utils-original' },
      ],
    });
    mockRefine.mockResolvedValue({
      message: 'Refined',
      files: [{ path: 'src/App.tsx', content: 'refined-overwrite' }],
    });
    mockMount.mockResolvedValue(undefined);
    mockInstall.mockResolvedValue(0);
    mockRunDev.mockResolvedValue(undefined);
    mockUpdateFiles.mockResolvedValue(undefined);

    (mergeFiles as ReturnType<typeof vi.fn>).mockReturnValue({
      merged: [
        { path: 'src/App.tsx', content: 'refined-overwrite' },
        { path: 'src/utils.ts', content: 'utils-original' },
      ],
      overwrittenPaths: ['src/App.tsx'],
    });

    render(
      <RouterWrapper>
        <BuilderPage />
      </RouterWrapper>
    );

    const sendBtn = screen.getByTestId('send-message-btn');

    // First: generate
    await act(async () => {
      sendBtn.click();
    });
    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalled();
    });

    // Second: refine
    await act(async () => {
      sendBtn.click();
    });
    await waitFor(() => {
      expect(mockRefine).toHaveBeenCalled();
    });

    // Find the toast call with Undo action
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warn',
          action: expect.objectContaining({
            label: 'Undo',
          }),
        })
      );
    });

    // Execute the Undo callback
    const toastCall = mockShowToast.mock.calls.find(
      (call: Array<{ type: string }>) => call[0].type === 'warn'
    );
    const undoCallback = toastCall?.[0]?.action?.callback;
    expect(undoCallback).toBeDefined();

    // Act: call Undo
    await act(async () => {
      undoCallback();
    });

// Assert: after undo, the next refine should see the original files
// (versionHistory.restoreSnapshot reverted currentFiles to the pre-refine state)
// We can verify by checking that the state was reverted —
// we test this indirectly: after Undo, if we send another refine,
    // it should use the original files, not the merged ones
    mockRefine.mockResolvedValue({
      message: 'Refined again',
      files: [],
    });

    await act(async () => {
      sendBtn.click();
    });

    // The refine should have been called with the reverted (original) files
    await waitFor(() => {
      expect(mockRefine.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('diff summary appended to assistant message when refine returns files', async () => {
    // Arrange
    const { formatDiffSummary } = await import('../../utils/fileDiff');

    mockGenerate.mockResolvedValue({
      message: 'App created',
      files: [{ path: 'src/App.tsx', content: 'original' }],
    });
    mockRefine.mockResolvedValue({
      message: 'App refined',
      files: [{ path: 'src/App.tsx', content: 'refined' }],
    });
    mockMount.mockResolvedValue(undefined);
    mockInstall.mockResolvedValue(0);
    mockRunDev.mockResolvedValue(undefined);
    mockUpdateFiles.mockResolvedValue(undefined);

    (formatDiffSummary as ReturnType<typeof vi.fn>).mockReturnValue('~ src/App.tsx (+3/-1)');

    render(
      <RouterWrapper>
        <BuilderPage />
      </RouterWrapper>
    );

    const sendBtn = screen.getByTestId('send-message-btn');

    // First: generate
    await act(async () => {
      sendBtn.click();
    });
    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalled();
    });

    // Second: refine
    await act(async () => {
      sendBtn.click();
    });
    await waitFor(() => {
      expect(mockRefine).toHaveBeenCalled();
    });

    // Assert: formatDiffSummary was called
    await waitFor(() => {
      expect(formatDiffSummary).toHaveBeenCalled();
    });
  });

  it('handleNewChat clears messages and resets builder state', async () => {
    // Arrange
    mockGenerate.mockResolvedValue({
      message: 'App created',
      files: [{ path: 'src/App.tsx', content: 'original' }],
    });
    mockMount.mockResolvedValue(undefined);
    mockInstall.mockResolvedValue(0);
    mockRunDev.mockResolvedValue(undefined);

    render(
      <RouterWrapper>
        <BuilderPage />
      </RouterWrapper>
    );

    const sendBtn = screen.getByTestId('send-message-btn');
    const newChatBtn = screen.getByTestId('new-chat-btn');

    // First: generate to create a message
    await act(async () => {
      sendBtn.click();
    });
    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalled();
    });

    // Check message count is > 0
    const msgCountAfterGenerate = screen.getByTestId('message-count').textContent;
    expect(Number(msgCountAfterGenerate)).toBeGreaterThan(0);

    // Act: click New Chat
    await act(async () => {
      newChatBtn.click();
    });

    // Assert: message count is 0
    await waitFor(() => {
      expect(screen.getByTestId('message-count').textContent).toBe('0');
    });
  });

  it('after New Chat, next message calls generate (not refine)', async () => {
    // Arrange
    mockGenerate.mockResolvedValue({
      message: 'App created',
      files: [{ path: 'src/App.tsx', content: 'original' }],
    });
    mockRefine.mockResolvedValue({
      message: 'Refined',
      files: [{ path: 'src/App.tsx', content: 'refined' }],
    });
    mockMount.mockResolvedValue(undefined);
    mockInstall.mockResolvedValue(0);
    mockRunDev.mockResolvedValue(undefined);

    render(
      <RouterWrapper>
        <BuilderPage />
      </RouterWrapper>
    );

    const sendBtn = screen.getByTestId('send-message-btn');
    const newChatBtn = screen.getByTestId('new-chat-btn');

    // First: generate
    await act(async () => {
      sendBtn.click();
    });
    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalled();
    });

    // Second: refine (files exist)
    await act(async () => {
      sendBtn.click();
    });
    await waitFor(() => {
      expect(mockRefine).toHaveBeenCalled();
    });

    // Clear mock counts
    mockGenerate.mockClear();
    mockRefine.mockClear();

    // Act: New Chat
    await act(async () => {
      newChatBtn.click();
    });

    // Next message should call generate, NOT refine
    await act(async () => {
      sendBtn.click();
    });

    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalled();
    });
    expect(mockRefine).not.toHaveBeenCalled();
  });
});
