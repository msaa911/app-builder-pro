import { useState, useEffect, useCallback, useRef } from 'react';
import { WebContainerManager, PROTECTED_PATHS } from '../services/webcontainer/WebContainerManager';
import { logWarnSafe } from '../utils/logger';
import type { IFSWatcher } from '@webcontainer/api';
import type { ProjectFile } from '../types';

/** Debounce window for watcher events (ms) */
const WATCHER_DEBOUNCE_MS = 300;

export interface UseFileTreeReturn {
  files: ProjectFile[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  createFile: (fullPath: string) => Promise<string>;
  createFolder: (fullPath: string) => Promise<string>;
  deleteItem: (fullPath: string, type: 'file' | 'folder') => Promise<void>;
  renameItem: (oldPath: string, newPath: string) => Promise<void>;
}

export function useFileTree(): UseFileTreeReturn {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cancelledRef = useRef(false);
  const watcherRef = useRef<IFSWatcher | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wcmRef = useRef<WebContainerManager | null>(null);
  const creatingPathRef = useRef<string | null>(null);
  const deletingPathRef = useRef<string | null>(null);

  const loadFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const wcm = await WebContainerManager.getInstance();
      wcmRef.current = wcm;
      const result = await wcm.readDir('/');
      if (cancelledRef.current) return;
      setFiles(result);
      setIsLoading(false);
    } catch (err) {
      if (cancelledRef.current) return;
      setError(err as Error);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    loadFiles();

    return () => {
      cancelledRef.current = true;
    };
  }, [loadFiles]);

  // Watcher subscription — subscribe after initial load completes
  useEffect(() => {
    // Only subscribe when initial load is done (isLoading transitions to false)
    if (isLoading) return;

    const wcm = wcmRef.current;
    if (!wcm) return;

    const watcher = wcm.watch((_event, _filename) => {
      // Clear any existing debounce timer
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      // Debounce: coalesce rapid events into a single refresh
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        // Circular protection: skip refresh if WCM is currently writing
        if (wcm.isWriting) return;
        if (cancelledRef.current) return;
        loadFiles();
      }, WATCHER_DEBOUNCE_MS);
    });

    watcherRef.current = watcher;

    return () => {
      // Cleanup watcher
      if (watcherRef.current) {
        watcherRef.current.close();
        watcherRef.current = null;
      }
      // Cleanup debounce timer
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [isLoading, loadFiles]);

  const refresh = useCallback(async () => {
    await loadFiles();
  }, [loadFiles]);

  /**
   * Validate a path for creation: reject empty, whitespace-only, trailing slash,
   * double slashes, dot-only segments, or if the path already exists in the file tree.
   */
  const validateCreationPath = useCallback(
    (fullPath: string, existingFiles: ProjectFile[]): void => {
      // Reject empty or whitespace-only
      if (!fullPath || !fullPath.trim()) {
        throw new Error('Name cannot be empty');
      }

      // Reject trailing slash (means empty leaf name)
      if (fullPath.endsWith('/')) {
        throw new Error('Name cannot end with "/"');
      }

      // Reject double slashes (means empty path segment)
      if (fullPath.includes('//')) {
        throw new Error('Path cannot contain empty segments ("//")');
      }

      // Extract leaf name (last segment after last /)
      const lastSlashIndex = fullPath.lastIndexOf('/');
      const leafName = lastSlashIndex >= 0 ? fullPath.slice(lastSlashIndex + 1) : fullPath;

      // Reject if leaf name contains a slash (shouldn't happen after extraction, but guard
      // against input like "foo/bar" where the entire input is treated as a leaf name)
      if (leafName.includes('/')) {
        throw new Error('Name cannot contain "/"');
      }

      // Reject dot-only leaf names ("." or "..")
      if (leafName === '.' || leafName === '..') {
        throw new Error('Name cannot be "." or ".."');
      }

      // Reject if the full path already exists
      const exists = existingFiles.some((f) => f.path === fullPath);
      if (exists) {
        throw new Error(`"${fullPath}" already exists`);
      }
    },
    []
  );

  const createFile = useCallback(
    async (fullPath: string): Promise<string> => {
      // Validate
      validateCreationPath(fullPath, files);

      const wcm = wcmRef.current;
      if (!wcm) {
        throw new Error('WebContainer is not ready');
      }

      creatingPathRef.current = fullPath;

      try {
        // Extract parent directory from fullPath
        const lastSlashIndex = fullPath.lastIndexOf('/');
        const parentDir = lastSlashIndex > 0 ? fullPath.slice(0, lastSlashIndex) : null;

        // Create parent directories if needed
        if (parentDir) {
          await wcm.mkdir(parentDir, { recursive: true });
        }

        // Write empty file
        await wcm.writeFile(fullPath, '');

        return fullPath;
      } catch (err) {
        logWarnSafe(
          'useFileTree',
          `Failed to create file "${fullPath}": ${(err as Error).message}`
        );
        setError(err as Error);
        throw err;
      } finally {
        creatingPathRef.current = null;
      }
    },
    [files, validateCreationPath]
  );

  const createFolder = useCallback(
    async (fullPath: string): Promise<string> => {
      // Validate
      validateCreationPath(fullPath, files);

      const wcm = wcmRef.current;
      if (!wcm) {
        throw new Error('WebContainer is not ready');
      }

      creatingPathRef.current = fullPath;

      try {
        await wcm.mkdir(fullPath, { recursive: true });
        return fullPath;
      } catch (err) {
        logWarnSafe(
          'useFileTree',
          `Failed to create folder "${fullPath}": ${(err as Error).message}`
        );
        setError(err as Error);
        throw err;
      } finally {
        creatingPathRef.current = null;
      }
    },
    [files, validateCreationPath]
  );

  const deleteItem = useCallback(
    async (fullPath: string, type: 'file' | 'folder'): Promise<void> => {
      // Protected paths validation — defense in depth (WCM also checks)
      if (PROTECTED_PATHS.includes(fullPath)) {
        throw new Error(`Cannot delete protected path: ${fullPath}`);
      }

      const wcm = wcmRef.current;
      if (!wcm) {
        throw new Error('WebContainer is not ready');
      }

      deletingPathRef.current = fullPath;

      try {
        if (type === 'folder') {
          await wcm.rm(fullPath, { recursive: true });
        } else {
          await wcm.rm(fullPath);
        }
      } catch (err) {
        logWarnSafe('useFileTree', `Failed to delete "${fullPath}": ${(err as Error).message}`);
        setError(err as Error);
        throw err;
      } finally {
        deletingPathRef.current = null;
      }
    },
    []
  );

  const renameItem = useCallback(
    async (oldPath: string, newPath: string): Promise<void> => {
      // Protected paths validation — defense in depth (WCM also checks)
      if (PROTECTED_PATHS.includes(oldPath)) {
        throw new Error(`Cannot rename protected path: ${oldPath}`);
      }

      const wcm = wcmRef.current;
      if (!wcm) {
        throw new Error('WebContainer is not ready');
      }

      try {
        await wcm.rename(oldPath, newPath);
      } catch (err) {
        logWarnSafe('useFileTree', `Failed to rename "${oldPath}" → "${newPath}": ${(err as Error).message}`);
        setError(err as Error);
        throw err;
      }
    },
    []
  );

  return { files, isLoading, error, refresh, createFile, createFolder, deleteItem, renameItem };
}
