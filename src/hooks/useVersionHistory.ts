import { useState, useCallback, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import { projectDB } from '../services/storage/projectDB';
import { serializeSnapshot, deserializeSnapshot } from '../services/storage/serialize';
import type { PersistedSnapshot, SnapshotTrigger } from '../services/storage/types';
import type { ProjectFile } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────

export interface UseVersionHistoryReturn {
  snapshots: PersistedSnapshot[];
  isLoading: boolean;
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;
  createSnapshot: (
    files: ProjectFile[],
    trigger: SnapshotTrigger,
    messageIndex: number | null
  ) => Promise<void>;
  restoreSnapshot: (id: string) => Promise<ProjectFile[] | null>;
  deleteSnapshot: (id: string) => Promise<void>;
  refreshSnapshots: () => Promise<void>;
}

// ─── Constants ─────────────────────────────────────────────────────────

export const MAX_SNAPSHOTS = 20;

// ─── Hook ──────────────────────────────────────────────────────────────

export function useVersionHistory(projectId: string | null): UseVersionHistoryReturn {
  const [snapshots, setSnapshots] = useState<PersistedSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Ref to track generating state inside async closures
  const isGeneratingRef = useRef(false);

  const updateIsGenerating = useCallback((value: boolean) => {
    setIsGenerating(value);
    isGeneratingRef.current = value;
  }, []);

  // ── refreshSnapshots ──────────────────────────────────────────────

  const refreshSnapshots = useCallback(async () => {
    if (!projectId) {
      setSnapshots([]);
      setIsLoading(false);
      return;
    }

    try {
      const all = await projectDB.getSnapshots(projectId);
      setSnapshots(all);
    } catch {
      // Silent fail — snapshot list is non-critical
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Load snapshots on mount or when projectId changes
  useEffect(() => {
    refreshSnapshots();
  }, [refreshSnapshots]);

  // ── createSnapshot ────────────────────────────────────────────────

  const createSnapshot = useCallback(
    async (
      files: ProjectFile[],
      trigger: SnapshotTrigger,
      messageIndex: number | null
    ): Promise<void> => {
      if (!projectId) return;
      if (isGeneratingRef.current) return;

      const id = nanoid(12);
      const now = Date.now();

      const snapshot = serializeSnapshot({
        id,
        projectId,
        files,
        trigger,
        messageIndex,
        createdAt: now,
      });

      await projectDB.saveSnapshot(snapshot);

      // FIFO eviction: check count after save
      const count = await projectDB.getSnapshotCount(projectId);
      if (count > MAX_SNAPSHOTS) {
        // Get snapshots sorted by createdAt desc (newest first)
        const all = await projectDB.getSnapshots(projectId);
        // Evict oldest (last in the sorted desc list)
        const toEvict = all.slice(MAX_SNAPSHOTS);
        for (const snap of toEvict) {
          await projectDB.deleteSnapshot(snap.id);
        }
      }

      await refreshSnapshots();
    },
    [projectId, refreshSnapshots]
  );

  // ── restoreSnapshot ───────────────────────────────────────────────

  const restoreSnapshot = useCallback(
    async (id: string): Promise<ProjectFile[] | null> => {
      if (!projectId) return null;
      if (isGeneratingRef.current) return null;

      const all = await projectDB.getSnapshots(projectId);
      const snapshot = all.find((s) => s.id === id);
      if (!snapshot) return null;

      // Return deep-cloned files so the persisted record is never mutated
      const deserialized = deserializeSnapshot(snapshot);
      return structuredClone(deserialized.files);
    },
    [projectId]
  );

  // ── deleteSnapshot ────────────────────────────────────────────────

  const deleteSnapshot = useCallback(
    async (id: string): Promise<void> => {
      await projectDB.deleteSnapshot(id);
      await refreshSnapshots();
    },
    [refreshSnapshots]
  );

  return {
    snapshots,
    isLoading,
    isGenerating,
    setIsGenerating: updateIsGenerating,
    createSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    refreshSnapshots,
  };
}
