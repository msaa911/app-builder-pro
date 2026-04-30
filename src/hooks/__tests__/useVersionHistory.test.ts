import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ─── Mock dependencies ─────────────────────────────────────────────────

const mockProjectDB = vi.hoisted(() => ({
  saveSnapshot: vi.fn(),
  getSnapshots: vi.fn(),
  getSnapshotCount: vi.fn(),
  deleteSnapshot: vi.fn(),
  deleteSnapshots: vi.fn(),
}));

vi.mock('../../services/storage/projectDB', () => ({
  projectDB: mockProjectDB,
  resetDBConnection: vi.fn(),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('mock-snap-id'),
}));

import { useVersionHistory } from '../useVersionHistory';
import type { PersistedSnapshot } from '../../services/storage/types';
import type { ProjectFile } from '../../types';

// ─── Helpers ───────────────────────────────────────────────────────────

const makeFiles = (n: number, prefix = 'file'): ProjectFile[] =>
  Array.from({ length: n }, (_, i) => ({
    path: `src/${prefix}${i}.tsx`,
    content: `export const ${prefix}${i} = () => {}`,
  }));

const makeSnapshot = (overrides: Partial<PersistedSnapshot> = {}): PersistedSnapshot => ({
  id: 'snap1',
  projectId: 'proj1',
  files: makeFiles(1),
  trigger: 'refine',
  messageIndex: 0,
  createdAt: 1000,
  ...overrides,
});

describe('useVersionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── createSnapshot ────────────────────────────────────────────────

  describe('createSnapshot', () => {
    it('should create a snapshot with refine trigger and save to IDB', async () => {
      mockProjectDB.saveSnapshot.mockResolvedValue('snap1');
      mockProjectDB.getSnapshots.mockResolvedValue([makeSnapshot()]);

      const { result } = renderHook(() => useVersionHistory('proj1'));

      await act(async () => {
        await result.current.createSnapshot(makeFiles(2), 'refine', 3);
      });

      expect(mockProjectDB.saveSnapshot).toHaveBeenCalledTimes(1);
      const saved = mockProjectDB.saveSnapshot.mock.calls[0][0] as PersistedSnapshot;
      expect(saved.projectId).toBe('proj1');
      expect(saved.trigger).toBe('refine');
      expect(saved.messageIndex).toBe(3);
      expect(saved.files).toHaveLength(2);
    });

    it('should create a snapshot with editor-save trigger and null messageIndex', async () => {
      mockProjectDB.saveSnapshot.mockResolvedValue('snap2');
      mockProjectDB.getSnapshots.mockResolvedValue([]);

      const { result } = renderHook(() => useVersionHistory('proj1'));

      await act(async () => {
        await result.current.createSnapshot(makeFiles(1), 'editor-save', null);
      });

      const saved = mockProjectDB.saveSnapshot.mock.calls[0][0] as PersistedSnapshot;
      expect(saved.trigger).toBe('editor-save');
      expect(saved.messageIndex).toBeNull();
    });

    it('should not create snapshot when projectId is null', async () => {
      const { result } = renderHook(() => useVersionHistory(null));

      await act(async () => {
        await result.current.createSnapshot(makeFiles(1), 'refine', 0);
      });

      expect(mockProjectDB.saveSnapshot).not.toHaveBeenCalled();
    });

    it('should not create snapshot when isGenerating is true', async () => {
      mockProjectDB.getSnapshots.mockResolvedValue([]);

      const { result } = renderHook(() => useVersionHistory('proj1'));

      await act(async () => {
        result.current.setIsGenerating(true);
      });

      await act(async () => {
        await result.current.createSnapshot(makeFiles(1), 'refine', 0);
      });

      expect(mockProjectDB.saveSnapshot).not.toHaveBeenCalled();
    });

    it('should deep-clone files so original array is not shared with IDB', async () => {
      mockProjectDB.saveSnapshot.mockResolvedValue('snap1');
      mockProjectDB.getSnapshots.mockResolvedValue([]);

      const originalFiles = makeFiles(1);
      const { result } = renderHook(() => useVersionHistory('proj1'));

      await act(async () => {
        await result.current.createSnapshot(originalFiles, 'refine', 0);
      });

      // Mutate the saved snapshot's files — original should be unaffected
      const saved = mockProjectDB.saveSnapshot.mock.calls[0][0] as PersistedSnapshot;
      saved.files[0].content = 'MUTATED';
      expect(originalFiles[0].content).not.toBe('MUTATED');
    });
  });

  // ─── FIFO Eviction ─────────────────────────────────────────────────

  describe('FIFO eviction', () => {
    it('should evict oldest snapshot when count exceeds MAX_SNAPSHOTS (20)', async () => {
      // After save, count is 21 → need to evict oldest
      // getSnapshots returns sorted desc (newest first, oldest last)
      const existingSnaps = Array.from({ length: 21 }, (_, i) =>
        makeSnapshot({
          id: `snap-old-${i}`,
          createdAt: 3000 - i * 100, // i=0 → 3000 (newest), i=20 → 1000 (oldest)
        })
      );

      mockProjectDB.saveSnapshot.mockResolvedValue('snap-new');
      mockProjectDB.getSnapshotCount.mockResolvedValue(21);
      mockProjectDB.getSnapshots.mockResolvedValue(existingSnaps);
      mockProjectDB.deleteSnapshot.mockResolvedValue(undefined);

      const { result } = renderHook(() => useVersionHistory('proj1'));

      await act(async () => {
        await result.current.createSnapshot(makeFiles(1), 'refine', 5);
      });

      // Should delete the oldest snapshot (last in sorted desc list = snap-old-20 with createdAt=1000)
      expect(mockProjectDB.deleteSnapshot).toHaveBeenCalled();
      const deletedId = mockProjectDB.deleteSnapshot.mock.calls[0][0];
      expect(deletedId).toBe('snap-old-20'); // createdAt=1000 is the oldest
    });

    it('should not evict when below MAX_SNAPSHOTS', async () => {
      mockProjectDB.saveSnapshot.mockResolvedValue('snap1');
      mockProjectDB.getSnapshotCount.mockResolvedValue(10);
      mockProjectDB.getSnapshots.mockResolvedValue([]);

      const { result } = renderHook(() => useVersionHistory('proj1'));

      await act(async () => {
        await result.current.createSnapshot(makeFiles(1), 'refine', 0);
      });

      expect(mockProjectDB.deleteSnapshot).not.toHaveBeenCalled();
    });
  });

  // ─── restoreSnapshot ───────────────────────────────────────────────

  describe('restoreSnapshot', () => {
    it('should return deep-cloned files from the snapshot', async () => {
      const snapshot = makeSnapshot({
        id: 'snap-restore',
        files: [{ path: 'src/App.tsx', content: 'original content' }],
      });
      mockProjectDB.getSnapshots.mockResolvedValue([snapshot]);

      const { result } = renderHook(() => useVersionHistory('proj1'));

      const files = await result.current.restoreSnapshot('snap-restore');

      expect(files).toHaveLength(1);
      expect(files![0].path).toBe('src/App.tsx');
      expect(files![0].content).toBe('original content');
    });

    it('should return null when snapshot not found', async () => {
      mockProjectDB.getSnapshots.mockResolvedValue([]);

      const { result } = renderHook(() => useVersionHistory('proj1'));

      const files = await result.current.restoreSnapshot('nonexistent');

      expect(files).toBeNull();
    });

    it('should return null when projectId is null', async () => {
      const { result } = renderHook(() => useVersionHistory(null));

      const files = await result.current.restoreSnapshot('snap1');

      expect(files).toBeNull();
    });

    it('should return deep-cloned files so consumer can safely mutate', async () => {
      const snapshot = makeSnapshot({
        id: 'snap-isolation',
        files: [{ path: 'src/App.tsx', content: 'original' }],
      });
      mockProjectDB.getSnapshots.mockResolvedValue([snapshot]);

      const { result } = renderHook(() => useVersionHistory('proj1'));

      const files = await result.current.restoreSnapshot('snap-isolation');

      // Mutate the returned files — snapshot should be unaffected
      files![0].content = 'MUTATED';
      expect(snapshot.files[0].content).toBe('original');
    });

    it('should not restore when isGenerating is true', async () => {
      const snapshot = makeSnapshot({ id: 'snap-gen' });
      mockProjectDB.getSnapshots.mockResolvedValue([snapshot]);

      const { result } = renderHook(() => useVersionHistory('proj1'));

      await act(async () => {
        result.current.setIsGenerating(true);
      });

      const files = await result.current.restoreSnapshot('snap-gen');

      expect(files).toBeNull();
    });
  });

  // ─── deleteSnapshot ────────────────────────────────────────────────

  describe('deleteSnapshot', () => {
    it('should delete a snapshot and refresh the list', async () => {
      mockProjectDB.deleteSnapshot.mockResolvedValue(undefined);
      mockProjectDB.getSnapshots.mockResolvedValue([]);

      const { result } = renderHook(() => useVersionHistory('proj1'));

      await act(async () => {
        await result.current.deleteSnapshot('snap1');
      });

      expect(mockProjectDB.deleteSnapshot).toHaveBeenCalledWith('snap1');
    });
  });

  // ─── refreshSnapshots ──────────────────────────────────────────────

  describe('refreshSnapshots', () => {
    it('should load snapshots from IDB and update state', async () => {
      const snapshots = [
        makeSnapshot({ id: 'snap1', createdAt: 3000 }),
        makeSnapshot({ id: 'snap2', createdAt: 1000 }),
      ];
      mockProjectDB.getSnapshots.mockResolvedValue(snapshots);

      const { result } = renderHook(() => useVersionHistory('proj1'));

      await act(async () => {
        await result.current.refreshSnapshots();
      });

      expect(result.current.snapshots).toHaveLength(2);
    });

    it('should set isLoading false after refresh', async () => {
      mockProjectDB.getSnapshots.mockResolvedValue([]);

      const { result } = renderHook(() => useVersionHistory('proj1'));

      await act(async () => {
        await result.current.refreshSnapshots();
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  // ─── Initialization ────────────────────────────────────────────────

  describe('initialization', () => {
    it('should load snapshots on mount when projectId is provided', async () => {
      mockProjectDB.getSnapshots.mockResolvedValue([makeSnapshot()]);

      const { result } = renderHook(() => useVersionHistory('proj1'));

      await waitFor(() => {
        expect(result.current.snapshots).toHaveLength(1);
      });
    });

    it('should start with empty snapshots when projectId is null', async () => {
      const { result } = renderHook(() => useVersionHistory(null));

      expect(result.current.snapshots).toEqual([]);
    });
  });
});
