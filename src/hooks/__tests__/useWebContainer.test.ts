import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWebContainer } from '../useWebContainer';

// Mock WebContainerManager
vi.mock('../../services/webcontainer/WebContainerManager', () => ({
  WebContainerManager: {
    getInstance: vi.fn(),
  },
}));

import { WebContainerManager } from '../../services/webcontainer/WebContainerManager';

const mockWebContainerManager = {
  mount: vi.fn(),
  writeFile: vi.fn(),
  install: vi.fn(),
  runDev: vi.fn(),
  restartDev: vi.fn(),
  boot: vi.fn(),
};

describe('useWebContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (WebContainerManager.getInstance as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockWebContainerManager
    );
  });

  // ============ RED - Test: Hook initializes without errors ============
  it('initializes with default state', async () => {
    // Given
    // When
    const { result } = renderHook(() => useWebContainer());

    // Then - should have initial state values
    expect(result.current.isReady).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.mount).toBeDefined();
    expect(result.current.writeFile).toBeDefined();
    expect(result.current.install).toBeDefined();
    expect(result.current.runDev).toBeDefined();
  });

  // ============ RED - Test: mount resolves successfully ============
  it('mount mounts files and sets isReady to true', async () => {
    // Given
    const files = {
      'package.json': {
        file: {
          contents: '{}',
        },
      },
    };

    mockWebContainerManager.mount.mockResolvedValue(undefined);

    // When
    const { result } = renderHook(() => useWebContainer());

    await act(async () => {
      await result.current.mount(files);
    });

    // Then
    expect(mockWebContainerManager.mount).toHaveBeenCalledWith(files);
    expect(result.current.isReady).toBe(true);
    expect(result.current.error).toBe(null);
  });

  // ============ RED - Test: mount handles errors ============
  it('mount handles errors and sets error state', async () => {
    // Given
    const files = { 'package.json': { file: { contents: '{}' } } };
    const mountError = new Error('Mount failed');
    mockWebContainerManager.mount.mockRejectedValue(mountError);

    // When
    const { result } = renderHook(() => useWebContainer());

    let caughtError: Error | undefined;
    await act(async () => {
      try {
        await result.current.mount(files);
      } catch (e) {
        caughtError = e as Error;
      }
    });

    // Then
    expect(caughtError).toBe(mountError);
    expect(result.current.error).toBe(mountError);
  });

  // ============ RED - Test: writeFile calls manager ============
  it('writeFile writes content to file', async () => {
    // Given
    const filePath = 'src/index.js';
    const content = 'console.log("hello")';
    mockWebContainerManager.writeFile.mockResolvedValue(undefined);

    // When
    const { result } = renderHook(() => useWebContainer());

    await act(async () => {
      await result.current.writeFile(filePath, content);
    });

    // Then
    expect(mockWebContainerManager.writeFile).toHaveBeenCalledWith(filePath, content);
  });

  // ============ RED - Test: install returns exit code ============
  it('install runs npm install and returns exit code', async () => {
    // Given
    const exitCode = 0;
    mockWebContainerManager.install.mockResolvedValue(exitCode);
    const onLog = vi.fn();

    // When
    const { result } = renderHook(() => useWebContainer());

    let returnedCode: number | undefined;
    await act(async () => {
      returnedCode = await result.current.install(onLog);
    });

    // Then
    expect(mockWebContainerManager.install).toHaveBeenCalledWith(onLog);
    expect(returnedCode).toBe(exitCode);
  });

  // ============ RED - Test: runDev starts dev server ============
  it('runDev starts dev server with callbacks', async () => {
    // Given
    const processMock = { output: { pipeTo: vi.fn() } };
    mockWebContainerManager.runDev.mockResolvedValue(processMock);
    const onLog = vi.fn();
    const onReady = vi.fn();

    // When
    const { result } = renderHook(() => useWebContainer());

    await act(async () => {
      await result.current.runDev(onLog, onReady);
    });

    // Then
    expect(mockWebContainerManager.runDev).toHaveBeenCalledWith(onLog, onReady);
  });

  // ============ RED - Test: cleanup on unmount ============
  it('cleanup does not throw on unmount', () => {
    // Given

    // When
    const { result, unmount } = renderHook(() => useWebContainer());

    // Then - should not throw
    expect(() => unmount()).not.toThrow();
  });

  // ============ ER-008: restartDev delegates to WCM.restartDev ============
  it('restartDev calls WCM.restartDev with callbacks', async () => {
    // Given
    const processMock = { output: { pipeTo: vi.fn() } };
    mockWebContainerManager.restartDev.mockResolvedValue(processMock);
    const onLog = vi.fn();
    const onReady = vi.fn();

    // When
    const { result } = renderHook(() => useWebContainer());

    await act(async () => {
      await result.current.restartDev(onLog, onReady);
    });

    // Then
    expect(mockWebContainerManager.restartDev).toHaveBeenCalledWith(onLog, onReady);
  });

  it('restartDev is exposed in hook return type', () => {
    // Given
    const { result } = renderHook(() => useWebContainer());

    // Then — restartDev function exists in the return
    expect(result.current.restartDev).toBeDefined();
    expect(typeof result.current.restartDev).toBe('function');
  });
});
