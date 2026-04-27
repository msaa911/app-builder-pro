/**
 * E2E Integration Tests: Chat Iterative Refine
 * Change: chat-iterative-refine
 * Tasks: 5.1–5.4
 *
 * Tests cross-layer flows from BuilderPage through hooks to services:
 * - 5.1: Full generate→refine flow with updateFiles (not mount)
 * - 5.2: Package.json in refine triggers mount+install+runDev
 * - 5.3: Undo reverts currentFiles to pre-refine snapshot
 * - 5.4: New Chat clears state, next message calls generateApp
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
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

// ===== Mock mergeFiles + fileDiff =====
vi.mock('../../utils/mergeFiles', () => ({
  mergeFiles: vi.fn((existing: unknown[], incoming: unknown[]) => {
    // Simple mock: concatenate, detect collisions by path
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

// ============================================================================
// E2E Integration Tests
// ============================================================================

describe('E2E: Chat Iterative Refine', () => {
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 5.1: Full refine flow — generate→refine→updateFiles (not mount again)
  // ---------------------------------------------------------------------------
  describe('5.1: Full refine flow (generate→refine→updateFiles)', () => {
    it('should call generate→mount on first message, then refine→updateFiles on second message', async () => {
      // Arrange
      mockGenerate.mockResolvedValue({
        message: 'App created',
        files: [
          { path: 'src/App.tsx', content: 'export default function App() {}' },
          { path: 'src/utils.ts', content: 'export const helper = () => {}' },
        ],
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

      render(<BuilderPage initialPrompt="" />);

      const sendBtn = screen.getByTestId('send-message-btn');

      // ===== STEP 1: First message → generate → mount =====
      await act(async () => {
        sendBtn.click();
      });

      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalledWith('test prompt', 'test-key', 'test-model');
      });
      expect(mockRefine).not.toHaveBeenCalled();

      // Generate path: mount + install + runDev
      await waitFor(() => {
        expect(mockMount).toHaveBeenCalledTimes(1);
      });
      expect(mockInstall).toHaveBeenCalledTimes(1);
      expect(mockRunDev).toHaveBeenCalledTimes(1);
      // updateFiles should NOT be called on generate path
      expect(mockUpdateFiles).not.toHaveBeenCalled();

      // Capture mount call count after generate
      const mountCallsAfterGenerate = mockMount.mock.calls.length;

      // ===== STEP 2: Second message → refine → updateFiles =====
      await act(async () => {
        sendBtn.click();
      });

      await waitFor(() => {
        expect(mockRefine).toHaveBeenCalledTimes(1);
      });

      // Refine path (no package.json): updateFiles called
      await waitFor(() => {
        expect(mockUpdateFiles).toHaveBeenCalledTimes(1);
      });

      // Mount should NOT be called again — only the generate-time mount
      expect(mockMount.mock.calls.length).toBe(mountCallsAfterGenerate);

      // Verify the complete call sequence
      // Generate was called once, refine was called once
      expect(mockGenerate).toHaveBeenCalledTimes(1);
      expect(mockRefine).toHaveBeenCalledTimes(1);
      // Mount called once (generate only), updateFiles called once (refine only)
      expect(mockMount).toHaveBeenCalledTimes(1);
      expect(mockUpdateFiles).toHaveBeenCalledTimes(1);
    });

    it('should pass currentFiles to refine on follow-up message', async () => {
      // Arrange
      const generatedFiles = [
        { path: 'src/App.tsx', content: 'original' },
        { path: 'src/styles.css', content: 'body { margin: 0; }' },
      ];

      mockGenerate.mockResolvedValue({
        message: 'App created',
        files: generatedFiles,
      });
      mockRefine.mockResolvedValue({
        message: 'Refined',
        files: [{ path: 'src/App.tsx', content: 'updated' }],
      });
      mockMount.mockResolvedValue(undefined);
      mockInstall.mockResolvedValue(0);
      mockRunDev.mockResolvedValue(undefined);
      mockUpdateFiles.mockResolvedValue(undefined);

      render(<BuilderPage initialPrompt="" />);

      const sendBtn = screen.getByTestId('send-message-btn');

      // Generate first
      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalled();
      });

      // Refine second
      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockRefine).toHaveBeenCalled();
      });

      // Verify refine was called with the generated files as currentFiles
      expect(mockRefine).toHaveBeenCalledWith(
        generatedFiles,
        'test prompt',
        'test-key',
        'test-model'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 5.2: Package.json in refine triggers mount+install+runDev (full remount)
  // ---------------------------------------------------------------------------
  describe('5.2: Package.json in refine triggers mount+install+runDev', () => {
    it('should remount when refine response includes package.json', async () => {
      // Arrange
      mockGenerate.mockResolvedValue({
        message: 'App created',
        files: [{ path: 'src/App.tsx', content: 'original' }],
      });
      mockRefine.mockResolvedValue({
        message: 'Refined with new deps',
        files: [
          { path: 'src/App.tsx', content: 'refined' },
          { path: 'package.json', content: '{"dependencies":{"lodash":"^4.0.0"}}' },
        ],
      });
      mockMount.mockResolvedValue(undefined);
      mockInstall.mockResolvedValue(0);
      mockRunDev.mockResolvedValue(undefined);
      mockUpdateFiles.mockResolvedValue(undefined);

      render(<BuilderPage initialPrompt="" />);

      const sendBtn = screen.getByTestId('send-message-btn');

      // ===== STEP 1: Generate → first mount =====
      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalled();
      });

      // First mount cycle
      await waitFor(() => {
        expect(mockMount).toHaveBeenCalledTimes(1);
      });
      const mountCallsAfterGenerate = mockMount.mock.calls.length;
      const installCallsAfterGenerate = mockInstall.mock.calls.length;
      const runDevCallsAfterGenerate = mockRunDev.mock.calls.length;

      // ===== STEP 2: Refine with package.json → full remount =====
      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockRefine).toHaveBeenCalled();
      });

      // Assert: mount called AGAIN for package.json remount
      await waitFor(() => {
        expect(mockMount.mock.calls.length).toBeGreaterThan(mountCallsAfterGenerate);
      });

      // install and runDev also called again
      expect(mockInstall.mock.calls.length).toBeGreaterThan(installCallsAfterGenerate);
      expect(mockRunDev.mock.calls.length).toBeGreaterThan(runDevCallsAfterGenerate);

      // updateFiles should NOT be called when package.json is present
      expect(mockUpdateFiles).not.toHaveBeenCalled();

      // Total: mount called twice (once for generate, once for refine remount)
      expect(mockMount).toHaveBeenCalledTimes(2);
      expect(mockInstall).toHaveBeenCalledTimes(2);
      expect(mockRunDev).toHaveBeenCalledTimes(2);
    });

    it('should NOT remount when refine response does NOT include package.json', async () => {
      // Arrange
      mockGenerate.mockResolvedValue({
        message: 'App created',
        files: [{ path: 'src/App.tsx', content: 'original' }],
      });
      mockRefine.mockResolvedValue({
        message: 'Refined code only',
        files: [{ path: 'src/App.tsx', content: 'refined' }],
      });
      mockMount.mockResolvedValue(undefined);
      mockInstall.mockResolvedValue(0);
      mockRunDev.mockResolvedValue(undefined);
      mockUpdateFiles.mockResolvedValue(undefined);

      render(<BuilderPage initialPrompt="" />);

      const sendBtn = screen.getByTestId('send-message-btn');

      // Generate
      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalled();
      });

      const mountCallsAfterGenerate = mockMount.mock.calls.length;

      // Refine without package.json
      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockRefine).toHaveBeenCalled();
      });

      // Mount NOT called again
      expect(mockMount.mock.calls.length).toBe(mountCallsAfterGenerate);
      // updateFiles IS called
      await waitFor(() => {
        expect(mockUpdateFiles).toHaveBeenCalled();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 5.3: Undo reverts currentFiles to pre-refine snapshot
  // ---------------------------------------------------------------------------
  describe('5.3: Undo reverts currentFiles to pre-refine snapshot', () => {
    it('should revert to pre-refine files when Undo callback is invoked', async () => {
      // Arrange: mergeFiles mock returns overwrittenPaths
      const { mergeFiles } = await import('../../utils/mergeFiles');

      const originalFiles = [
        { path: 'src/App.tsx', content: 'original-app' },
        { path: 'src/utils.ts', content: 'original-utils' },
      ];
      const refinedFiles = [{ path: 'src/App.tsx', content: 'refined-app' }];

      mockGenerate.mockResolvedValue({
        message: 'App created',
        files: originalFiles,
      });
      mockRefine.mockResolvedValue({
        message: 'Refined',
        files: refinedFiles,
      });
      mockMount.mockResolvedValue(undefined);
      mockInstall.mockResolvedValue(0);
      mockRunDev.mockResolvedValue(undefined);
      mockUpdateFiles.mockResolvedValue(undefined);

      // mergeFiles returns overwrite for src/App.tsx
      (mergeFiles as ReturnType<typeof vi.fn>).mockReturnValue({
        merged: [
          { path: 'src/App.tsx', content: 'refined-app' },
          { path: 'src/utils.ts', content: 'original-utils' },
        ],
        overwrittenPaths: ['src/App.tsx'],
      });

      render(<BuilderPage initialPrompt="" />);

      const sendBtn = screen.getByTestId('send-message-btn');

      // Step 1: Generate → creates currentFiles
      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalled();
      });

      // Step 2: Refine → overwrites a file, shows warn toast
      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockRefine).toHaveBeenCalled();
      });

      // Assert: warn toast shown with Undo action
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

      // Extract Undo callback from toast call
      const toastCall = mockShowToast.mock.calls.find(
        (call: Array<{ type: string }>) => call[0].type === 'warn'
      );
      const undoCallback = toastCall?.[0]?.action?.callback;
      expect(undoCallback).toBeDefined();

      // Step 3: Execute Undo → reverts currentFiles to pre-refine snapshot
      await act(async () => {
        undoCallback();
      });

      // Step 4: Verify revert by sending another refine —
      // the refine mock should receive the ORIGINAL files, not the merged ones
      mockRefine.mockClear();
      mockRefine.mockResolvedValue({
        message: 'Refined again',
        files: [],
      });

      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockRefine).toHaveBeenCalled();
      });

      // The refine call should receive the original files (pre-refine snapshot)
      // NOT the merged files (which would include 'refined-app')
      const refineCallArgs = mockRefine.mock.calls[0];
      const filesPassedToRefine = refineCallArgs[0] as Array<{ path: string; content: string }>;

      // After Undo, currentFiles should be back to the pre-refine state
      // which is the original generated files
      expect(filesPassedToRefine).toEqual(originalFiles);
    });

    it('should clear preRefineSnapshot after Undo to prevent double-undo', async () => {
      // Arrange
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

      (mergeFiles as ReturnType<typeof vi.fn>).mockReturnValue({
        merged: [{ path: 'src/App.tsx', content: 'refined' }],
        overwrittenPaths: ['src/App.tsx'],
      });

      render(<BuilderPage initialPrompt="" />);

      const sendBtn = screen.getByTestId('send-message-btn');

      // Generate
      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalled();
      });

      // Refine
      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockRefine).toHaveBeenCalled();
      });

      // Get and execute Undo
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'warn' }));
      });

      const toastCall = mockShowToast.mock.calls.find(
        (call: Array<{ type: string }>) => call[0].type === 'warn'
      );
      const undoCallback = toastCall?.[0]?.action?.callback;

      // First Undo: should revert
      await act(async () => {
        undoCallback();
      });

      // Second Undo: should be a no-op (snapshot was cleared)
      // Calling it again should not throw or change state
      await act(async () => {
        undoCallback();
      });

      // After double-undo, send another refine to verify files are still the original
      mockRefine.mockClear();
      mockRefine.mockResolvedValue({ message: 'Refined', files: [] });

      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockRefine).toHaveBeenCalled();
      });

      // Files should still be the original (first undo worked, second was no-op)
      const filesPassed = mockRefine.mock.calls[0][0] as Array<{ path: string; content: string }>;
      expect(filesPassed.some((f) => f.content === 'original')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 5.4: New Chat clears state, next message calls generateApp
  // ---------------------------------------------------------------------------
  describe('5.4: New Chat clears state, next message calls generateApp', () => {
    it('should reset messages and files on New Chat, then generate on next message', async () => {
      // Arrange
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

      render(<BuilderPage initialPrompt="" />);

      const sendBtn = screen.getByTestId('send-message-btn');
      const newChatBtn = screen.getByTestId('new-chat-btn');

      // ===== STEP 1: Generate → creates files + messages =====
      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalled();
      });

      // Messages should exist (user + assistant = 2)
      const msgCountAfterGenerate = screen.getByTestId('message-count').textContent;
      expect(Number(msgCountAfterGenerate)).toBeGreaterThan(0);

      // ===== STEP 2: Refine → adds more messages =====
      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockRefine).toHaveBeenCalled();
      });

      const msgCountAfterRefine = screen.getByTestId('message-count').textContent;
      expect(Number(msgCountAfterRefine)).toBeGreaterThan(Number(msgCountAfterGenerate));

      // ===== STEP 3: New Chat → clears all messages and files =====
      await act(async () => {
        newChatBtn.click();
      });

      // Message count resets to 0
      await waitFor(() => {
        expect(screen.getByTestId('message-count').textContent).toBe('0');
      });

      // ===== STEP 4: Next message should call generate (NOT refine) =====
      // Clear mock counts to isolate the post-reset call
      mockGenerate.mockClear();
      mockRefine.mockClear();
      mockGenerate.mockResolvedValue({
        message: 'New app created',
        files: [{ path: 'src/NewApp.tsx', content: 'new app' }],
      });

      await act(async () => {
        sendBtn.click();
      });

      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalledWith('test prompt', 'test-key', 'test-model');
      });
      expect(mockRefine).not.toHaveBeenCalled();
    });

    it('should allow multiple generate→refine→New Chat cycles', async () => {
      // Arrange
      mockGenerate.mockResolvedValue({
        message: 'App created',
        files: [{ path: 'src/App.tsx', content: 'v1' }],
      });
      mockRefine.mockResolvedValue({
        message: 'Refined',
        files: [{ path: 'src/App.tsx', content: 'v1-refined' }],
      });
      mockMount.mockResolvedValue(undefined);
      mockInstall.mockResolvedValue(0);
      mockRunDev.mockResolvedValue(undefined);
      mockUpdateFiles.mockResolvedValue(undefined);

      render(<BuilderPage initialPrompt="" />);

      const sendBtn = screen.getByTestId('send-message-btn');
      const newChatBtn = screen.getByTestId('new-chat-btn');

      // ===== CYCLE 1: generate → refine → New Chat =====
      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockRefine).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        newChatBtn.click();
      });
      await waitFor(() => {
        expect(screen.getByTestId('message-count').textContent).toBe('0');
      });

      // ===== CYCLE 2: generate → refine → New Chat =====
      mockGenerate.mockClear();
      mockRefine.mockClear();

      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalledTimes(1);
      });
      expect(mockRefine).not.toHaveBeenCalled();

      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockRefine).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        newChatBtn.click();
      });
      await waitFor(() => {
        expect(screen.getByTestId('message-count').textContent).toBe('0');
      });

      // ===== CYCLE 3: generate again =====
      mockGenerate.mockClear();
      mockRefine.mockClear();

      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalledTimes(1);
      });
      expect(mockRefine).not.toHaveBeenCalled();
    });

    it('should clear preRefineSnapshot on New Chat to prevent stale undo', async () => {
      // Arrange
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

      (mergeFiles as ReturnType<typeof vi.fn>).mockReturnValue({
        merged: [{ path: 'src/App.tsx', content: 'refined' }],
        overwrittenPaths: ['src/App.tsx'],
      });

      render(<BuilderPage initialPrompt="" />);

      const sendBtn = screen.getByTestId('send-message-btn');
      const newChatBtn = screen.getByTestId('new-chat-btn');

      // Generate + refine to create a preRefineSnapshot
      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalled();
      });

      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockRefine).toHaveBeenCalled();
      });

      // New Chat clears the snapshot
      await act(async () => {
        newChatBtn.click();
      });

      // After New Chat, generate a new app
      mockGenerate.mockClear();
      mockRefine.mockClear();
      mockGenerate.mockResolvedValue({
        message: 'New app',
        files: [{ path: 'src/NewApp.tsx', content: 'brand-new' }],
      });

      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalled();
      });

      // Refine the new app — no stale undo should be possible
      mockRefine.mockResolvedValue({
        message: 'New app refined',
        files: [{ path: 'src/NewApp.tsx', content: 'brand-new-refined' }],
      });

      await act(async () => {
        sendBtn.click();
      });
      await waitFor(() => {
        expect(mockRefine).toHaveBeenCalled();
      });

      // The warn toast may or may not appear depending on overwritePaths,
      // but any Undo callback should only revert to the NEW app's snapshot,
      // not the old app's files from before the New Chat.
      // We verify this by checking refine was called with the new generated files.
      const lastRefineCall = mockRefine.mock.calls[mockRefine.mock.calls.length - 1];
      const filesPassed = lastRefineCall[0] as Array<{ path: string }>;
      expect(filesPassed.some((f) => f.path === 'src/NewApp.tsx')).toBe(true);
    });
  });
});
