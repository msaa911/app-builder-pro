import { useState, useCallback } from 'react';
import { WebContainerManager } from '../services/webcontainer/WebContainerManager';
import type { FileSystemTree, ProjectFile } from '../types';

interface UseWebContainerReturn {
  mount: (files: FileSystemTree) => Promise<void>;
  writeFile: (path: string, content: string) => Promise<void>;
  updateFiles: (files: ProjectFile[]) => Promise<void>;
  install: (onLog?: (data: string) => void) => Promise<number | undefined>;
  runDev: (onLog?: (data: string) => void, onReady?: (url: string) => void) => Promise<void>;
  restartDev: (onLog?: (data: string) => void, onReady?: (url: string) => void) => Promise<void>;
  isReady: boolean;
  error: Error | null;
}

export function useWebContainer(): UseWebContainerReturn {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mount = useCallback(async (files: FileSystemTree) => {
    try {
      const wc = await WebContainerManager.getInstance();
      await wc.mount(files);
      setIsReady(true);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const writeFile = useCallback(async (path: string, content: string) => {
    const wc = await WebContainerManager.getInstance();
    await wc.writeFile(path, content);
  }, []);

  const updateFiles = useCallback(async (files: ProjectFile[]) => {
    const wc = await WebContainerManager.getInstance();
    await wc.updateFiles(files);
  }, []);

  const install = useCallback(async (onLog?: (data: string) => void) => {
    const wc = await WebContainerManager.getInstance();
    return await wc.install(onLog);
  }, []);

  const runDev = useCallback(
    async (onLog?: (data: string) => void, onReady?: (url: string) => void) => {
      const wc = await WebContainerManager.getInstance();
      await wc.runDev(onLog, onReady);
    },
    []
  );

  const restartDev = useCallback(
    async (onLog?: (data: string) => void, onReady?: (url: string) => void) => {
      const wc = await WebContainerManager.getInstance();
      await wc.restartDev(onLog, onReady);
    },
    []
  );

  return { mount, writeFile, updateFiles, install, runDev, restartDev, isReady, error };
}
