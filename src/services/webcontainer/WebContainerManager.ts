import { WebContainer, type WebContainerProcess } from '@webcontainer/api';
import type { IFSWatcher } from '@webcontainer/api';
import { type FileSystemTree, type ProjectFile } from '../../types';
import { logInfoSafe, logWarnSafe } from '../../utils/logger';
import { readDirRecursive } from './readDirRecursive';

/** Paths that should be excluded from watcher events (startsWith match) */
const WATCH_EXCLUDED_PATHS = ['node_modules/', '.git/', 'dist/'];

/** Paths that cannot be deleted — critical project files */
export const PROTECTED_PATHS = ['/package.json', '/vite.config.ts', '/index.html'];

/**
 * Decodes a filename that may be a Uint8Array (as WC API sometimes sends)
 * into a string. Passes through string filenames unchanged.
 */
function decodeFilename(filename: string | Uint8Array): string {
  if (typeof filename === 'string') return filename;
  return new TextDecoder().decode(filename);
}

export class WebContainerManager {
  private static instance: WebContainerManager;
  private webcontainerInstance: WebContainer | null = null;
  private _isWriting: boolean = false;
  private _devProcess: WebContainerProcess | null = null;
  private _isDevRunning: boolean = false;
  private _onDevExit?: (code: number) => void;

  private constructor() {}

  public static async getInstance(): Promise<WebContainerManager> {
    if (!WebContainerManager.instance) {
      WebContainerManager.instance = new WebContainerManager();
    }
    if (!WebContainerManager.instance.webcontainerInstance) {
      await WebContainerManager.instance.boot();
    }
    return WebContainerManager.instance;
  }

  public async boot(): Promise<WebContainer> {
    if (this.webcontainerInstance) return this.webcontainerInstance;

    logInfoSafe('WebContainer', 'Booting WebContainer...');
    this.webcontainerInstance = await WebContainer.boot();
    return this.webcontainerInstance;
  }

  public async mount(tree: FileSystemTree) {
    if (!this.webcontainerInstance) await this.boot();
    await this.webcontainerInstance!.mount(tree);
  }

  public async install(onLog?: (data: string) => void) {
    if (!this.webcontainerInstance) {
      await this.boot();
    }

    const installProcess = await this.webcontainerInstance!.spawn('npm', ['install']);

    installProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          onLog?.(data);
        },
      })
    );

    return installProcess.exit;
  }

  public async runDev(onLog?: (data: string) => void, onReady?: (url: string) => void) {
    if (!this.webcontainerInstance) {
      await this.boot();
    }

    const devProcess = await this.webcontainerInstance!.spawn('npm', ['run', 'dev']);

    devProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          onLog?.(data);
        },
      })
    );

    this.webcontainerInstance!.on('server-ready', (_port, url) => {
      onReady?.(url);
    });

    // Store process ref and set up exit detection (ER-006, ER-009, ER-010)
    this._devProcess = devProcess;
    this._isDevRunning = true;

    devProcess.exit.then((code) => {
      this._isDevRunning = false;
      this._devProcess = null;
      this._onDevExit?.(code);
    });

    return devProcess;
  }

  /** Whether the dev server process is currently running (ER-010) */
  public get isDevRunning(): boolean {
    return this._isDevRunning;
  }

  /** Callback invoked when the dev process exits — receives exit code (ER-009) */
  public set onDevExit(cb: ((code: number) => void) | undefined) {
    this._onDevExit = cb;
  }

  /** Kill the running dev process (ER-007). No-op if no process is running. */
  public async killDev(): Promise<void> {
    if (this._devProcess) {
      this._devProcess.kill();
      this._isDevRunning = false;
      this._devProcess = null;
    }
  }

  /** Restart the dev process: kill old + spawn new (ER-008) */
  public async restartDev(onLog?: (data: string) => void, onReady?: (url: string) => void) {
    await this.killDev();
    return this.runDev(onLog, onReady);
  }

  /** Whether WCM is currently performing a writeFile — used by watcher to skip circular refreshes */
  public get isWriting(): boolean {
    return this._isWriting;
  }

  public async writeFile(path: string, content: string) {
    if (!this.webcontainerInstance) {
      await this.boot();
    }
    this._isWriting = true;
    try {
      await this.webcontainerInstance!.fs.writeFile(path, content);
    } finally {
      this._isWriting = false;
    }
  }

  /** Throws if the WebContainer instance is not booted — used by methods that require a booted WC and cannot auto-boot */
  private requireBooted(): void {
    if (!this.webcontainerInstance) {
      throw new Error('WebContainer is not booted');
    }
  }

  public async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
    this.requireBooted();
    this._isWriting = true;
    try {
      logInfoSafe('WebContainer', `Creating directory: ${dirPath}`);
      // WC fs.mkdir has overloads: recursive:true → Promise<string>, otherwise → Promise<void>
      // We always want void behavior, so handle the overload explicitly
      if (options?.recursive) {
        await this.webcontainerInstance!.fs.mkdir(dirPath, { recursive: true });
      } else {
        await this.webcontainerInstance!.fs.mkdir(dirPath);
      }
    } finally {
      this._isWriting = false;
    }
  }

  /**
   * Batch-write multiple files without full remount (PWU-001).
   * For each file: mkdir parent dirs (recursive), then writeFile.
   * Sequential execution; _isWriting flag set for entire batch (PWU-003).
   * On failure, error propagates — partial state accepted (file A written, file B failed).
   */
  public async updateFiles(files: ProjectFile[]): Promise<void> {
    this.requireBooted();
    this._isWriting = true;
    try {
      for (const file of files) {
        // Extract parent directory path
        const lastSlash = file.path.lastIndexOf('/');
        const parentDir = file.path.substring(0, lastSlash);

        // Create parent dirs if not root '/'
        if (parentDir && parentDir !== '/') {
          await this.webcontainerInstance!.fs.mkdir(parentDir, { recursive: true });
        }

        await this.webcontainerInstance!.fs.writeFile(file.path, file.content ?? '');
      }
    } finally {
      this._isWriting = false;
    }
  }

  public async rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
    this.requireBooted();
    if (PROTECTED_PATHS.includes(path)) {
      throw new Error(`Cannot delete protected path: ${path}`);
    }
    this._isWriting = true;
    try {
      await this.webcontainerInstance!.fs.rm(path, options);
    } finally {
      this._isWriting = false;
    }
  }

  public async readFile(path: string): Promise<string> {
    if (!this.webcontainerInstance) {
      await this.boot();
    }
    const content = await this.webcontainerInstance!.fs.readFile(path);
    return new TextDecoder().decode(content);
  }

  public async readDir(dirPath?: string): Promise<ProjectFile[]> {
    this.requireBooted();
    // WC fs.readdir has multiple overloads that don't match a simple type —
    // cast is safe because we only call readdir(path, { withFileTypes: true })
    return readDirRecursive(this.webcontainerInstance!.fs as unknown, dirPath ?? '/');
  }

  /**
   * Sets up a recursive filesystem watcher on the root directory.
   * Filters out excluded paths (node_modules, .git, dist).
   * Decodes Uint8Array filenames from WC API to strings.
   * Returns null gracefully if the container is not booted or watch throws.
   *
   * @param callback — invoked with (eventType, stringFilename) on relevant changes
   * @returns IFSWatcher with close() method, or null on failure
   */
  public watch(
    callback: (event: 'rename' | 'change', filename: string) => void
  ): IFSWatcher | null {
    // Boot guard — return null before boot (no async, no throw)
    if (!this.webcontainerInstance) {
      return null;
    }

    try {
      const watcher = this.webcontainerInstance.fs.watch(
        '/',
        { recursive: true },
        (event: 'rename' | 'change', filename: string | Uint8Array) => {
          const decodedFilename = decodeFilename(filename);

          // Exclude filter — skip node_modules/, .git/, dist/ paths
          if (WATCH_EXCLUDED_PATHS.some((prefix) => decodedFilename.startsWith(prefix))) {
            return;
          }

          callback(event, decodedFilename);
        }
      );

      return watcher;
    } catch (error) {
      logWarnSafe(
        'WebContainer',
        `Recursive watch failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }
}
