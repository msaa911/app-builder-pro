/**
 * useVercelDeploy hook tests
 *
 * Tests deploy pipeline orchestration:
 * - Stage transitions (PREPARING → DEPLOYING → WAITING → COMPLETE)
 * - Progress updates at each stage
 * - Error handling with retry
 * - Abort support
 * - Reset functionality
 *
 * @module hooks/deploy/__tests__
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DeployStage } from '../types';
import type { ProjectFile } from '../../../types';
import type {
  VercelDeploymentResponse,
  VercelDeploymentState,
} from '../../../services/deploy/types';

// ── Mutable mock state ──────────────────────────────────────────────
// Allows per-test control of auth behavior without vi.resetModules
let mockGetTokenReturn: string | null = 'test-token-xyz';
let mockIsAuthenticated: boolean = true;

// Mock the service layer
vi.mock('../../../services/deploy/filePrep', () => ({
  prepareFiles: vi.fn().mockImplementation((files: { path: string; content: string }[]) => {
    if (files.length === 0) throw new Error('No files to deploy');
    return files.map((f) => ({
      file: f.path,
      data: btoa(f.content),
      encoding: 'base64',
    }));
  }),
}));

vi.mock('../../../services/deploy/vercelApi', () => ({
  createDeployment: vi.fn().mockResolvedValue({
    id: 'dep_test123',
    url: 'https://my-app.vercel.app',
    state: 'BUILDING',
  }),
  pollDeployment: vi.fn().mockResolvedValue({
    id: 'dep_test123',
    url: 'https://my-app.vercel.app',
    state: 'READY',
  }),
}));

vi.mock('../useVercelOAuth', () => ({
  useVercelOAuth: () => ({
    getToken: () => mockGetTokenReturn,
    isAuthenticated: mockIsAuthenticated,
    status: mockIsAuthenticated ? 'authenticated' : 'idle',
    error: null,
    login: vi.fn(),
    exchangeCode: vi.fn(),
    logout: vi.fn(),
  }),
}));

import { useVercelDeploy } from '../useVercelDeploy';
import { prepareFiles } from '../../../services/deploy/filePrep';
import { createDeployment, pollDeployment } from '../../../services/deploy/vercelApi';

const mockPrepareFiles = vi.mocked(prepareFiles);
const mockCreateDeployment = vi.mocked(createDeployment);
const mockPollDeployment = vi.mocked(pollDeployment);

beforeEach(() => {
  // Reset auth mock to default (authenticated)
  mockGetTokenReturn = 'test-token-xyz';
  mockIsAuthenticated = true;

  vi.clearAllMocks();
  mockPrepareFiles.mockImplementation((files: ProjectFile[]) => {
    if (files.length === 0) throw new Error('No files to deploy');
    return files.map((f) => ({
      file: f.path,
      data: btoa(f.content ?? ''),
      encoding: 'base64' as const,
    }));
  });
  mockCreateDeployment.mockResolvedValue({
    id: 'dep_test123',
    url: 'https://my-app.vercel.app',
    state: 'BUILDING',
  });
  mockPollDeployment.mockResolvedValue({
    id: 'dep_test123',
    url: 'https://my-app.vercel.app',
    state: 'READY',
  });
});

describe('useVercelDeploy', () => {
  const sampleFiles = [
    { path: 'src/App.tsx', content: 'export default function App() {}' },
    { path: 'index.html', content: '<html></html>' },
  ];

  it('should start in IDLE stage with 0 progress', () => {
    const { result } = renderHook(() => useVercelDeploy());

    expect(result.current.stage).toBe(DeployStage.IDLE);
    expect(result.current.progress).toBe(0);
    expect(result.current.isDeploying).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
  });

  it('should transition through PREPARING → DEPLOYING → WAITING → COMPLETE on successful deploy', async () => {
    const { result } = renderHook(() => useVercelDeploy());

    await act(async () => {
      await result.current.deploy(sampleFiles, { projectName: 'test-app' });
    });

    expect(result.current.stage).toBe(DeployStage.COMPLETE);
    expect(result.current.result).toBeTruthy();
    expect(result.current.result!.url).toBe('https://my-app.vercel.app');
    expect(result.current.result!.deploymentId).toBe('dep_test123');
    expect(result.current.result!.projectName).toBe('test-app');
    expect(result.current.isDeploying).toBe(false);
  });

  it('should call prepareFiles with project files', async () => {
    const { result } = renderHook(() => useVercelDeploy());

    await act(async () => {
      await result.current.deploy(sampleFiles);
    });

    expect(mockPrepareFiles).toHaveBeenCalledWith(sampleFiles);
  });

  it('should call createDeployment with prepared files and token', async () => {
    const { result } = renderHook(() => useVercelDeploy());

    await act(async () => {
      await result.current.deploy(sampleFiles, { projectName: 'my-project' });
    });

    expect(mockCreateDeployment).toHaveBeenCalledWith(
      'test-token-xyz',
      expect.arrayContaining([
        expect.objectContaining({ file: 'src/App.tsx', encoding: 'base64' }),
      ]),
      'my-project'
    );
  });

  it('should call pollDeployment after deployment creation', async () => {
    const { result } = renderHook(() => useVercelDeploy());

    await act(async () => {
      await result.current.deploy(sampleFiles);
    });

    // pollDeployment is called with (deploymentId, token)
    expect(mockPollDeployment).toHaveBeenCalledWith('dep_test123', 'test-token-xyz');
  });

  it('should set ERROR stage when prepareFiles throws', async () => {
    mockPrepareFiles.mockImplementationOnce(() => {
      throw new Error('No files to deploy');
    });

    const { result } = renderHook(() => useVercelDeploy());

    await act(async () => {
      await result.current.deploy([], { projectName: 'fail-app' });
    });

    expect(result.current.stage).toBe(DeployStage.ERROR);
    expect(result.current.error).toContain('No files to deploy');
    expect(result.current.isDeploying).toBe(false);
  });

  it('should set ERROR stage when createDeployment fails', async () => {
    mockCreateDeployment.mockRejectedValueOnce(new Error('Vercel API error: 401'));

    const { result } = renderHook(() => useVercelDeploy());

    await act(async () => {
      await result.current.deploy(sampleFiles);
    });

    expect(result.current.stage).toBe(DeployStage.ERROR);
    expect(result.current.error).toContain('401');
  });

  it('should set ERROR stage when pollDeployment fails', async () => {
    mockPollDeployment.mockRejectedValueOnce(new Error('Deployment timed out'));

    const { result } = renderHook(() => useVercelDeploy());

    await act(async () => {
      await result.current.deploy(sampleFiles);
    });

    expect(result.current.stage).toBe(DeployStage.ERROR);
    expect(result.current.error).toContain('timed out');
  });

  it('should retry from beginning after error', async () => {
    // First deploy call: createDeployment rejects
    mockCreateDeployment.mockRejectedValueOnce(new Error('API error'));

    const { result } = renderHook(() => useVercelDeploy());

    await act(async () => {
      await result.current.deploy(sampleFiles, { projectName: 'retry-app' });
    });

    expect(result.current.stage).toBe(DeployStage.ERROR);
    expect(result.current.error).toContain('API error');

    // Set up mocks for the retry: createDeployment succeeds, pollDeployment succeeds
    mockCreateDeployment.mockResolvedValueOnce({
      id: 'dep_retry',
      url: 'https://retry-app.vercel.app',
      state: 'BUILDING',
    });
    mockPollDeployment.mockResolvedValueOnce({
      id: 'dep_retry',
      url: 'https://retry-app.vercel.app',
      state: 'READY',
    });

    await act(async () => {
      const retried = result.current.retry();
      expect(retried).toBe(true);
      // Wait for the async pipeline to complete
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(result.current.stage).toBe(DeployStage.COMPLETE);
    expect(result.current.result!.url).toBe('https://retry-app.vercel.app');
  });

  it('should reset all state on reset()', async () => {
    const { result } = renderHook(() => useVercelDeploy());

    await act(async () => {
      await result.current.deploy(sampleFiles);
    });

    expect(result.current.stage).toBe(DeployStage.COMPLETE);

    act(() => {
      result.current.reset();
    });

    expect(result.current.stage).toBe(DeployStage.IDLE);
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
  });

  it('should return false from retry when stage is not ERROR', () => {
    const { result } = renderHook(() => useVercelDeploy());

    // In IDLE stage, retry should return false
    act(() => {
      const retried = result.current.retry();
      expect(retried).toBe(false);
    });
  });

  it('should return false from retry when no stored files', async () => {
    const { result } = renderHook(() => useVercelDeploy());

    // Use reset first to clear, then manually check retry
    act(() => {
      result.current.reset();
    });

    // After reset, stage is IDLE, so retry returns false
    const retried = result.current.retry();
    expect(retried).toBe(false);
  });

  it('should return false from retry when in ERROR stage but stored files are empty', async () => {
    // Deploy with empty files array → prepareFiles throws → ERROR stage
    // but lastFilesRef.current is [] (empty), so retry should return false (line 181)
    mockPrepareFiles.mockImplementationOnce(() => {
      throw new Error('No files to deploy');
    });

    const { result } = renderHook(() => useVercelDeploy());

    // Deploy with empty files — triggers ERROR but stores [] in lastFilesRef
    await act(async () => {
      await result.current.deploy([], { projectName: 'empty-app' });
    });

    expect(result.current.stage).toBe(DeployStage.ERROR);

    // Retry with empty stored files should return false (line 181)
    const retried = result.current.retry();
    expect(retried).toBe(false);
  });

  it('should abort a running pipeline and set error', async () => {
    // Strategy: make createDeployment hang so we can catch the deploy mid-flight
    let resolvePending!: () => void;
    const pendingPromise = new Promise<VercelDeploymentResponse>((resolve) => {
      resolvePending = () =>
        resolve({
          id: 'dep_test123',
          url: 'https://test.vercel.app',
          state: 'READY' as VercelDeploymentState,
        });
    });
    mockCreateDeployment.mockReturnValueOnce(pendingPromise);

    const { result } = renderHook(() => useVercelDeploy());

    // Start deploy — synchronous part sets isDeploying=true, then awaits createDeployment
    await act(async () => {
      result.current.deploy(sampleFiles);
      // Flush microtasks so the async deploy reaches the await point
      await new Promise((r) => setTimeout(r, 10));
    });

    // Deploy should be in progress (hanging at DEPLOYING stage)
    expect(result.current.isDeploying).toBe(true);

    // Now abort the pipeline
    let aborted: boolean | undefined;
    act(() => {
      aborted = result.current.abort();
    });

    expect(aborted).toBe(true);
    expect(result.current.isDeploying).toBe(false);
    expect(result.current.stage).toBe(DeployStage.IDLE);
    expect(result.current.error).toBe('Pipeline aborted by user');

    // Resolve the pending promise so the test doesn't leak
    resolvePending();
  });

  it('should return false from abort when not deploying', () => {
    const { result } = renderHook(() => useVercelDeploy());

    act(() => {
      const aborted = result.current.abort();
      expect(aborted).toBe(false);
    });
  });

  it('should auto-generate project name when not provided', async () => {
    const { result } = renderHook(() => useVercelDeploy());

    await act(async () => {
      await result.current.deploy(sampleFiles); // no projectName
    });

    expect(result.current.result!.projectName).toMatch(/^app-\d+$/);
  });

  it('should handle non-Error thrown values', async () => {
    mockPrepareFiles.mockImplementationOnce(() => {
      throw 'string error';
    });

    const { result } = renderHook(() => useVercelDeploy());

    await act(async () => {
      await result.current.deploy(sampleFiles);
    });

    expect(result.current.stage).toBe(DeployStage.ERROR);
    // Non-Error values get wrapped: "File preparation failed: Unknown error"
    expect(result.current.error).toBe('File preparation failed: Unknown error');
  });

  it('should set ERROR when not authenticated (isAuthenticated=false)', async () => {
    // Override auth mock for this test only
    mockIsAuthenticated = false;

    const { result } = renderHook(() => useVercelDeploy());

    await act(async () => {
      await result.current.deploy(sampleFiles);
    });

    expect(result.current.stage).toBe(DeployStage.ERROR);
    expect(result.current.error).toContain('Authentication');

    // Restore default
    mockIsAuthenticated = true;
  });

  it('should set ERROR when token is null but isAuthenticated is true', async () => {
    // This tests the second auth check: getToken returns null
    mockGetTokenReturn = null;
    mockIsAuthenticated = true;

    const { result } = renderHook(() => useVercelDeploy());

    await act(async () => {
      await result.current.deploy(sampleFiles);
    });

    expect(result.current.stage).toBe(DeployStage.ERROR);
    expect(result.current.error).toContain('Authentication');

    // Restore defaults
    mockGetTokenReturn = 'test-token-xyz';
    mockIsAuthenticated = true;
  });
});
