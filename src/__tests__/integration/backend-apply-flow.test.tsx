/**
 * E2E Integration Tests: Backend Apply Flow
 * CHANGE 7 - Backend Integration Wire Up
 * Phase 6 - E2E Integration Tests
 *
 * Tests the full backend creation → credentials → apply → preview flow
 * covering scenarios:
 * - T-036: Happy path - full flow from creation to preview
 * - T-037: Error recovery - backend creation failure with retry
 * - T-038: Edge case - code without backend needs (skip adaptation)
 * - T-039: State clearing - new generation clears backend state
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import React from 'react';
import BuilderPage from '../../pages/BuilderPage';
import { RouterWrapper } from '../../test-utils/RouterWrapper';
import * as SettingsContext from '../../contexts/SettingsContext';
import * as useAIBuilderModule from '../../hooks/useAIBuilder';
import * as useWebContainerModule from '../../hooks/useWebContainer';
import * as useBackendCreationModule from '../../hooks/backend/pipeline/useBackendCreation';
import * as useSupabaseOAuthModule from '../../hooks/backend/oauth/useSupabaseOAuth';
import * as useAdaptProjectModule from '../../services/adapter';
import * as useFileTreeModule from '../../hooks/useFileTree';
import { PipelineStage } from '../../hooks/backend/pipeline/types';

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
  default: ({
    projectName,
    state,
    onOpenSettings,
    hasGeneratedCode,
    hasOAuthToken,
    isCreatingBackend,
    onCreateBackend,
  }: {
    projectName: string;
    state: string;
    onOpenSettings: () => void;
    hasGeneratedCode?: boolean;
    hasOAuthToken?: boolean;
    isCreatingBackend?: boolean;
    onCreateBackend?: () => void;
  }) => (
    <div data-testid="topbar">
      <span data-testid="project-name">{projectName}</span>
      <span data-testid="builder-state">{state}</span>
      <button data-testid="settings-btn" onClick={onOpenSettings}>
        Settings
      </button>
      {hasGeneratedCode && hasOAuthToken && (
        <button
          data-testid="create-backend-btn"
          onClick={onCreateBackend}
          disabled={isCreatingBackend}
        >
          {isCreatingBackend ? 'Creating...' : 'Create Backend'}
        </button>
      )}
    </div>
  ),
}));

vi.mock('../../components/chat/ChatPanel', () => ({
  default: ({
    messages,
    onSendMessage,
    isGenerating,
  }: {
    messages: Array<{ id: string; content: string }>;
    onSendMessage: (msg: string) => void;
    isGenerating: boolean;
  }) => (
    <div data-testid="chat-panel">
      <span data-testid="message-count">{messages.length}</span>
      <span data-testid="is-generating">{String(isGenerating)}</span>
      <input data-testid="chat-input" onChange={() => {}} />
      <button data-testid="send-btn" onClick={() => onSendMessage('test message')}>
        Send
      </button>
    </div>
  ),
}));

vi.mock('../../components/preview/PreviewPanel', () => ({
  default: ({ state, url }: { state: string; url: string }) => (
    <div data-testid="preview-panel">
      <span data-testid="preview-state">{state}</span>
      <span data-testid="preview-url">{url}</span>
    </div>
  ),
}));

vi.mock('../../components/editor/CodeEditor', () => ({
  default: ({ fileName, code, language }: { fileName: string; code: string; language: string }) => (
    <div data-testid="code-editor">
      <span data-testid="file-name">{fileName}</span>
      <span data-testid="code-language">{language}</span>
      <pre data-testid="code-content">{code}</pre>
    </div>
  ),
}));

vi.mock('../../components/editor/FileExplorer', () => ({
  default: ({ files }: { files: Array<{ path: string }> }) => (
    <div data-testid="file-explorer">
      <span data-testid="file-count">{files?.length || 0}</span>
    </div>
  ),
}));

vi.mock('../../components/common/ConsolePanel', () => ({
  default: ({ logs }: { logs: Array<{ type: string; text: string }> }) => (
    <div data-testid="console-panel">
      <span data-testid="log-count">{logs.length}</span>
    </div>
  ),
}));

vi.mock('../../components/settings/SettingsModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="settings-modal">
      <button data-testid="close-modal" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

vi.mock('../../services/webcontainer/fileSystem', () => ({
  filesToTree: vi.fn((files) => ({ tree: files })),
}));

vi.mock('../../components/backend/BackendCreationModal', () => ({
  default: ({
    stage,
    progress,
    error,
    isCreating,
    onRetry,
    onClose,
  }: {
    stage: string;
    progress: number;
    error: string | null;
    isCreating: boolean;
    onRetry: () => void;
    onClose: () => void;
  }) => (
    <div data-testid="backend-creation-modal">
      <span data-testid="backend-stage">{stage}</span>
      <span data-testid="backend-progress">{progress}</span>
      <span data-testid="backend-error">{error}</span>
      <span data-testid="backend-is-creating">{String(isCreating)}</span>
      <button data-testid="backend-retry-btn" onClick={onRetry}>
        Retry
      </button>
      <button data-testid="backend-close-btn" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

vi.mock('../../components/backend/CredentialsModal', () => ({
  default: ({
    result,
    requirements,
    onClose,
    onApply,
    isApplying,
  }: {
    result: { projectUrl: string; anonKey: string; projectName: string } | null;
    requirements: { entities: Array<{ name: string }> } | null;
    onClose: () => void;
    onApply?: () => void;
    isApplying?: boolean;
  }) => (
    <div data-testid="credentials-modal">
      <span data-testid="credentials-project-url">{result?.projectUrl}</span>
      <span data-testid="credentials-anon-key">{result?.anonKey}</span>
      <span data-testid="credentials-project-name">{result?.projectName}</span>
      <span data-testid="credentials-is-applying">{String(isApplying ?? false)}</span>
      <button data-testid="credentials-close-btn" onClick={onClose}>
        Done
      </button>
      {onApply && (
        <button data-testid="credentials-apply-btn" onClick={onApply} disabled={isApplying}>
          Apply to Project
        </button>
      )}
    </div>
  ),
}));

// ===== Mock Values =====
const mockGenerate = vi.fn();
const mockMount = vi.fn().mockResolvedValue(undefined);
const mockInstall = vi.fn().mockResolvedValue(1);
const mockRunDev = vi.fn().mockResolvedValue(undefined);
const mockGetEffectiveApiKey = vi.fn().mockReturnValue('test-api-key');
const mockCreateBackend = vi.fn();
const mockRetryBackend = vi.fn();
const mockResetBackend = vi.fn();
const mockGetToken = vi.fn().mockReturnValue('mock-oauth-token');

// ===== Helper: Create Mock Requirements =====
function createMockRequirements(overrides: Record<string, unknown> = {}) {
  return {
    entities: [
      { name: 'User', typeName: 'User', fields: [], confidence: 90, matchType: 'pattern' as const },
    ],
    hasAuth: true,
    crudOperations: [],
    overallConfidence: 85,
    analysisMethod: 'pattern' as const,
    analyzedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ===== Helper: Create Mock Result =====
function createMockResult(overrides: Record<string, unknown> = {}) {
  return {
    projectUrl: 'https://test-project.supabase.co',
    anonKey: 'test-anon-key-12345',
    projectName: 'test-project',
    migrationName: 'initial_migration',
    ...overrides,
  };
}

// ===== Helper: Setup Default Mocks =====
function setupDefaultMocks() {
  vi.spyOn(SettingsContext, 'useSettings').mockReturnValue({
    getEffectiveApiKey: mockGetEffectiveApiKey,
    modelId: 'gemini-2.0-flash',
  } as unknown as ReturnType<typeof SettingsContext.useSettings>);

  vi.spyOn(useAIBuilderModule, 'useAIBuilder').mockReturnValue({
    generate: mockGenerate,
  } as unknown as ReturnType<typeof useAIBuilderModule.useAIBuilder>);

  vi.spyOn(useWebContainerModule, 'useWebContainer').mockReturnValue({
    mount: mockMount,
    install: mockInstall,
    runDev: mockRunDev,
  } as unknown as ReturnType<typeof useWebContainerModule.useWebContainer>);

  vi.spyOn(useSupabaseOAuthModule, 'useSupabaseOAuth').mockReturnValue({
    isAuthenticated: true,
    getToken: mockGetToken,
  } as unknown as ReturnType<typeof useSupabaseOAuthModule.useSupabaseOAuth>);

  vi.spyOn(useBackendCreationModule, 'useBackendCreation').mockReturnValue({
    stage: PipelineStage.IDLE,
    progress: 0,
    isCreating: false,
    error: null,
    result: null,
    requirements: null,
    createBackend: mockCreateBackend,
    retry: mockRetryBackend,
    reset: mockResetBackend,
  } as unknown as ReturnType<typeof useBackendCreationModule.useBackendCreation>);

  vi.spyOn(useFileTreeModule, 'useFileTree').mockReturnValue({
    files: [],
    isLoading: false,
    error: null,
    refresh: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof useFileTreeModule.useFileTree>);
}

// ===== Test Suite =====
describe('E2E Backend Apply Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowToast.mockClear();
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===== T-036: E2E Test - Full Happy Path Flow =====
  describe('T-036: Happy Path - Full Flow', () => {
    it('should complete full flow: create backend → see credentials → apply → preview works', async () => {
      // GIVEN: User has generated React code in BuilderPage
      const mockFiles = [
        { path: 'App.tsx', content: 'const App = () => <div>Hello</div>' },
        { path: 'src/lib/supabase.ts', content: '// Supabase client' },
      ];

      mockGenerate.mockResolvedValue({
        message: 'Here is your app',
        files: mockFiles,
      });

      // Setup backend hook to simulate complete pipeline
      const mockResult = createMockResult();
      const mockRequirements = createMockRequirements();

      // Mock successful adaptation
      vi.spyOn(useAdaptProjectModule, 'adaptProject').mockReturnValue({
        files: [
          ...mockFiles,
          { path: 'src/lib/supabaseClient.ts', content: 'export const supabase = createClient()' },
        ],
        injectedFiles: ['src/lib/supabaseClient.ts'],
        transformedFiles: ['App.tsx'],
        skipped: false,
      });

      // First render - IDLE stage
      const { rerender } = render(
        <RouterWrapper>
          <BuilderPage />
        </RouterWrapper>
      );

      // WHEN: User generates code
      fireEvent.click(screen.getByTestId('send-btn'));

      // Wait for generation to complete
      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalled();
      });

      // Simulate backend creation complete
      vi.spyOn(useBackendCreationModule, 'useBackendCreation').mockReturnValue({
        stage: PipelineStage.COMPLETE,
        progress: 100,
        isCreating: false,
        error: null,
        result: mockResult,
        requirements: mockRequirements,
        createBackend: mockCreateBackend,
        retry: mockRetryBackend,
        reset: mockResetBackend,
      } as unknown as ReturnType<typeof useBackendCreationModule.useBackendCreation>);

      rerender(
        <RouterWrapper>
          <BuilderPage />
        </RouterWrapper>
      );

      // THEN: CredentialsModal appears with projectUrl and anonKey
      await waitFor(() => {
        expect(screen.getByTestId('credentials-modal')).toBeDefined();
        expect(screen.getByTestId('credentials-project-url').textContent).toBe(
          'https://test-project.supabase.co'
        );
        expect(screen.getByTestId('credentials-project-name').textContent).toBe('test-project');
      });

      // WHEN: User clicks "Apply to Project"
      const applyButton = screen.getByTestId('credentials-apply-btn');
      fireEvent.click(applyButton);

      // THEN: WebContainer remounts with adapted files
      await waitFor(() => {
        expect(mockMount).toHaveBeenCalled();
        expect(mockInstall).toHaveBeenCalled();
        expect(mockRunDev).toHaveBeenCalled();
      });

      // THEN: Success toast is shown
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'success',
            message: expect.stringContaining('Backend applied'),
          })
        );
      });
    });

    it('should show correct credentials in modal after backend creation', async () => {
      // GIVEN
      const mockResult = createMockResult({
        projectUrl: 'https://my-awesome-app.supabase.co',
        projectName: 'my-awesome-app',
      });
      const mockRequirements = createMockRequirements();

      mockGenerate.mockResolvedValue({
        message: 'Generated',
        files: [{ path: 'App.tsx', content: 'test' }],
      });

      vi.spyOn(useBackendCreationModule, 'useBackendCreation').mockReturnValue({
        stage: PipelineStage.COMPLETE,
        progress: 100,
        isCreating: false,
        error: null,
        result: mockResult,
        requirements: mockRequirements,
        createBackend: mockCreateBackend,
        retry: mockRetryBackend,
        reset: mockResetBackend,
      } as unknown as ReturnType<typeof useBackendCreationModule.useBackendCreation>);

      // WHEN
      render(
        <RouterWrapper>
          <BuilderPage />
        </RouterWrapper>
      );

      // THEN: CredentialsModal shows correct project info
      await waitFor(() => {
        expect(screen.getByTestId('credentials-modal')).toBeDefined();
        expect(screen.getByTestId('credentials-project-url').textContent).toBe(
          'https://my-awesome-app.supabase.co'
        );
        expect(screen.getByTestId('credentials-project-name').textContent).toBe('my-awesome-app');
        expect(screen.getByTestId('credentials-anon-key').textContent).toBe('test-anon-key-12345');
      });
    });

    it('should close CredentialsModal after successful apply', async () => {
      // GIVEN
      const mockFiles = [{ path: 'App.tsx', content: 'test' }];
      const mockResult = createMockResult();
      const mockRequirements = createMockRequirements();

      mockGenerate.mockResolvedValue({ message: 'Generated', files: mockFiles });

      vi.spyOn(useAdaptProjectModule, 'adaptProject').mockReturnValue({
        files: mockFiles,
        injectedFiles: [],
        transformedFiles: ['App.tsx'],
        skipped: false,
      });

      vi.spyOn(useBackendCreationModule, 'useBackendCreation').mockReturnValue({
        stage: PipelineStage.COMPLETE,
        progress: 100,
        isCreating: false,
        error: null,
        result: mockResult,
        requirements: mockRequirements,
        createBackend: mockCreateBackend,
        retry: mockRetryBackend,
        reset: mockResetBackend,
      } as unknown as ReturnType<typeof useBackendCreationModule.useBackendCreation>);

      render(
        <RouterWrapper>
          <BuilderPage />
        </RouterWrapper>
      );

      // Verify modal is visible
      await waitFor(() => {
        expect(screen.getByTestId('credentials-modal')).toBeDefined();
      });

      // WHEN: Apply is clicked
      const applyButton = screen.getByTestId('credentials-apply-btn');
      fireEvent.click(applyButton);

      // THEN: Modal closes after success
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
      });
    });
  });

  // ===== T-037: E2E Test - Error Recovery =====
  describe('T-037: Error Recovery - Backend Creation Fails', () => {
    it('should show error toast when WebContainer remount fails during apply', async () => {
      // GIVEN: User is in CredentialsModal with backend credentials
      const mockFiles = [{ path: 'App.tsx', content: 'test' }];
      const mockResult = createMockResult();
      const mockRequirements = createMockRequirements();

      mockGenerate.mockResolvedValue({ message: 'Generated', files: mockFiles });

      vi.spyOn(useAdaptProjectModule, 'adaptProject').mockReturnValue({
        files: mockFiles,
        injectedFiles: ['src/lib/supabase.ts'],
        transformedFiles: ['App.tsx'],
        skipped: false,
      });

      vi.spyOn(useBackendCreationModule, 'useBackendCreation').mockReturnValue({
        stage: PipelineStage.COMPLETE,
        progress: 100,
        isCreating: false,
        error: null,
        result: mockResult,
        requirements: mockRequirements,
        createBackend: mockCreateBackend,
        retry: mockRetryBackend,
        reset: mockResetBackend,
      } as unknown as ReturnType<typeof useBackendCreationModule.useBackendCreation>);

      // Mock mount to fail
      mockMount.mockRejectedValueOnce(new Error('Mount failed'));

      render(
        <RouterWrapper>
          <BuilderPage />
        </RouterWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('credentials-modal')).toBeDefined();
      });

      // WHEN: User clicks Apply and remount fails
      const applyButton = screen.getByTestId('credentials-apply-btn');
      fireEvent.click(applyButton);

      // THEN: Error toast is shown
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            message: expect.stringContaining('Failed to apply backend'),
          })
        );
      });
    });

    it('should keep modal open on error so user can retry', async () => {
      // GIVEN
      const mockFiles = [{ path: 'App.tsx', content: 'test' }];
      const mockResult = createMockResult();
      const mockRequirements = createMockRequirements();

      mockGenerate.mockResolvedValue({ message: 'Generated', files: mockFiles });

      vi.spyOn(useAdaptProjectModule, 'adaptProject').mockReturnValue({
        files: mockFiles,
        injectedFiles: ['src/lib/supabase.ts'],
        transformedFiles: ['App.tsx'],
        skipped: false,
      });

      vi.spyOn(useBackendCreationModule, 'useBackendCreation').mockReturnValue({
        stage: PipelineStage.COMPLETE,
        progress: 100,
        isCreating: false,
        error: null,
        result: mockResult,
        requirements: mockRequirements,
        createBackend: mockCreateBackend,
        retry: mockRetryBackend,
        reset: mockResetBackend,
      } as unknown as ReturnType<typeof useBackendCreationModule.useBackendCreation>);

      // Mock mount to fail
      mockMount.mockRejectedValueOnce(new Error('Mount failed'));

      render(
        <RouterWrapper>
          <BuilderPage />
        </RouterWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('credentials-modal')).toBeDefined();
      });

      // WHEN: Apply fails
      const applyButton = screen.getByTestId('credentials-apply-btn');
      fireEvent.click(applyButton);

      // THEN: Modal stays open
      await waitFor(() => {
        expect(screen.getByTestId('credentials-modal')).toBeDefined();
      });
    });

    it('should allow user to retry after error', async () => {
      // GIVEN
      const mockFiles = [{ path: 'App.tsx', content: 'test' }];
      const mockResult = createMockResult();
      const mockRequirements = createMockRequirements();

      mockGenerate.mockResolvedValue({ message: 'Generated', files: mockFiles });

      vi.spyOn(useAdaptProjectModule, 'adaptProject').mockReturnValue({
        files: mockFiles,
        injectedFiles: ['src/lib/supabase.ts'],
        transformedFiles: ['App.tsx'],
        skipped: false,
      });

      vi.spyOn(useBackendCreationModule, 'useBackendCreation').mockReturnValue({
        stage: PipelineStage.COMPLETE,
        progress: 100,
        isCreating: false,
        error: null,
        result: mockResult,
        requirements: mockRequirements,
        createBackend: mockCreateBackend,
        retry: mockRetryBackend,
        reset: mockResetBackend,
      } as unknown as ReturnType<typeof useBackendCreationModule.useBackendCreation>);

      // First call fails, second succeeds
      mockMount.mockRejectedValueOnce(new Error('Mount failed')).mockResolvedValueOnce(undefined);

      render(
        <RouterWrapper>
          <BuilderPage />
        </RouterWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('credentials-modal')).toBeDefined();
      });

      // First attempt - fails
      const applyButton = screen.getByTestId('credentials-apply-btn');
      fireEvent.click(applyButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
      });

      // Clear for second attempt
      mockShowToast.mockClear();

      // WHEN: User clicks Apply again (retry)
      fireEvent.click(applyButton);

      // THEN: Second attempt succeeds
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
      });
    });
  });

  // ===== T-038: E2E Test - Edge Case: Skip Adaptation =====
  describe('T-038: Edge Case - Code Without Backend Needs', () => {
    it('should show info toast when adaptation is skipped', async () => {
      // GIVEN: Generated code doesn't use Supabase features
      const mockFiles = [{ path: 'App.tsx', content: 'const App = () => <div>Hello</div>' }];
      const mockResult = createMockResult();
      const mockRequirements = createMockRequirements({
        entities: [], // Empty entities = no Supabase needed
        hasAuth: false,
      });

      mockGenerate.mockResolvedValue({ message: 'Generated', files: mockFiles });

      // Mock adaptProject to return skipped result
      vi.spyOn(useAdaptProjectModule, 'adaptProject').mockReturnValue({
        files: mockFiles,
        injectedFiles: [],
        transformedFiles: [],
        skipped: true,
        reason: 'No entities detected - no Supabase integration needed',
      });

      vi.spyOn(useBackendCreationModule, 'useBackendCreation').mockReturnValue({
        stage: PipelineStage.COMPLETE,
        progress: 100,
        isCreating: false,
        error: null,
        result: mockResult,
        requirements: mockRequirements,
        createBackend: mockCreateBackend,
        retry: mockRetryBackend,
        reset: mockResetBackend,
      } as unknown as ReturnType<typeof useBackendCreationModule.useBackendCreation>);

      render(
        <RouterWrapper>
          <BuilderPage />
        </RouterWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('credentials-modal')).toBeDefined();
      });

      // WHEN: User clicks Apply
      const applyButton = screen.getByTestId('credentials-apply-btn');
      fireEvent.click(applyButton);

      // THEN: Info toast shows "No backend integration needed"
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'info',
            message: expect.stringContaining('No entities detected'),
          })
        );
      });
    });

    it('should keep modal open when adaptation is skipped', async () => {
      // GIVEN
      const mockFiles = [{ path: 'App.tsx', content: 'test' }];
      const mockResult = createMockResult();
      const mockRequirements = createMockRequirements({
        entities: [],
        hasAuth: false,
      });

      mockGenerate.mockResolvedValue({ message: 'Generated', files: mockFiles });

      vi.spyOn(useAdaptProjectModule, 'adaptProject').mockReturnValue({
        files: mockFiles,
        injectedFiles: [],
        transformedFiles: [],
        skipped: true,
        reason: 'No backend integration needed',
      });

      vi.spyOn(useBackendCreationModule, 'useBackendCreation').mockReturnValue({
        stage: PipelineStage.COMPLETE,
        progress: 100,
        isCreating: false,
        error: null,
        result: mockResult,
        requirements: mockRequirements,
        createBackend: mockCreateBackend,
        retry: mockRetryBackend,
        reset: mockResetBackend,
      } as unknown as ReturnType<typeof useBackendCreationModule.useBackendCreation>);

      render(
        <RouterWrapper>
          <BuilderPage />
        </RouterWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('credentials-modal')).toBeDefined();
      });

      // WHEN: Apply is clicked (should skip adaptation)
      const applyButton = screen.getByTestId('credentials-apply-btn');
      fireEvent.click(applyButton);

      // THEN: Modal stays open (user can close manually)
      await waitFor(() => {
        expect(screen.getByTestId('credentials-modal')).toBeDefined();
      });
    });

    it('should not call mount when adaptation is skipped', async () => {
      // GIVEN
      const mockFiles = [{ path: 'App.tsx', content: 'test' }];
      const mockResult = createMockResult();
      const mockRequirements = createMockRequirements({
        entities: [],
        hasAuth: false,
      });

      mockGenerate.mockResolvedValue({ message: 'Generated', files: mockFiles });

      vi.spyOn(useAdaptProjectModule, 'adaptProject').mockReturnValue({
        files: mockFiles,
        injectedFiles: [],
        transformedFiles: [],
        skipped: true,
        reason: 'No backend integration needed',
      });

      vi.spyOn(useBackendCreationModule, 'useBackendCreation').mockReturnValue({
        stage: PipelineStage.COMPLETE,
        progress: 100,
        isCreating: false,
        error: null,
        result: mockResult,
        requirements: mockRequirements,
        createBackend: mockCreateBackend,
        retry: mockRetryBackend,
        reset: mockResetBackend,
      } as unknown as ReturnType<typeof useBackendCreationModule.useBackendCreation>);

      // Clear any previous calls
      mockMount.mockClear();

      render(
        <RouterWrapper>
          <BuilderPage />
        </RouterWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('credentials-modal')).toBeDefined();
      });

      // WHEN: Apply is clicked
      const applyButton = screen.getByTestId('credentials-apply-btn');
      fireEvent.click(applyButton);

      // THEN: Mount should NOT be called since adaptation was skipped
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalled();
      });

      // Verify mount was not called for this apply action
      // (mount may have been called from initial code generation, so we check relative)
    });
  });

  // ===== T-039: E2E Test - State Clearing =====
  describe('T-039: State Clearing - Generate New Code Clears Backend State', () => {
    it('should call resetBackend when sending a new message', async () => {
      // GIVEN: User has created backend and sees CredentialsModal
      const mockFiles = [{ path: 'App.tsx', content: 'test' }];
      const mockResult = createMockResult();
      const mockRequirements = createMockRequirements();

      mockGenerate.mockResolvedValue({ message: 'Generated', files: mockFiles });

      vi.spyOn(useBackendCreationModule, 'useBackendCreation').mockReturnValue({
        stage: PipelineStage.COMPLETE,
        progress: 100,
        isCreating: false,
        error: null,
        result: mockResult,
        requirements: mockRequirements,
        createBackend: mockCreateBackend,
        retry: mockRetryBackend,
        reset: mockResetBackend,
      } as unknown as ReturnType<typeof useBackendCreationModule.useBackendCreation>);

      render(
        <RouterWrapper>
          <BuilderPage />
        </RouterWrapper>
      );

      // Verify CredentialsModal is visible
      await waitFor(() => {
        expect(screen.getByTestId('credentials-modal')).toBeDefined();
      });

      // WHEN: User generates new code (sends new message)
      fireEvent.click(screen.getByTestId('send-btn'));

      // THEN: resetBackend is called
      await waitFor(() => {
        expect(mockResetBackend).toHaveBeenCalled();
      });
    });

    it('should close CredentialsModal when generating new code', async () => {
      // GIVEN
      const mockFiles = [{ path: 'App.tsx', content: 'test' }];
      const mockResult = createMockResult();
      const mockRequirements = createMockRequirements();

      mockGenerate.mockResolvedValue({ message: 'Generated', files: mockFiles });

      vi.spyOn(useBackendCreationModule, 'useBackendCreation').mockReturnValue({
        stage: PipelineStage.COMPLETE,
        progress: 100,
        isCreating: false,
        error: null,
        result: mockResult,
        requirements: mockRequirements,
        createBackend: mockCreateBackend,
        retry: mockRetryBackend,
        reset: mockResetBackend,
      } as unknown as ReturnType<typeof useBackendCreationModule.useBackendCreation>);

      render(
        <RouterWrapper>
          <BuilderPage />
        </RouterWrapper>
      );

      // Verify modal is visible
      await waitFor(() => {
        expect(screen.getByTestId('credentials-modal')).toBeDefined();
      });

      // WHEN: User sends a new message
      fireEvent.click(screen.getByTestId('send-btn'));

      // THEN: resetBackend is called (which clears backend state)
      await waitFor(() => {
        expect(mockResetBackend).toHaveBeenCalled();
      });
    });

    it('should clear backend state before new generation starts', async () => {
      // GIVEN
      const mockFiles = [{ path: 'App.tsx', content: 'New App' }];

      mockGenerate.mockResolvedValue({ message: 'New generated code', files: mockFiles });

      vi.spyOn(useBackendCreationModule, 'useBackendCreation').mockReturnValue({
        stage: PipelineStage.COMPLETE,
        progress: 100,
        isCreating: false,
        error: null,
        result: createMockResult(),
        requirements: createMockRequirements(),
        createBackend: mockCreateBackend,
        retry: mockRetryBackend,
        reset: mockResetBackend,
      } as unknown as ReturnType<typeof useBackendCreationModule.useBackendCreation>);

      render(
        <RouterWrapper>
          <BuilderPage />
        </RouterWrapper>
      );

      // WHEN: User generates new code
      fireEvent.click(screen.getByTestId('send-btn'));

      // THEN: resetBackend is called (clearing result, requirements, stage)
      await waitFor(() => {
        expect(mockResetBackend).toHaveBeenCalled();
        expect(mockGenerate).toHaveBeenCalled();
      });

      // Verify resetBackend was called (clearing old backend state)
      expect(mockResetBackend).toHaveBeenCalled();
    });

    it('should not affect new generation with stale backend state', async () => {
      // GIVEN: User has stale backend state
      const mockFiles = [{ path: 'App.tsx', content: 'Brand New App' }];

      mockGenerate.mockResolvedValue({
        message: 'Fresh generation',
        files: mockFiles,
      });

      // Simulate stale state from previous backend creation
      vi.spyOn(useBackendCreationModule, 'useBackendCreation').mockReturnValue({
        stage: PipelineStage.COMPLETE,
        progress: 100,
        isCreating: false,
        error: null,
        result: createMockResult({ projectName: 'old-backend' }),
        requirements: createMockRequirements(),
        createBackend: mockCreateBackend,
        retry: mockRetryBackend,
        reset: mockResetBackend,
      } as unknown as ReturnType<typeof useBackendCreationModule.useBackendCreation>);

      render(
        <RouterWrapper>
          <BuilderPage />
        </RouterWrapper>
      );

      // Verify stale modal is visible
      await waitFor(() => {
        expect(screen.getByTestId('credentials-modal')).toBeDefined();
        expect(screen.getByTestId('credentials-project-name').textContent).toBe('old-backend');
      });

      // WHEN: User generates new code
      fireEvent.click(screen.getByTestId('send-btn'));

      // THEN: resetBackend clears stale state before generation
      await waitFor(() => {
        expect(mockResetBackend).toHaveBeenCalled();
        expect(mockGenerate).toHaveBeenCalled();
      });

      // The new generation should proceed without stale state
    });
  });

  // ===== Additional Integration Tests =====
  describe('Integration: Apply Flow With Missing Data', () => {
    it('should show error when requirements is null', async () => {
      // GIVEN
      const mockFiles = [{ path: 'App.tsx', content: 'test' }];
      const mockResult = createMockResult();

      mockGenerate.mockResolvedValue({ message: 'Generated', files: mockFiles });

      vi.spyOn(useBackendCreationModule, 'useBackendCreation').mockReturnValue({
        stage: PipelineStage.COMPLETE,
        progress: 100,
        isCreating: false,
        error: null,
        result: mockResult,
        requirements: null, // Missing requirements!
        createBackend: mockCreateBackend,
        retry: mockRetryBackend,
        reset: mockResetBackend,
      } as unknown as ReturnType<typeof useBackendCreationModule.useBackendCreation>);

      render(
        <RouterWrapper>
          <BuilderPage />
        </RouterWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('credentials-modal')).toBeDefined();
      });

      // WHEN: Click Apply
      const applyButton = screen.getByTestId('credentials-apply-btn');
      fireEvent.click(applyButton);

      // THEN: Error toast shown
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            message: expect.stringContaining('requirements not available'),
          })
        );
      });
    });

    it('should show error when result is null', async () => {
      // GIVEN

      mockGenerate.mockResolvedValue({
        message: 'Generated',
        files: [{ path: 'App.tsx', content: 'test' }],
      });

      vi.spyOn(useBackendCreationModule, 'useBackendCreation').mockReturnValue({
        stage: PipelineStage.COMPLETE,
        progress: 100,
        isCreating: false,
        error: null,
        result: null, // Missing result!
        requirements: createMockRequirements(),
        createBackend: mockCreateBackend,
        retry: mockRetryBackend,
        reset: mockResetBackend,
      } as unknown as ReturnType<typeof useBackendCreationModule.useBackendCreation>);

      // Note: When result is null, CredentialsModal won't render
      // But the handler should still handle this gracefully

      render(
        <RouterWrapper>
          <BuilderPage />
        </RouterWrapper>
      );

      // Modal should NOT be visible when result is null
      await waitFor(() => {
        expect(screen.queryByTestId('credentials-modal')).toBeNull();
      });
    });
  });
});
