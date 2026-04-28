import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock idb before importing projectDB ────────────────────────────────
const mockStore = {
  put: vi.fn(),
  delete: vi.fn(),
};

const mockTx = {
  store: mockStore,
  done: Promise.resolve(),
};

const mockDb = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn(),
  getAllFromIndex: vi.fn(),
  transaction: vi.fn().mockReturnValue(mockTx),
};

vi.mock('idb', () => ({
  openDB: vi.fn().mockResolvedValue({
    get: (...args: unknown[]) => mockDb.get(...args),
    put: (...args: unknown[]) => mockDb.put(...args),
    delete: (...args: unknown[]) => mockDb.delete(...args),
    getAll: (...args: unknown[]) => mockDb.getAll(...args),
    getAllFromIndex: (...args: unknown[]) => mockDb.getAllFromIndex(...args),
    transaction: (...args: unknown[]) => mockDb.transaction(...args),
  }),
}));

import { projectDB } from '../projectDB';
import type { PersistedProject, PersistedMessage } from '../types';

describe('projectDB', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getProject ─────────────────────────────────────────────────────

  describe('getProject', () => {
    it('should return a project by ID', async () => {
      const project: PersistedProject = {
        id: 'proj1',
        name: 'My Project',
        files: [{ path: 'src/App.tsx', content: 'x' }],
        activeFilePath: 'src/App.tsx',
        builderState: 'idle',
        createdAt: 1000,
        updatedAt: 2000,
        schemaVersion: 1,
      };
      mockDb.get.mockResolvedValue(project);

      const result = await projectDB.getProject('proj1');

      expect(result).toEqual(project);
      expect(mockDb.get).toHaveBeenCalledWith('projects', 'proj1');
    });

    it('should return undefined when project not found', async () => {
      mockDb.get.mockResolvedValue(undefined);
      const result = await projectDB.getProject('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  // ─── saveProject ────────────────────────────────────────────────────

  describe('saveProject', () => {
    it('should save a project to the projects store', async () => {
      const project: PersistedProject = {
        id: 'proj1',
        name: 'My Project',
        files: [],
        activeFilePath: null,
        builderState: 'idle',
        createdAt: 1000,
        updatedAt: 2000,
        schemaVersion: 1,
      };
      mockDb.put.mockResolvedValue('proj1');

      await projectDB.saveProject(project);

      expect(mockDb.put).toHaveBeenCalledWith('projects', project);
    });
  });

  // ─── deleteProject ──────────────────────────────────────────────────

  describe('deleteProject', () => {
    it('should delete a project and its messages', async () => {
      mockDb.delete.mockResolvedValue(undefined);
      mockDb.getAllFromIndex.mockResolvedValue([]); // no messages to delete

      await projectDB.deleteProject('proj1');

      // Should delete from projects store
      expect(mockDb.delete).toHaveBeenCalledWith('projects', 'proj1');
      // Should also attempt to delete messages (calls deleteMessages internally)
      expect(mockDb.getAllFromIndex).toHaveBeenCalledWith('messages', 'by-projectId', 'proj1');
    });
  });

  // ─── listProjects ───────────────────────────────────────────────────

  describe('listProjects', () => {
    it('should return all projects sorted by updatedAt desc', async () => {
      const projects: PersistedProject[] = [
        {
          id: 'p1',
          name: 'Old',
          files: [],
          activeFilePath: null,
          builderState: 'idle',
          createdAt: 1000,
          updatedAt: 1000,
          schemaVersion: 1,
        },
        {
          id: 'p2',
          name: 'New',
          files: [],
          activeFilePath: null,
          builderState: 'idle',
          createdAt: 2000,
          updatedAt: 3000,
          schemaVersion: 1,
        },
      ];
      mockDb.getAll.mockResolvedValue(projects);

      const result = await projectDB.listProjects();

      expect(result).toHaveLength(2);
      // Sorted by updatedAt desc
      expect(result[0].id).toBe('p2');
      expect(result[1].id).toBe('p1');
    });

    it('should return empty array when no projects exist', async () => {
      mockDb.getAll.mockResolvedValue([]);
      const result = await projectDB.listProjects();
      expect(result).toEqual([]);
    });

    it('should enforce max 5 projects on list (not at storage level)', async () => {
      const projects = Array.from({ length: 7 }, (_, i) => ({
        id: `p${i}`,
        name: `Project ${i}`,
        files: [],
        activeFilePath: null,
        builderState: 'idle' as const,
        createdAt: i * 1000,
        updatedAt: i * 1000,
        schemaVersion: 1,
      }));
      mockDb.getAll.mockResolvedValue(projects);

      const result = await projectDB.listProjects();
      // listProjects returns ALL, enforcement is at app layer
      expect(result).toHaveLength(7);
    });
  });

  // ─── getMessages ────────────────────────────────────────────────────

  describe('getMessages', () => {
    it('should return messages for a project', async () => {
      const messages: PersistedMessage[] = [
        { id: 'proj1_m1', projectId: 'proj1', role: 'user', content: 'hi', timestamp: 1000 },
        {
          id: 'proj1_m2',
          projectId: 'proj1',
          role: 'assistant',
          content: 'hello',
          timestamp: 2000,
        },
      ];
      mockDb.getAllFromIndex.mockResolvedValue(messages);

      const result = await projectDB.getMessages('proj1');

      expect(result).toHaveLength(2);
      expect(mockDb.getAllFromIndex).toHaveBeenCalledWith('messages', 'by-projectId', 'proj1');
    });

    it('should return empty array when no messages exist', async () => {
      mockDb.getAllFromIndex.mockResolvedValue([]);
      const result = await projectDB.getMessages('proj1');
      expect(result).toEqual([]);
    });
  });

  // ─── saveMessages ───────────────────────────────────────────────────

  describe('saveMessages', () => {
    it('should save all messages using a transaction', async () => {
      const messages: PersistedMessage[] = [
        { id: 'proj1_m1', projectId: 'proj1', role: 'user', content: 'hi', timestamp: 1000 },
      ];
      mockStore.put.mockResolvedValue('proj1_m1');

      await projectDB.saveMessages(messages);

      expect(mockDb.transaction).toHaveBeenCalledWith('messages', 'readwrite');
      expect(mockStore.put).toHaveBeenCalledWith(messages[0]);
    });

    it('should handle empty messages array gracefully', async () => {
      await projectDB.saveMessages([]);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });
  });

  // ─── deleteMessages ─────────────────────────────────────────────────

  describe('deleteMessages', () => {
    it('should delete all messages for a project via transaction', async () => {
      const messages: PersistedMessage[] = [
        { id: 'proj1_m1', projectId: 'proj1', role: 'user', content: 'hi', timestamp: 1000 },
        {
          id: 'proj1_m2',
          projectId: 'proj1',
          role: 'assistant',
          content: 'hello',
          timestamp: 2000,
        },
      ];
      mockDb.getAllFromIndex.mockResolvedValue(messages);
      mockStore.delete.mockResolvedValue(undefined);

      await projectDB.deleteMessages('proj1');

      expect(mockDb.transaction).toHaveBeenCalledWith('messages', 'readwrite');
      expect(mockStore.delete).toHaveBeenCalledTimes(2);
      expect(mockStore.delete).toHaveBeenCalledWith('proj1_m1');
      expect(mockStore.delete).toHaveBeenCalledWith('proj1_m2');
    });
  });

  // ─── getProjectCount ────────────────────────────────────────────────

  describe('getProjectCount', () => {
    it('should return the number of projects', async () => {
      mockDb.getAll.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]);

      const count = await projectDB.getProjectCount();
      expect(count).toBe(3);
    });

    it('should return 0 when no projects exist', async () => {
      mockDb.getAll.mockResolvedValue([]);
      const count = await projectDB.getProjectCount();
      expect(count).toBe(0);
    });
  });
});
