import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ─── Mock dependencies ─────────────────────────────────────────────────

const mockProjectDB = vi.hoisted(() => ({
  getProject: vi.fn(),
  saveProject: vi.fn(),
  deleteProject: vi.fn(),
  listProjects: vi.fn(),
  getMessages: vi.fn(),
  saveMessages: vi.fn(),
  deleteMessages: vi.fn(),
  getProjectCount: vi.fn(),
}));

vi.mock('../../services/storage/projectDB', () => ({
  projectDB: mockProjectDB,
  resetDBConnection: vi.fn(),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('mock-nanoid-12'),
}));

import { useProjectPersistence } from '../useProjectPersistence';
import type { PersistedProject, PersistedMessage } from '../../services/storage/types';
import type { ProjectFile, ChatMessage } from '../../types';

// ─── Helpers ───────────────────────────────────────────────────────────

const makeProject = (overrides: Partial<PersistedProject> = {}): PersistedProject => ({
  id: 'proj1',
  name: 'Test Project',
  files: [{ path: 'src/App.tsx', content: 'export default App' }],
  activeFilePath: 'src/App.tsx',
  builderState: 'idle',
  activeTab: 'code',
  showExplorer: true,
  createdAt: 1000,
  updatedAt: 2000,
  schemaVersion: 1,
  ...overrides,
});

const makeFiles = (n: number): ProjectFile[] =>
  Array.from({ length: n }, (_, i) => ({
    path: `src/file${i}.tsx`,
    content: `export const File${i} = () => {}`,
  }));

const makeMessages = (n: number): ChatMessage[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `msg${i}`,
    role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
    content: `Message ${i}`,
    timestamp: 1000 + i * 1000,
  }));

describe('useProjectPersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Initialization ─────────────────────────────────────────────────

  describe('initialization', () => {
    it('should start with no active project', () => {
      mockProjectDB.listProjects.mockResolvedValue([]);
      const { result } = renderHook(() => useProjectPersistence());

      expect(result.current.activeProjectId).toBeNull();
      expect(result.current.activeProjectName).toBeNull();
      expect(result.current.projectList).toEqual([]);
      expect(result.current.isRestoring).toBe(false);
    });

    it('should load project list on mount', async () => {
      const projects = [
        makeProject({ id: 'p1', name: 'Project 1' }),
        makeProject({ id: 'p2', name: 'Project 2' }),
      ];
      mockProjectDB.listProjects.mockResolvedValue(projects);

      const { result } = renderHook(() => useProjectPersistence());

      await waitFor(() => {
        expect(result.current.projectList).toHaveLength(2);
      });
    });
  });

  // ─── createProject ──────────────────────────────────────────────────

  describe('createProject', () => {
    it('should create a new project and save to IDB', async () => {
      mockProjectDB.listProjects.mockResolvedValue([]);
      mockProjectDB.getProjectCount.mockResolvedValue(0);
      mockProjectDB.saveProject.mockResolvedValue('mock-nanoid-12');
      mockProjectDB.saveMessages.mockResolvedValue(undefined);

      const { result } = renderHook(() => useProjectPersistence());

      await waitFor(() => {
        expect(result.current.projectList).toEqual([]);
      });

      let projectId: string | undefined;
      await act(async () => {
        projectId = await result.current.createProject('My New App');
      });

      expect(projectId).toBe('mock-nanoid-12');
      expect(mockProjectDB.saveProject).toHaveBeenCalled();
      expect(result.current.activeProjectId).toBe('mock-nanoid-12');
      expect(result.current.activeProjectName).toBe('My New App');
    });

    it('should reject when 5 projects already exist (PP-002)', async () => {
      const fiveProjects = Array.from({ length: 5 }, (_, i) =>
        makeProject({ id: `p${i}`, name: `Project ${i}` })
      );
      mockProjectDB.listProjects.mockResolvedValue(fiveProjects);
      mockProjectDB.getProjectCount.mockResolvedValue(5);

      const { result } = renderHook(() => useProjectPersistence());

      await waitFor(() => {
        expect(result.current.projectList).toHaveLength(5);
      });

      await expect(
        act(async () => {
          await result.current.createProject('Overflow');
        })
      ).rejects.toThrow(/maximum.*5.*project/i);
    });

    it('should auto-name as "Project N" when name not provided (D6)', async () => {
      mockProjectDB.listProjects.mockResolvedValue([]);
      mockProjectDB.getProjectCount.mockResolvedValue(2);
      mockProjectDB.saveProject.mockResolvedValue('mock-nanoid-12');
      mockProjectDB.saveMessages.mockResolvedValue(undefined);

      const { result } = renderHook(() => useProjectPersistence());

      await waitFor(() => expect(result.current.projectList).toEqual([]));

      await act(async () => {
        await result.current.createProject();
      });

      expect(mockProjectDB.saveProject).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Project 3' })
      );
    });
  });

  // ─── saveCurrentProject (auto-save with debounce) ───────────────────
  // NOTE: We test debounce behavior by verifying that saveCurrentProject
  // does NOT call projectDB.saveProject synchronously. The 2s debounce
  // is an implementation detail — we verify the contract, not the timer.

  describe('saveCurrentProject', () => {
    it('should NOT save synchronously (debounced) (PP-003)', async () => {
      const project = makeProject();
      mockProjectDB.listProjects.mockResolvedValue([project]);
      mockProjectDB.getProject.mockResolvedValue(project);
      mockProjectDB.getMessages.mockResolvedValue([]);
      mockProjectDB.saveProject.mockResolvedValue('proj1');
      mockProjectDB.saveMessages.mockResolvedValue(undefined);

      const { result } = renderHook(() => useProjectPersistence());

      await act(async () => {
        await result.current.openProject('proj1');
      });

      // Trigger save — should NOT have called saveProject yet (debounced)
      act(() => {
        result.current.saveCurrentProject({
          files: makeFiles(3),
          messages: makeMessages(2),
          activeFilePath: 'src/App.tsx',
          builderState: 'running',
          activeTab: 'code',
          showExplorer: true,
        });
      });

      expect(mockProjectDB.saveProject).not.toHaveBeenCalled();
    });

    it('should not save when no project is active', async () => {
      mockProjectDB.listProjects.mockResolvedValue([]);
      const { result } = renderHook(() => useProjectPersistence());

      act(() => {
        result.current.saveCurrentProject({
          files: makeFiles(1),
          messages: [],
          activeFilePath: null,
          builderState: 'idle',
        });
      });

      // Wait a tick to confirm no save happened
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(mockProjectDB.saveProject).not.toHaveBeenCalled();
    });
  });

  // ─── flushSave (beforeunload) ───────────────────────────────────────

  describe('flushSave', () => {
    it('should save immediately without debounce (PP-003 beforeunload)', async () => {
      const project = makeProject();
      mockProjectDB.listProjects.mockResolvedValue([project]);
      mockProjectDB.getProject.mockResolvedValue(project);
      mockProjectDB.getMessages.mockResolvedValue([]);
      mockProjectDB.saveProject.mockResolvedValue('proj1');
      mockProjectDB.saveMessages.mockResolvedValue(undefined);

      const { result } = renderHook(() => useProjectPersistence());

      await act(async () => {
        await result.current.openProject('proj1');
      });

      // Flush = immediate, no debounce
      await act(async () => {
        await result.current.flushSave({
          files: makeFiles(2),
          messages: makeMessages(1),
          activeFilePath: null,
          builderState: 'running',
        });
      });

      expect(mockProjectDB.saveProject).toHaveBeenCalledTimes(1);
    });
  });

  // ─── openProject (restore) ──────────────────────────────────────────

  describe('openProject', () => {
    it('should load project data and messages from IDB', async () => {
      const project = makeProject();
      const messages: PersistedMessage[] = [
        { id: 'proj1_m1', projectId: 'proj1', role: 'user', content: 'hi', timestamp: 1000 },
      ];
      mockProjectDB.listProjects.mockResolvedValue([project]);
      mockProjectDB.getProject.mockResolvedValue(project);
      mockProjectDB.getMessages.mockResolvedValue(messages);

      const { result } = renderHook(() => useProjectPersistence());

      let restoreData;
      await act(async () => {
        restoreData = await result.current.openProject('proj1');
      });

      expect(result.current.activeProjectId).toBe('proj1');
      expect(restoreData).toBeDefined();
      expect(restoreData!.currentFiles).toEqual(project.files);
      expect(restoreData!.activeFilePath).toBe('src/App.tsx');
      expect(restoreData!.messages).toHaveLength(1);
    });

    it('should return null when project not found', async () => {
      mockProjectDB.listProjects.mockResolvedValue([]);
      mockProjectDB.getProject.mockResolvedValue(undefined);

      const { result } = renderHook(() => useProjectPersistence());

      const restoreData = await result.current.openProject('nonexistent');

      expect(restoreData).toBeNull();
    });

    it('should set isRestoring during load', async () => {
      const project = makeProject();
      mockProjectDB.listProjects.mockResolvedValue([project]);

      let resolveGetProject: (v: PersistedProject) => void;
      const getProjectPromise = new Promise<PersistedProject>((resolve) => {
        resolveGetProject = resolve;
      });
      mockProjectDB.getProject.mockReturnValue(getProjectPromise);
      mockProjectDB.getMessages.mockResolvedValue([]);

      const { result } = renderHook(() => useProjectPersistence());

      let openPromise: Promise<unknown>;
      act(() => {
        openPromise = result.current.openProject('proj1');
      });

      // Should be restoring
      expect(result.current.isRestoring).toBe(true);

      // Resolve the getProject
      await act(async () => {
        resolveGetProject!(project);
        await openPromise;
      });

      expect(result.current.isRestoring).toBe(false);
    });
  });

  // ─── deleteProject ──────────────────────────────────────────────────

  describe('deleteProject', () => {
    it('should delete project and its messages from IDB', async () => {
      const project = makeProject();
      mockProjectDB.listProjects.mockResolvedValue([project]);
      mockProjectDB.getProject.mockResolvedValue(project);
      mockProjectDB.deleteProject.mockResolvedValue(undefined);

      const { result } = renderHook(() => useProjectPersistence());

      await act(async () => {
        await result.current.deleteProject('proj1');
      });

      expect(mockProjectDB.deleteProject).toHaveBeenCalledWith('proj1');
    });

    it('should clear activeProjectId if deleting the active project', async () => {
      const project = makeProject();
      mockProjectDB.listProjects.mockResolvedValue([project]);
      mockProjectDB.getProject.mockResolvedValue(project);
      mockProjectDB.deleteProject.mockResolvedValue(undefined);

      const { result } = renderHook(() => useProjectPersistence());

      await act(async () => {
        await result.current.openProject('proj1');
      });
      expect(result.current.activeProjectId).toBe('proj1');

      await act(async () => {
        await result.current.deleteProject('proj1');
      });

      expect(result.current.activeProjectId).toBeNull();
    });
  });

  // ─── renameProject ──────────────────────────────────────────────────

  describe('renameProject', () => {
    it('should update project name in IDB', async () => {
      const project = makeProject();
      mockProjectDB.listProjects.mockResolvedValue([project]);
      mockProjectDB.getProject.mockResolvedValue(project);
      mockProjectDB.saveProject.mockResolvedValue('proj1');

      const { result } = renderHook(() => useProjectPersistence());

      await act(async () => {
        await result.current.openProject('proj1');
      });

      await act(async () => {
        await result.current.renameProject('proj1', 'Renamed Project');
      });

      expect(mockProjectDB.saveProject).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'proj1', name: 'Renamed Project' })
      );
      expect(result.current.activeProjectName).toBe('Renamed Project');
    });
  });

  // ─── Security (D9) ──────────────────────────────────────────────────

  describe('Security boundary (D9)', () => {
    it('should never persist apiKey, OAuth tokens, isDevRunning, hasDevCrashed', async () => {
      const project = makeProject();
      mockProjectDB.listProjects.mockResolvedValue([project]);
      mockProjectDB.getProject.mockResolvedValue(project);
      mockProjectDB.saveProject.mockResolvedValue('proj1');
      mockProjectDB.saveMessages.mockResolvedValue(undefined);

      const { result } = renderHook(() => useProjectPersistence());
      await act(async () => {
        await result.current.openProject('proj1');
      });

      // Use flushSave for immediate test — bypasses debounce
      await act(async () => {
        await result.current.flushSave({
          files: makeFiles(1),
          messages: [],
          activeFilePath: null,
          builderState: 'idle',
        });
      });

      const savedProject = mockProjectDB.saveProject.mock.calls[0][0] as PersistedProject;
      const serialized = JSON.stringify(savedProject);
      expect(serialized).not.toContain('apiKey');
      expect(serialized).not.toContain('oauthToken');
      expect(serialized).not.toContain('isDevRunning');
      expect(serialized).not.toContain('hasDevCrashed');
    });
  });
});
