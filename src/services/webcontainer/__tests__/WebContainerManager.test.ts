import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebContainerManager } from '../WebContainerManager';
import type { FileSystemTree } from '@/types';
import type { ProjectFile } from '@/types';

// ============================================
// MOCK SETUP - vi.mock creates everything inside
// ============================================

// Use vi.hoisted to access the mocks after vi.mock is called
const { mockContainer, mockBoot, createMockProcess } = vi.hoisted(() => {
  // Factory to create controlled dev processes with resolvable exit promises
  const createMockProcess = () => {
    let exitResolve!: (code: number) => void;
    const exitPromise = new Promise<number>((resolve) => {
      exitResolve = resolve;
    });
    return {
      output: {
        pipeTo: vi.fn(),
      },
      exit: exitPromise,
      kill: vi.fn(),
      _exitResolve: exitResolve,
    };
  };

  const container = {
    mount: vi.fn().mockResolvedValue(undefined),
    spawn: vi.fn().mockResolvedValue(createMockProcess()),
    fs: {
      readFile: vi.fn().mockResolvedValue(new TextEncoder().encode('file contents')),
      writeFile: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockResolvedValue(undefined),
      rm: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn().mockResolvedValue([]),
    },
    on: vi.fn(),
  };

  return {
    mockContainer: container,
    mockBoot: vi.fn().mockResolvedValue(container),
    createMockProcess,
  };
});

// Mock for readDirRecursive — returns controlled ProjectFile[]
const { mockReadDirRecursive } = vi.hoisted(() => ({
  mockReadDirRecursive: vi.fn<(...args: unknown[]) => Promise<ProjectFile[]>>(),
}));

// Mock BEFORE importing WebContainerManager - hoisted to top by Vitest
vi.mock('@webcontainer/api', () => ({
  WebContainer: {
    boot: mockBoot,
  },
}));

vi.mock('../readDirRecursive', () => ({
  readDirRecursive: mockReadDirRecursive,
}));

// Sample file system tree for testing
const sampleFileTree: FileSystemTree = {
  'index.html': {
    file: {
      contents: '<!DOCTYPE html><html><body>Hello World</body></html>',
    },
  },
  src: {
    directory: {
      'main.ts': {
        file: {
          contents: 'console.log("hello");',
        },
      },
    },
  },
};

describe('WebContainerManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the singleton
    (WebContainerManager as any).instance = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
    (WebContainerManager as any).instance = null;
  });

  describe('getInstance', () => {
    it('returns a singleton instance', async () => {
      // Given - WebContainer is already booted by vi.mock

      // When
      const instance1 = await WebContainerManager.getInstance();
      const instance2 = await WebContainerManager.getInstance();

      // Then
      expect(instance1).toBe(instance2);
    });

    it('boots WebContainer on first call', async () => {
      // When
      await WebContainerManager.getInstance();

      // Then
      expect(mockBoot).toHaveBeenCalledTimes(1);
    });
  });

  describe('mount', () => {
    it('mounts file tree successfully', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();

      // When
      await manager.mount(sampleFileTree);

      // Then
      expect(mockContainer.mount).toHaveBeenCalledWith(sampleFileTree);
    });

    it('boots WebContainer if not already booted', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();
      mockContainer.mount.mockClear();

      // When
      await manager.mount(sampleFileTree);

      // Then
      expect(mockContainer.mount).toHaveBeenCalledWith(sampleFileTree);
    });
  });

  describe('writeFile', () => {
    it('writes file to container', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();

      // When
      await manager.writeFile('/src/index.ts', 'const x = 1;');

      // Then
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith('/src/index.ts', 'const x = 1;');
    });

    it('boots WebContainer if not already booted', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();
      mockContainer.fs.writeFile.mockClear();

      // When
      await manager.writeFile('/src/index.ts', 'const x = 1;');

      // Then
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith('/src/index.ts', 'const x = 1;');
    });
  });

  describe('readFile', () => {
    it('reads file from container', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();

      // When
      const content = await manager.readFile('/src/index.ts');

      // Then
      expect(mockContainer.fs.readFile).toHaveBeenCalledWith('/src/index.ts');
      expect(content).toBe('file contents');
    });

    it('boots WebContainer if not already booted', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();
      mockContainer.fs.readFile.mockClear();

      // When
      await manager.readFile('/src/index.ts');

      // Then
      expect(mockContainer.fs.readFile).toHaveBeenCalledWith('/src/index.ts');
    });
  });

  describe('readDir', () => {
    it('delegates to readDirRecursive with booted WC fs and default path "/"', async () => {
      // Given
      const expectedFiles: ProjectFile[] = [
        { path: 'src/App.tsx', content: '' },
        { path: 'index.html', content: '' },
      ];
      mockReadDirRecursive.mockResolvedValue(expectedFiles);
      const manager = await WebContainerManager.getInstance();

      // When
      const result = await manager.readDir();

      // Then
      expect(mockReadDirRecursive).toHaveBeenCalledWith(mockContainer.fs, '/');
      expect(result).toEqual(expectedFiles);
    });

    it('delegates to readDirRecursive with custom dirPath', async () => {
      // Given
      const srcFiles: ProjectFile[] = [
        { path: 'App.tsx', content: '' },
        { path: 'index.ts', content: '' },
      ];
      mockReadDirRecursive.mockResolvedValue(srcFiles);
      const manager = await WebContainerManager.getInstance();

      // When
      const result = await manager.readDir('/src');

      // Then
      expect(mockReadDirRecursive).toHaveBeenCalledWith(mockContainer.fs, '/src');
      expect(result).toEqual(srcFiles);
    });

    it('throws "WebContainer is not booted" when webcontainerInstance is null', async () => {
      // Given — create a fresh WCM without booting
      const manager = new (WebContainerManager as any)();

      // When & Then
      await expect(manager.readDir('/')).rejects.toThrow('WebContainer is not booted');
    });

    it('throws error with exact message content before boot', async () => {
      // Given — create a fresh WCM without booting
      const manager = new (WebContainerManager as any)();

      // When & Then
      try {
        await manager.readDir('/');
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('WebContainer is not booted');
      }
    });
  });

  describe('install', () => {
    it('runs npm install', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();
      const installProcess = createMockProcess();
      mockContainer.spawn.mockResolvedValueOnce(installProcess);

      // When
      const exitPromise = manager.install();
      installProcess._exitResolve(0);
      const exitCode = await exitPromise;

      // Then
      expect(mockContainer.spawn).toHaveBeenCalledWith('npm', ['install']);
      expect(exitCode).toBe(0);
    });

    it('calls onLog callback with output', async () => {
      // Given
      const onLog = vi.fn();
      const manager = await WebContainerManager.getInstance();
      const installProcess = createMockProcess();
      mockContainer.spawn.mockResolvedValueOnce(installProcess);

      // When
      const exitPromise = manager.install(onLog);
      installProcess._exitResolve(0);
      await exitPromise;

      // Then - onLog gets called through pipeTo
      expect(mockContainer.spawn).toHaveBeenCalledWith('npm', ['install']);
    });

    it('boots WebContainer if not already booted', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();
      const installProcess = createMockProcess();
      mockContainer.spawn.mockResolvedValueOnce(installProcess);
      mockContainer.spawn.mockClear();

      // When
      const exitPromise = manager.install();
      installProcess._exitResolve(0);
      await exitPromise;

      // Then
      expect(mockContainer.spawn).toHaveBeenCalledWith('npm', ['install']);
    });
  });

  describe('runDev', () => {
    it('starts npm run dev', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();

      // When
      const process = await manager.runDev();

      // Then
      expect(mockContainer.spawn).toHaveBeenCalledWith('npm', ['run', 'dev']);
      expect(mockContainer.on).toHaveBeenCalledWith('server-ready', expect.any(Function));
    });

    it('calls onReady callback with server URL', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();
      const onReady = vi.fn();

      // When
      await manager.runDev(undefined, onReady);

      // Then - trigger the server-ready event
      const serverReadyCallback = mockContainer.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'server-ready'
      )?.[1] as ((port: number, url: string) => void) | undefined;

      if (serverReadyCallback) {
        serverReadyCallback(3000, 'http://localhost:3000');
      }
      expect(onReady).toHaveBeenCalledWith('http://localhost:3000');
    });

    it('boots WebContainer if not already booted', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();
      mockContainer.spawn.mockClear();

      // When
      await manager.runDev();

      // Then
      expect(mockContainer.spawn).toHaveBeenCalledWith('npm', ['run', 'dev']);
    });
  });

  describe('_isWriting flag', () => {
    it('is true during writeFile execution', async () => {
      // Given — mock fs.writeFile to capture flag state during execution
      let flagDuringWrite: boolean | undefined;
      mockContainer.fs.writeFile.mockImplementationOnce(async () => {
        const manager = await WebContainerManager.getInstance();
        flagDuringWrite = (manager as any)._isWriting;
      });
      const manager = await WebContainerManager.getInstance();

      // When — call writeFile
      await manager.writeFile('/src/App.tsx', 'content');

      // Then — _isWriting was true while fs.writeFile was running
      expect(flagDuringWrite).toBe(true);
    });

    it('is false after writeFile completes', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();

      // When — call writeFile
      await manager.writeFile('/src/App.tsx', 'content');

      // Then — _isWriting is false after completion
      expect((manager as any)._isWriting).toBe(false);
    });

    it('is false after writeFile fails', async () => {
      // Given — mock fs.writeFile to reject
      mockContainer.fs.writeFile.mockRejectedValueOnce(new Error('Write failed'));
      const manager = await WebContainerManager.getInstance();

      // When — call writeFile (it throws)
      await expect(manager.writeFile('/src/App.tsx', 'content')).rejects.toThrow('Write failed');

      // Then — _isWriting is still false even after failure
      expect((manager as any)._isWriting).toBe(false);

      // Reset
      mockContainer.fs.writeFile.mockResolvedValue(undefined);
    });

    it('exposes isWriting getter that returns false initially', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();

      // Then — isWriting getter returns false
      expect(manager.isWriting).toBe(false);
    });
  });

  describe('mkdir', () => {
    it('creates directory successfully', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();

      // When
      await manager.mkdir('/src/new-folder');

      // Then — no options passed, so only dirPath argument
      expect(mockContainer.fs.mkdir).toHaveBeenCalledWith('/src/new-folder');
    });

    it('creates directory with recursive option', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();

      // When
      await manager.mkdir('/src/a/b/c', { recursive: true });

      // Then
      expect(mockContainer.fs.mkdir).toHaveBeenCalledWith('/src/a/b/c', { recursive: true });
    });

    it('throws when not booted', async () => {
      // Given — create a fresh WCM without booting
      const manager = new (WebContainerManager as any)();

      // When & Then
      await expect(manager.mkdir('/any/path')).rejects.toThrow('WebContainer is not booted');
    });

    it('sets _isWriting flag to true during execution', async () => {
      // Given — mock fs.mkdir to capture flag state during execution
      let flagDuringMkdir: boolean | undefined;
      mockContainer.fs.mkdir.mockImplementationOnce(async () => {
        const manager = await WebContainerManager.getInstance();
        flagDuringMkdir = (manager as any)._isWriting;
      });
      const manager = await WebContainerManager.getInstance();

      // When
      await manager.mkdir('/new-dir', { recursive: true });

      // Then — _isWriting was true while fs.mkdir was running
      expect(flagDuringMkdir).toBe(true);
    });

    it('clears _isWriting flag after mkdir completes', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();

      // When
      await manager.mkdir('/new-dir', { recursive: true });

      // Then — _isWriting is false after completion
      expect((manager as any)._isWriting).toBe(false);
    });

    it('clears _isWriting flag after mkdir fails', async () => {
      // Given — mock fs.mkdir to reject
      mockContainer.fs.mkdir.mockRejectedValueOnce(new Error('Mkdir failed'));
      const manager = await WebContainerManager.getInstance();

      // When — call mkdir (it throws)
      await expect(manager.mkdir('/invalid')).rejects.toThrow('Mkdir failed');

      // Then — _isWriting is still false even after failure
      expect((manager as any)._isWriting).toBe(false);

      // Reset
      mockContainer.fs.mkdir.mockResolvedValue(undefined);
    });
  });

  describe('rm', () => {
    it('delegates to fs.rm for file deletion', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();

      // When
      await manager.rm('/src/utils.ts');

      // Then
      expect(mockContainer.fs.rm).toHaveBeenCalledWith('/src/utils.ts', undefined);
    });

    it('passes recursive option for folder deletion', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();

      // When
      await manager.rm('/src/components', { recursive: true });

      // Then
      expect(mockContainer.fs.rm).toHaveBeenCalledWith('/src/components', { recursive: true });
    });

    it('passes force option for non-existent path tolerance', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();

      // When
      await manager.rm('/maybe/missing.ts', { force: true });

      // Then
      expect(mockContainer.fs.rm).toHaveBeenCalledWith('/maybe/missing.ts', { force: true });
    });

    it('passes both recursive and force options together', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();

      // When
      await manager.rm('/src/old-folder', { recursive: true, force: true });

      // Then
      expect(mockContainer.fs.rm).toHaveBeenCalledWith('/src/old-folder', {
        recursive: true,
        force: true,
      });
    });

    it('throws "WebContainer is not booted" when not booted', async () => {
      // Given — create a fresh WCM without booting
      const manager = new (WebContainerManager as any)();

      // When & Then
      await expect(manager.rm('/any/path')).rejects.toThrow('WebContainer is not booted');
    });

    it('throws when not booted with exact error message', async () => {
      // Given — create a fresh WCM without booting
      const manager = new (WebContainerManager as any)();

      // When & Then
      try {
        await manager.rm('/any/path');
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('WebContainer is not booted');
      }
    });

    it('sets _isWriting flag to true during rm execution', async () => {
      // Given — mock fs.rm to capture flag state during execution
      let flagDuringRm: boolean | undefined;
      mockContainer.fs.rm.mockImplementationOnce(async () => {
        const manager = await WebContainerManager.getInstance();
        flagDuringRm = (manager as any)._isWriting;
      });
      const manager = await WebContainerManager.getInstance();

      // When
      await manager.rm('/src/old.ts');

      // Then — _isWriting was true while fs.rm was running
      expect(flagDuringRm).toBe(true);
    });

    it('clears _isWriting flag after rm completes', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();

      // When
      await manager.rm('/src/old.ts');

      // Then — _isWriting is false after completion
      expect((manager as any)._isWriting).toBe(false);
    });

    it('clears _isWriting flag after rm fails', async () => {
      // Given — mock fs.rm to reject
      mockContainer.fs.rm.mockRejectedValueOnce(new Error('Rm failed'));
      const manager = await WebContainerManager.getInstance();

      // When — call rm (it throws)
      await expect(manager.rm('/invalid')).rejects.toThrow('Rm failed');

      // Then — _isWriting is still false even after failure
      expect((manager as any)._isWriting).toBe(false);

      // Reset
      mockContainer.fs.rm.mockResolvedValue(undefined);
    });

    it('rejects deletion of protected path /package.json', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();

      // When & Then
      await expect(manager.rm('/package.json')).rejects.toThrow(
        'Cannot delete protected path: /package.json'
      );
      // Verify fs.rm was never called
      expect(mockContainer.fs.rm).not.toHaveBeenCalled();
    });

    it('rejects deletion of protected path /vite.config.ts', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();

      // When & Then
      await expect(manager.rm('/vite.config.ts')).rejects.toThrow(
        'Cannot delete protected path: /vite.config.ts'
      );
      expect(mockContainer.fs.rm).not.toHaveBeenCalled();
    });

    it('rejects deletion of protected path /index.html', async () => {
      // Given
      const manager = await WebContainerManager.getInstance();

      // When & Then
      await expect(manager.rm('/index.html')).rejects.toThrow(
        'Cannot delete protected path: /index.html'
      );
      expect(mockContainer.fs.rm).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('throws when boot fails', async () => {
      // Given
      mockBoot.mockRejectedValueOnce(new Error('Boot failed'));
      (WebContainerManager as any).instance = null;

      // When & Then
      await expect(WebContainerManager.getInstance()).rejects.toThrow('Boot failed');

      // Reset for other tests
      mockBoot.mockResolvedValue(mockContainer);
    });

    it('throws when mount fails', async () => {
      // Given
      mockContainer.mount.mockRejectedValueOnce(new Error('Mount failed'));
      const manager = await WebContainerManager.getInstance();

      // When & Then
      await expect(manager.mount(sampleFileTree)).rejects.toThrow('Mount failed');

      // Reset
      mockContainer.mount.mockResolvedValue(undefined);
    });

    it('throws when writeFile fails', async () => {
      // Given
      mockContainer.fs.writeFile.mockRejectedValueOnce(new Error('Write failed'));
      const manager = await WebContainerManager.getInstance();

      // When & Then
      await expect(manager.writeFile('/src/index.ts', 'content')).rejects.toThrow('Write failed');

      // Reset
      mockContainer.fs.writeFile.mockResolvedValue(undefined);
    });

    it('throws when readFile fails', async () => {
      // Given
      mockContainer.fs.readFile.mockRejectedValueOnce(new Error('Read failed'));
      const manager = await WebContainerManager.getInstance();

      // When & Then
      await expect(manager.readFile('/src/index.ts')).rejects.toThrow('Read failed');

      // Reset
      mockContainer.fs.readFile.mockResolvedValue(new TextEncoder().encode('file contents'));
    });
  });

  // ============================================
  // PWU-001, PWU-003: updateFiles — batch file writes without remount
  // ============================================
  describe('updateFiles', () => {
    it('writes each file via writeFile, creating parent dirs with mkdir recursive', async () => {
      // Given — PWU-001
      const manager = await WebContainerManager.getInstance();
      const files: ProjectFile[] = [
        { path: '/src/components/App.tsx', content: 'export default function App() {}' },
        { path: '/src/styles.css', content: 'body { margin: 0; }' },
      ];

      // When
      await manager.updateFiles(files);

      // Then — mkdir called for parent dirs, writeFile called for each file
      expect(mockContainer.fs.mkdir).toHaveBeenCalledWith('/src/components', { recursive: true });
      expect(mockContainer.fs.mkdir).toHaveBeenCalledWith('/src', { recursive: true });
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        '/src/components/App.tsx',
        'export default function App() {}'
      );
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        '/src/styles.css',
        'body { margin: 0; }'
      );
    });

    it('sets _isWriting flag to true during entire batch', async () => {
      // Given — PWU-003: capture flag state during file writes
      const flagsDuringWrite: boolean[] = [];
      mockContainer.fs.writeFile.mockImplementation(async () => {
        const manager = await WebContainerManager.getInstance();
        flagsDuringWrite.push((manager as any)._isWriting);
      });
      const manager = await WebContainerManager.getInstance();
      const files: ProjectFile[] = [
        { path: '/src/A.tsx', content: 'A' },
        { path: '/src/B.tsx', content: 'B' },
      ];

      // When
      await manager.updateFiles(files);

      // Then — _isWriting was true for ALL writes in the batch
      expect(flagsDuringWrite.every((f) => f === true)).toBe(true);
    });

    it('clears _isWriting flag after batch completes', async () => {
      // Given — PWU-003
      const manager = await WebContainerManager.getInstance();

      // When
      await manager.updateFiles([{ path: '/src/App.tsx', content: 'code' }]);

      // Then
      expect((manager as any)._isWriting).toBe(false);
    });

    it('clears _isWriting flag after batch fails', async () => {
      // Given — error propagation, partial state accepted
      mockContainer.fs.writeFile.mockRejectedValueOnce(new Error('Write failed'));
      const manager = await WebContainerManager.getInstance();

      // When
      await expect(
        manager.updateFiles([{ path: '/src/App.tsx', content: 'code' }])
      ).rejects.toThrow('Write failed');

      // Then — flag is reset even after failure
      expect((manager as any)._isWriting).toBe(false);

      // Reset
      mockContainer.fs.writeFile.mockResolvedValue(undefined);
    });

    it('propagates error on mid-batch failure — partial state accepted', async () => {
      // Given — PWU-001: first file succeeds, second fails
      mockContainer.fs.writeFile.mockRejectedValueOnce(new Error('Disk full'));
      const manager = await WebContainerManager.getInstance();
      const files: ProjectFile[] = [
        { path: '/src/A.tsx', content: 'A code' },
        { path: '/src/B.tsx', content: 'B code' },
      ];

      // When & Then
      await expect(manager.updateFiles(files)).rejects.toThrow('Disk full');

      // Reset
      mockContainer.fs.writeFile.mockResolvedValue(undefined);
    });

    it('handles files at root level (no parent dir needed)', async () => {
      // Given — file at root, parent is '/'
      const manager = await WebContainerManager.getInstance();
      const files: ProjectFile[] = [{ path: '/index.html', content: '<html></html>' }];

      // When
      await manager.updateFiles(files);

      // Then — no mkdir call for root-level files (parent is '/')
      expect(mockContainer.fs.mkdir).not.toHaveBeenCalled();
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith('/index.html', '<html></html>');
    });

    it('throws when WebContainer is not booted', async () => {
      // Given — create a fresh WCM without booting
      const manager = new (WebContainerManager as any)();

      // When & Then
      await expect(
        manager.updateFiles([{ path: '/src/App.tsx', content: 'code' }])
      ).rejects.toThrow('WebContainer is not booted');
    });
  });

  // ============================================
  // ER-006 to ER-010: Dev process lifecycle management
  // ============================================
  describe('dev process lifecycle', () => {
    it('stores dev process reference after runDev() — isDevRunning becomes true', async () => {
      // Given — ER-006
      const mockProcess = createMockProcess();
      mockContainer.spawn.mockResolvedValueOnce(mockProcess);
      const manager = await WebContainerManager.getInstance();

      // When
      await manager.runDev();

      // Then — isDevRunning reflects stored process
      expect(manager.isDevRunning).toBe(true);
    });

    it('killDev() calls kill() on stored dev process and sets isDevRunning=false', async () => {
      // Given — ER-007
      const mockProcess = createMockProcess();
      mockContainer.spawn.mockResolvedValueOnce(mockProcess);
      const manager = await WebContainerManager.getInstance();
      await manager.runDev();
      expect(manager.isDevRunning).toBe(true);

      // When
      await manager.killDev();

      // Then
      expect(mockProcess.kill).toHaveBeenCalled();
      expect(manager.isDevRunning).toBe(false);
    });

    it('killDev() is a no-op when no dev process is running', async () => {
      // Given — ER-007 (no process running)
      const manager = await WebContainerManager.getInstance();

      // When — should not throw
      await manager.killDev();

      // Then — no error, isDevRunning still false
      expect(manager.isDevRunning).toBe(false);
    });

    it('restartDev() kills old process and spawns new one', async () => {
      // Given — ER-008
      const oldProcess = createMockProcess();
      const newProcess = createMockProcess();
      mockContainer.spawn.mockResolvedValueOnce(oldProcess);
      mockContainer.spawn.mockResolvedValueOnce(newProcess);
      const manager = await WebContainerManager.getInstance();
      await manager.runDev();
      expect(manager.isDevRunning).toBe(true);

      // When
      const result = await manager.restartDev();

      // Then — old process killed, new process spawned
      expect(oldProcess.kill).toHaveBeenCalled();
      expect(mockContainer.spawn).toHaveBeenCalledTimes(2); // first runDev + restartDev
      expect(manager.isDevRunning).toBe(true);
    });

    it('restartDev() calls onReady with new URL when server is ready', async () => {
      // Given — ER-008
      const newProcess = createMockProcess();
      mockContainer.spawn.mockResolvedValueOnce(newProcess);
      const manager = await WebContainerManager.getInstance();
      const onReady = vi.fn();

      // When
      await manager.restartDev(undefined, onReady);

      // Then — trigger server-ready event
      const serverReadyCallback = mockContainer.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'server-ready'
      )?.[1] as ((port: number, url: string) => void) | undefined;
      if (serverReadyCallback) {
        serverReadyCallback(5173, 'http://localhost:5173');
      }
      expect(onReady).toHaveBeenCalledWith('http://localhost:5173');
    });

    it('isDevRunning getter returns false initially', async () => {
      // Given — ER-010
      const manager = await WebContainerManager.getInstance();

      // Then
      expect(manager.isDevRunning).toBe(false);
    });

    it('isDevRunning returns false after process exits', async () => {
      // Given — ER-010 (via exit detection)
      const mockProcess = createMockProcess();
      mockContainer.spawn.mockResolvedValueOnce(mockProcess);
      const manager = await WebContainerManager.getInstance();
      await manager.runDev();
      expect(manager.isDevRunning).toBe(true);

      // When — process exits
      mockProcess._exitResolve(1);
      // Wait for exit promise to resolve
      await vi.waitFor(() => {
        expect(manager.isDevRunning).toBe(false);
      });
    });

    it('onDevExit callback is invoked when dev process exits with exit code', async () => {
      // Given — ER-009
      const mockProcess = createMockProcess();
      mockContainer.spawn.mockResolvedValueOnce(mockProcess);
      const manager = await WebContainerManager.getInstance();
      const onDevExit = vi.fn();
      manager.onDevExit = onDevExit;

      // When
      await manager.runDev();
      mockProcess._exitResolve(1);
      await vi.waitFor(() => {
        expect(onDevExit).toHaveBeenCalledWith(1);
      });
    });

    it('onDevExit callback is invoked with code 0 on clean exit', async () => {
      // Given — ER-009
      const mockProcess = createMockProcess();
      mockContainer.spawn.mockResolvedValueOnce(mockProcess);
      const manager = await WebContainerManager.getInstance();
      const onDevExit = vi.fn();
      manager.onDevExit = onDevExit;

      // When
      await manager.runDev();
      mockProcess._exitResolve(0);
      await vi.waitFor(() => {
        expect(onDevExit).toHaveBeenCalledWith(0);
      });
    });

    it('killDev() clears the dev process reference so subsequent killDev() is no-op', async () => {
      // Given — killDev should be idempotent
      const mockProcess = createMockProcess();
      mockContainer.spawn.mockResolvedValueOnce(mockProcess);
      const manager = await WebContainerManager.getInstance();
      await manager.runDev();
      await manager.killDev();
      expect(mockProcess.kill).toHaveBeenCalledTimes(1);

      // When — killDev again
      await manager.killDev();

      // Then — kill still only called once (no double-kill)
      expect(mockProcess.kill).toHaveBeenCalledTimes(1);
    });
  });
});
