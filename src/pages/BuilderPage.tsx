import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import TopBar from '../components/common/TopBar';
import ChatPanel from '../components/chat/ChatPanel';
import PreviewPanel from '../components/preview/PreviewPanel';
import CodeEditor from '../components/editor/CodeEditor';
import FileExplorer from '../components/editor/FileExplorer';
import ConsolePanel from '../components/common/ConsolePanel';
import BuildErrorPanel from '../components/common/BuildErrorPanel';
import BackendCreationModal from '../components/backend/BackendCreationModal';
import CredentialsModal from '../components/backend/CredentialsModal';
import DeployModal from '../components/deploy/DeployModal';
import DeploySuccess from '../components/deploy/DeploySuccess';
import { ToastProvider, useToast } from '../components/common/Toast';
import { type ChatMessage, type BuilderState, type ProjectFile } from '../types';
import { filesToTree } from '../services/webcontainer/fileSystem';
import { WebContainerManager } from '../services/webcontainer/WebContainerManager';
import { isBinaryFile } from '../utils/binaryExtensions';
import { useSettings } from '../contexts/SettingsContext';
import { useAIBuilder } from '../hooks/useAIBuilder';
import { useWebContainer } from '../hooks/useWebContainer';
import { useConsoleLogs } from '../hooks/useConsoleLogs';
import { useFileTree } from '../hooks/useFileTree';
import { useBackendCreation } from '../hooks/backend/pipeline/useBackendCreation';
import { useSupabaseOAuth } from '../hooks/backend/oauth/useSupabaseOAuth';
import { useVercelOAuth, useVercelDeploy } from '../hooks/deploy';
import { DeployStage } from '../hooks/deploy/types';
import { adaptProject } from '../services/adapter';
import SettingsModal from '../components/settings/SettingsModal';
import { PipelineStage } from '../hooks/backend/pipeline/types';
import { getGenericErrorMessage, logErrorSafe, logWarnSafe } from '../utils/logger';
import { mergeFiles } from '../utils/mergeFiles';
import { computeFileDiff, formatDiffSummary } from '../utils/fileDiff';
import './BuilderPage.css';
import '../components/common/Toast.css';

interface BuilderPageProps {
  initialPrompt: string;
}

/**
 * Inner component that uses toast
 */
const BuilderPageInner: React.FC<BuilderPageProps> = ({ initialPrompt }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [builderState, setBuilderState] = useState<BuilderState>('idle');
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [showExplorer, setShowExplorer] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [currentFiles, setCurrentFiles] = useState<ProjectFile[]>([]);
  const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
  const [newlyCreatedPath, setNewlyCreatedPath] = useState<string | null>(null);
  const { logs: consoleLogs, addLog, clearLogs } = useConsoleLogs();
  const fileTree = useFileTree();
  const { showToast } = useToast();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBackendModalOpen, setIsBackendModalOpen] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [_applyError, setApplyError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<unknown>(null);
  // Editor save state (ES-002, ES-007, ES-012)
  const [isEditorDirty, setIsEditorDirty] = useState(false);
  const [isSavingFile, setIsSavingFile] = useState(false);
  const pendingFileSwitchRef = useRef<string | null>(null);
  const { getEffectiveApiKey, modelId } = useSettings();

  const { generate, refine } = useAIBuilder();
  const { mount, install, runDev, updateFiles, writeFile } = useWebContainer();

  // Backend creation hooks
  const { isAuthenticated } = useSupabaseOAuth();
  const {
    stage: backendStage,
    progress: backendProgress,
    isCreating: isCreatingBackend,
    error: backendError,
    result: backendResult,
    requirements: backendRequirements,
    createBackend,
    retry: retryBackend,
    reset: resetBackend,
  } = useBackendCreation();

  // Vercel deploy hooks
  const {
    isAuthenticated: isVercelAuthenticated,
    status: vercelOAuthStatus,
    error: _vercelOAuthError,
    login: vercelLogin,
    exchangeCode: vercelExchangeCode,
  } = useVercelOAuth();
  const {
    stage: deployStage,
    progress: deployProgress,
    isDeploying,
    error: deployError,
    result: deployResult,
    deploy: vercelDeploy,
    retry: retryDeploy,
    reset: resetDeploy,
    abort: abortDeploy,
  } = useVercelDeploy();

  // Deploy modal state
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [showDeploySuccess, setShowDeploySuccess] = useState(false);

  // Ref to track if initial prompt was already processed
  const initialPromptProcessed = useRef(false);

  // Pre-refine snapshot for Undo (ITR-009)
  const preRefineSnapshot = useRef<ProjectFile[] | null>(null);

  const handleNewMessage = useCallback(
    async (content: string) => {
      // Clear backend state before generating new code (RA-007)
      resetBackend();
      // Close credentials modal if open (RA-007)
      setShowCredentialsModal(false);

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setBuilderState('generating');

      try {
        // ITR-002: Route between generate (first message) and refine (follow-ups)
        const isRefine = currentFiles.length > 0;

        let response;
        if (isRefine) {
          // ITR-009: Save pre-refine snapshot for Undo
          preRefineSnapshot.current = [...currentFiles];
          response = await refine(currentFiles, content, getEffectiveApiKey(), modelId);
        } else {
          response = await generate(content, getEffectiveApiKey(), modelId);
        }

        // Build assistant message content with optional diff summary (ITR-008)
        let assistantContent = response.message;
        if (isRefine && response.files && response.files.length > 0) {
          const diffs = computeFileDiff(currentFiles, response.files);
          const diffSummary = formatDiffSummary(diffs);
          if (diffSummary) {
            assistantContent = `${response.message}\n\n${diffSummary}`;
          }
        }

        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: assistantContent,
          files: response.files,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMsg]);

        if (response.warnings && response.warnings.length > 0) {
          response.warnings.forEach((w) => showToast({ message: w, type: 'error' }));
        }

        if (response.files && response.files.length > 0) {
          if (isRefine) {
            // ITR-005: Merge existing + incoming files (AI wins on collision)
            const { merged, overwrittenPaths } = mergeFiles(currentFiles, response.files);
            setCurrentFiles(merged);
            setActiveFile(merged.find((f) => f.path.includes('App.tsx')) || merged[0]);

            // PWU-002: Check if package.json changed → full remount
            const hasPackageJson = response.files.some(
              (f) => f.path === 'package.json' || f.path === '/package.json'
            );

            if (hasPackageJson) {
              // Full remount needed
              setBuilderState('installing');
              const tree = filesToTree(merged);
              await mount(tree);
              await install(addLog);
              await fileTree.refresh();

              setBuilderState('running');
              await runDev(addLog, (url) => {
                setPreviewUrl(url);
              });
            } else {
              // PWU-001: Partial update — only write changed files
              setBuilderState('installing');
              await updateFiles(response.files);
              await fileTree.refresh();

              setBuilderState('running');
            }

            // ITR-007: Show overwrite warning toast with Undo action (ITR-009)
            if (overwrittenPaths.length > 0) {
              showToast({
                message: `AI overwrote ${overwrittenPaths.length} file(s)`,
                type: 'warn',
                duration: 8000,
                action: {
                  label: 'Undo',
                  callback: () => {
                    if (preRefineSnapshot.current) {
                      setCurrentFiles(preRefineSnapshot.current);
                      preRefineSnapshot.current = null;
                    }
                  },
                },
              });
            }
          } else {
            // First message — full mount path
            setCurrentFiles(response.files);
            setActiveFile(
              response.files.find((f) => f.path.includes('App.tsx')) || response.files[0]
            );

            // Start WebContainer flow
            setBuilderState('installing');
            const tree = filesToTree(response.files);
            await mount(tree);
            await install(addLog);
            await fileTree.refresh();

            setBuilderState('running');
            await runDev(addLog, (url) => {
              setPreviewUrl(url);
            });
          }
        } else {
          setBuilderState('idle');
        }
      } catch (error) {
        setLastError(error);
        setBuilderState('error');
      }
    },
    [
      currentFiles,
      generate,
      refine,
      mount,
      install,
      runDev,
      updateFiles,
      getEffectiveApiKey,
      modelId,
      resetBackend,
      showToast,
      fileTree.refresh,
    ]
  );

  // Handler for retry after build error
  const handleRetry = useCallback(() => {
    setBuilderState('idle');
    setLastError(null);
  }, []);

  // Handler for New Chat — clears state for fresh generate (ITR-006)
  const handleNewChat = useCallback(() => {
    setCurrentFiles([]);
    setMessages([]);
    setBuilderState('idle');
    preRefineSnapshot.current = null;
  }, []);

  // Race guard counter for async file loads (FCL-004)
  const loadRequestRef = useRef(0);

  // Handler for file selection from FileExplorer (FCL-001, FCL-004)
  // With unsaved changes guard (ES-012)
  const handleFileSelect = useCallback(
    async (path: string) => {
      // Unsaved changes guard — warn and offer save (ES-012)
      if (isEditorDirty && activeFile && path !== activeFile.path) {
        pendingFileSwitchRef.current = path;
        showToast({
          message: `Unsaved changes in ${activeFile.path}`,
          type: 'warn',
          action: {
            label: 'Save & Switch',
            callback: () => {
              // Save current file, then switch to pending
              const currentContent = activeFile.content || '';
              handleEditorSave({ path: activeFile.path, content: currentContent });
              setIsEditorDirty(false);
              const pendingPath = pendingFileSwitchRef.current;
              pendingFileSwitchRef.current = null;
              if (pendingPath) handleFileSelect(pendingPath);
            },
          },
        });
        return;
      }

      const requestId = ++loadRequestRef.current;

      // Binary file check — skip readFile, set placeholder (FCL-003)
      if (isBinaryFile(path)) {
        setActiveFile({ path, content: '[Binary file \u2014 preview not available]' });
        return;
      }

      try {
        const wcm = await WebContainerManager.getInstance();
        const content = await wcm.readFile(path);

        // Race guard: only apply if this is still the latest request (FCL-004)
        if (requestId !== loadRequestRef.current) return;

        setActiveFile({ path, content });
      } catch (_error) {
        // Race guard: discard stale errors too
        if (requestId !== loadRequestRef.current) return;

        showToast({ message: `Failed to load ${path}`, type: 'error' });
        setActiveFile({ path, content: '// Error loading file content' });
      }
    },
    [showToast, isEditorDirty, activeFile]
  );

  // Handler for editor onChange — updates activeFile only, NOT currentFiles (ES-008, D5)
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined && activeFile) {
        setActiveFile({ ...activeFile, content: value });
      }
    },
    [activeFile]
  );

  // Handler for editor onSave — writes to WC, updates currentFiles, refreshes tree (ES-009, ES-010, ES-011)
  const handleEditorSave = useCallback(
    async (file: { path: string; content: string }) => {
      // Race guard — don't write if WC is already writing (ES-013)
      try {
        const wcm = await WebContainerManager.getInstance();
        if (wcm.isWriting) {
          showToast({
            message: 'WebContainer is busy writing. Try again in a moment.',
            type: 'warn',
          });
          return;
        }
      } catch {
        // WCM not available — proceed anyway, writeFile will handle it
      }

      setIsSavingFile(true);
      try {
        await writeFile(file.path, file.content);

        // Update currentFiles to reflect saved state (ES-010)
        setCurrentFiles((prev) =>
          prev.map((f) => (f.path === file.path ? { ...f, content: file.content } : f))
        );

        // Update activeFile to reflect saved state (ES-010)
        setActiveFile((prev) =>
          prev && prev.path === file.path ? { ...prev, content: file.content } : prev
        );

        // Refresh file tree to pick up any WC-side changes (ES-011)
        fileTree.refresh();

        setIsEditorDirty(false);
      } catch (error) {
        showToast({
          message: `Failed to save ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'error',
        });
      } finally {
        setIsSavingFile(false);
      }
    },
    [writeFile, fileTree, showToast]
  );

  // Handler for creating new file/folder from FileExplorer (FCREAT-005)
  const handleNewItem = useCallback(
    async (item: { parentPath: string; name: string; type: 'file' | 'folder' }) => {
      const fullPath = item.parentPath === '/' ? item.name : `${item.parentPath}/${item.name}`;
      try {
        if (item.type === 'file') {
          await fileTree.createFile(fullPath);
          setNewlyCreatedPath(fullPath);
        } else {
          await fileTree.createFolder(fullPath);
        }
      } catch (error) {
        showToast({
          message: `Failed to create ${item.type}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'error',
        });
      }
    },
    [fileTree, showToast]
  );

  // Handler for deleting file/folder from FileExplorer (FCREAT-009)
  const handleDeleteItem = useCallback(
    async (item: { path: string; type: 'file' | 'folder' }) => {
      // Clear activeFile if the deleted item matches or is a parent folder
      if (activeFile) {
        if (activeFile.path === item.path) {
          setActiveFile(null);
        } else if (activeFile.path.startsWith(item.path + '/')) {
          setActiveFile(null);
        }
      }

      try {
        await fileTree.deleteItem(item.path, item.type);
      } catch (error) {
        showToast({
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'error',
        });
      }
    },
    [activeFile, fileTree, showToast]
  );

  // Auto-select newly created file after tree refresh (FCREAT-005)
  useEffect(() => {
    if (!newlyCreatedPath) return;
    const found = fileTree.files.find((f) => f.path === newlyCreatedPath);
    if (found) {
      setActiveFile(found);
      setNewlyCreatedPath(null);
    }
  }, [newlyCreatedPath, fileTree.files]);

  // Initialize build with prompt - only once
  useEffect(() => {
    if (initialPrompt && !initialPromptProcessed.current) {
      initialPromptProcessed.current = true;
      handleNewMessage(initialPrompt);
    }
  }, [initialPrompt]); // Removed handleNewMessage and messages.length from deps

  // Handler for opening backend modal
  const handleOpenBackendModal = useCallback(() => {
    setIsBackendModalOpen(true);
  }, []);

  // Handler for closing backend modal
  const handleCloseBackendModal = useCallback(() => {
    setIsBackendModalOpen(false);
  }, []);

  // Handler for creating backend
  const handleCreateBackend = useCallback(async () => {
    if (currentFiles.length === 0) return;

    // Convert files to code string for analysis
    const codeString = currentFiles.map((f) => `// ${f.path}\n${f.content ?? ''}`).join('\n\n');

    await createBackend(codeString, {
      projectName: 'generated-backend',
      region: 'us-east-1',
    });
  }, [currentFiles, createBackend]);

  // Handler for retry
  const handleRetryBackend = useCallback(() => {
    retryBackend();
  }, [retryBackend]);

  // Start backend creation when modal opens
  useEffect(() => {
    if (isBackendModalOpen && !isCreatingBackend && backendStage === 'idle') {
      handleCreateBackend();
    }
  }, [isBackendModalOpen, isCreatingBackend, backendStage, handleCreateBackend]);

  // Handle pipeline completion - close BackendCreationModal and open CredentialsModal
  useEffect(() => {
    if (backendStage === PipelineStage.COMPLETE && backendResult && !showCredentialsModal) {
      // Close the BackendCreationModal
      setIsBackendModalOpen(false);
      // Open the CredentialsModal
      setShowCredentialsModal(true);
    }
  }, [backendStage, backendResult, showCredentialsModal]);

  // ====== Vercel Deploy Handlers ======

  // Handle OAuth callback: detect `code` param in URL after Vercel redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code && vercelOAuthStatus === 'idle') {
      vercelExchangeCode(code);
      // Clean up URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [vercelOAuthStatus, vercelExchangeCode]);

  // Handler for "Deploy to Vercel" button click
  const handleDeployClick = useCallback(() => {
    if (!isVercelAuthenticated) {
      // Not authenticated — trigger Vercel OAuth login
      vercelLogin();
      return;
    }
    // Open deploy modal and start deployment
    setIsDeployModalOpen(true);
  }, [isVercelAuthenticated, vercelLogin]);

  // Start deployment when deploy modal opens
  useEffect(() => {
    if (
      isDeployModalOpen &&
      !isDeploying &&
      deployStage === DeployStage.IDLE &&
      currentFiles.length > 0
    ) {
      vercelDeploy(currentFiles, { projectName: 'generated-app' });
    }
  }, [isDeployModalOpen, isDeploying, deployStage, currentFiles, vercelDeploy]);

  // Handle deploy completion — show DeploySuccess
  useEffect(() => {
    if (deployStage === DeployStage.COMPLETE && deployResult && !showDeploySuccess) {
      setIsDeployModalOpen(false);
      setShowDeploySuccess(true);
    }
  }, [deployStage, deployResult, showDeploySuccess]);

  // Handler for closing deploy modal
  const handleCloseDeployModal = useCallback(() => {
    setIsDeployModalOpen(false);
    resetDeploy();
  }, [resetDeploy]);

  // Handler for retrying deploy
  const handleRetryDeploy = useCallback(() => {
    retryDeploy();
  }, [retryDeploy]);

  // Handler for aborting deploy
  const handleAbortDeploy = useCallback(() => {
    abortDeploy();
  }, [abortDeploy]);

  // Handler for closing deploy success
  const handleCloseDeploySuccess = useCallback(() => {
    setShowDeploySuccess(false);
    resetDeploy();
  }, [resetDeploy]);

  // Handler for closing CredentialsModal
  const handleCloseCredentialsModal = useCallback(() => {
    setShowCredentialsModal(false);
  }, []);

  // Handler for applying backend to current project
  const handleApplyBackend = useCallback(async () => {
    // Clear any previous error
    setApplyError(null);

    // Guard clause: need result
    if (!backendResult) {
      logWarnSafe('ApplyBackend', 'Cannot apply backend: missing result');
      showToast({
        message: 'Backend result not available. Please recreate the backend.',
        type: 'error',
      });
      return;
    }

    // Guard clause: need requirements
    if (!backendRequirements) {
      logWarnSafe('ApplyBackend', 'Cannot apply backend: missing requirements');
      showToast({
        message: 'Backend requirements not available. Please recreate the backend.',
        type: 'error',
      });
      return;
    }

    setIsApplying(true);

    try {
      // Get current files from state
      const currentFilesToAdapt = currentFiles;

      // Call adaptProject with current files and backend info
      const adapted = adaptProject({
        files: currentFilesToAdapt,
        backendResult: backendResult,
        requirements: backendRequirements,
      });

      // If adaptation was skipped, show toast and keep modal open
      if (adapted.skipped) {
        logWarnSafe('ApplyBackend', `Backend adaptation skipped: ${adapted.reason}`);
        showToast({
          message:
            adapted.reason ||
            "No backend integration needed - the generated code doesn't use Supabase features.",
          type: 'info',
        });
        return; // Keep modal open
      }

      // Update current files with adapted files
      setCurrentFiles(adapted.files);

      // Remount WebContainer with adapted files
      const tree = filesToTree(adapted.files);
      await mount(tree);
      await install(addLog);
      await fileTree.refresh();
      await runDev(addLog, (url) => {
        setPreviewUrl(url);
      });

      // Close modal on success
      setShowCredentialsModal(false);

      // Show success toast
      showToast({
        message: 'Backend applied successfully!',
        type: 'success',
      });
    } catch (error) {
      logErrorSafe('ApplyBackend', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setApplyError(errorMessage);
      showToast({
        message: 'Failed to apply backend. Please try again.',
        type: 'error',
      });
      // Keep modal open so user can retry
    } finally {
      setIsApplying(false);
    }
  }, [
    backendResult,
    backendRequirements,
    currentFiles,
    mount,
    install,
    runDev,
    showToast,
    fileTree.refresh,
  ]);

  return (
    <div className="builder-container">
      <TopBar
        projectName="App Builder Pro"
        state={builderState}
        onOpenSettings={() => setIsSettingsOpen(true)}
        hasGeneratedCode={currentFiles.length > 0}
        hasOAuthToken={isAuthenticated}
        isCreatingBackend={isCreatingBackend}
        onCreateBackend={handleOpenBackendModal}
        isVercelAuthenticated={isVercelAuthenticated}
        isDeploying={isDeploying}
        onDeploy={handleDeployClick}
      />

      <main className="builder-main">
        <PanelGroup direction="horizontal">
          {/* Left Panel: Chat */}
          <Panel defaultSize={25} minSize={20} className="panel-chat">
            <ChatPanel
              messages={messages}
              onSendMessage={handleNewMessage}
              isGenerating={builderState === 'generating' || builderState === 'installing'}
              onNewChat={handleNewChat}
            />
          </Panel>

          <PanelResizeHandle className="resize-handle" />

          {/* Right Panel: Preview / Editor */}
          <Panel defaultSize={75} className="panel-workspace">
            <div className="workspace-header">
              <div className="tabs">
                <button
                  className={`tab-btn \${activeTab === 'preview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('preview')}
                >
                  Preview
                </button>
                <button
                  className={`tab-btn \${activeTab === 'code' ? 'active' : ''}`}
                  onClick={() => setActiveTab('code')}
                >
                  Code
                </button>
              </div>
              <div className="workspace-actions">
                <button className="btn-icon" onClick={() => setShowExplorer(!showExplorer)}>
                  {showExplorer ? 'Hide Explorer' : 'Show Explorer'}
                </button>
              </div>
            </div>

            <div className="workspace-content">
              {builderState === 'error' ? (
                <BuildErrorPanel
                  message={
                    lastError ? getGenericErrorMessage(lastError) : 'An unexpected error occurred.'
                  }
                  onRetry={handleRetry}
                />
              ) : (
                <>
                  {activeTab === 'preview' ? (
                    <PreviewPanel state={builderState} url={previewUrl} />
                  ) : (
                    <div className="editor-layout">
                      {showExplorer && (
                        <FileExplorer
                          files={fileTree.files}
                          isLoading={fileTree.isLoading}
                          error={fileTree.error}
                          onRefresh={fileTree.refresh}
                          onFileSelect={handleFileSelect}
                          selectedPath={activeFile?.path}
                          onNewItem={handleNewItem}
                          onDeleteItem={handleDeleteItem}
                        />
                      )}
                      <CodeEditor
                        fileName={activeFile?.path || 'App.tsx'}
                        code={activeFile?.content || ''}
                        language={activeFile?.path.endsWith('.css') ? 'css' : 'typescript'}
                        onChange={handleEditorChange}
                        onSave={handleEditorSave}
                        onDirtyChange={setIsEditorDirty}
                        isSaving={isSavingFile}
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            <ConsolePanel logs={consoleLogs} onClear={clearLogs} onClose={() => {}} />
          </Panel>
        </PanelGroup>
      </main>

      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
      {isBackendModalOpen && (
        <BackendCreationModal
          stage={backendStage}
          progress={backendProgress}
          error={backendError}
          isCreating={isCreatingBackend}
          onRetry={handleRetryBackend}
          onClose={handleCloseBackendModal}
        />
      )}
      {showCredentialsModal && backendResult && (
        <CredentialsModal
          result={backendResult}
          requirements={backendRequirements}
          onClose={handleCloseCredentialsModal}
          onApply={handleApplyBackend}
          isApplying={isApplying}
        />
      )}
      {isDeployModalOpen && (
        <DeployModal
          stage={deployStage}
          progress={deployProgress}
          error={deployError}
          isDeploying={isDeploying}
          onRetry={handleRetryDeploy}
          onClose={handleCloseDeployModal}
          onAbort={handleAbortDeploy}
        />
      )}
      {showDeploySuccess && deployResult && (
        <DeploySuccess result={deployResult} onDone={handleCloseDeploySuccess} />
      )}
    </div>
  );
};

/**
 * Main BuilderPage component with ToastProvider wrapper
 */
const BuilderPage: React.FC<BuilderPageProps> = (props) => {
  return (
    <ToastProvider>
      <BuilderPageInner {...props} />
    </ToastProvider>
  );
};

export default BuilderPage;
