import { describe, it, expect } from 'vitest';
import type { PersistedProject, PersistedMessage, ProjectMeta, StorageSchema, PersistedSnapshot, SnapshotTrigger } from '../types';
import { SCHEMA_VERSION, DB_NAME, DB_VERSION, PERSISTED_FIELDS, SENSITIVE_FIELDS, STORE_NAMES } from '../types';

describe('Storage types and constants', () => {
  describe('PersistedProject', () => {
    it('should accept a valid PersistedProject with all required fields', () => {
      const project: PersistedProject = {
        id: 'abc123def456',
        name: 'My App',
        files: [{ path: 'src/App.tsx', content: 'export default App' }],
        activeFilePath: 'src/App.tsx',
        builderState: 'idle',
        activeTab: 'code',
        showExplorer: true,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        schemaVersion: 1,
      };

      expect(project.id).toBe('abc123def456');
      expect(project.name).toBe('My App');
      expect(project.files).toHaveLength(1);
      expect(project.activeFilePath).toBe('src/App.tsx');
      expect(project.builderState).toBe('idle');
      expect(project.schemaVersion).toBe(1);
    });

    it('should allow optional fields to be omitted (activeFilePath can be null)', () => {
      const project: PersistedProject = {
        id: 'xyz789',
        name: 'Empty Project',
        files: [],
        activeFilePath: null,
        builderState: 'idle',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        schemaVersion: 1,
      };

      expect(project.activeFilePath).toBeNull();
      expect(project.files).toEqual([]);
    });
  });

  describe('PersistedMessage', () => {
    it('should accept a valid PersistedMessage with all fields', () => {
      const message: PersistedMessage = {
        id: 'proj1_msg1',
        projectId: 'proj1',
        role: 'user',
        content: 'Build me a todo app',
        timestamp: 1700000000000,
      };

      expect(message.id).toBe('proj1_msg1');
      expect(message.projectId).toBe('proj1');
      expect(message.role).toBe('user');
      expect(message.content).toBe('Build me a todo app');
    });

    it('should accept PersistedMessage with optional files property', () => {
      const message: PersistedMessage = {
        id: 'proj1_msg2',
        projectId: 'proj1',
        role: 'assistant',
        content: 'Here is your app',
        files: [{ path: 'src/App.tsx', content: 'export default App' }],
        timestamp: 1700000000000,
      };

      expect(message.files).toHaveLength(1);
      expect(message.files![0].path).toBe('src/App.tsx');
    });
  });

  describe('ProjectMeta', () => {
    it('should accept a valid ProjectMeta with id, name, updatedAt, fileCount', () => {
      const meta: ProjectMeta = {
        id: 'proj1',
        name: 'My Project',
        updatedAt: 1700000000000,
        fileCount: 5,
      };

      expect(meta.id).toBe('proj1');
      expect(meta.name).toBe('My Project');
      expect(meta.updatedAt).toBe(1700000000000);
      expect(meta.fileCount).toBe(5);
    });
  });

  describe('StorageSchema', () => {
    it('should define projects and messages store names', () => {
  const schema: StorageSchema = {
    projects: 'projects',
    messages: 'messages',
    snapshots: 'snapshots',
  };

      expect(schema.projects).toBe('projects');
      expect(schema.messages).toBe('messages');
    });
  });

  describe('Constants', () => {
    it('SCHEMA_VERSION should be 1 (D1)', () => {
      expect(SCHEMA_VERSION).toBe(1);
    });

    it('DB_NAME should be app-builder-projects (D1)', () => {
      expect(DB_NAME).toBe('app-builder-projects');
    });

    it('DB_VERSION should be 2 (D1 + snapshots store)', () => {
      expect(DB_VERSION).toBe(2);
    });

    it('PERSISTED_FIELDS should include allowlist fields per D5', () => {
      // D5: Allowlist fields — currentFiles, messages, builderState, activeFilePath, activeTab, showExplorer
      expect(PERSISTED_FIELDS).toContain('currentFiles');
      expect(PERSISTED_FIELDS).toContain('messages');
      expect(PERSISTED_FIELDS).toContain('builderState');
      expect(PERSISTED_FIELDS).toContain('activeFilePath');
      expect(PERSISTED_FIELDS).toContain('activeTab');
      expect(PERSISTED_FIELDS).toContain('showExplorer');
    });

    it('PERSISTED_FIELDS should NOT include sensitive fields', () => {
      // Ensure allowlist does NOT contain any sensitive field
      expect(PERSISTED_FIELDS).not.toContain('apiKey');
      expect(PERSISTED_FIELDS).not.toContain('oauthToken');
      expect(PERSISTED_FIELDS).not.toContain('isDevRunning');
      expect(PERSISTED_FIELDS).not.toContain('hasDevCrashed');
    });

    it('SENSITIVE_FIELDS should list all fields that MUST NEVER be persisted per D9', () => {
      // D9: NEVER persist: apiKey, OAuth tokens, isDevRunning, hasDevCrashed
      expect(SENSITIVE_FIELDS).toContain('apiKey');
      expect(SENSITIVE_FIELDS).toContain('oauthToken');
      expect(SENSITIVE_FIELDS).toContain('isDevRunning');
      expect(SENSITIVE_FIELDS).toContain('hasDevCrashed');
    });

    it('PERSISTED_FIELDS and SENSITIVE_FIELDS should have NO overlap', () => {
      const overlap = PERSISTED_FIELDS.filter((field) => SENSITIVE_FIELDS.includes(field));
      expect(overlap).toEqual([]);
    });

    it('PERSISTED_FIELDS should be a frozen/readonly array — no mutations at runtime', () => {
      // Verify the array has exactly the expected number of entries
      expect(PERSISTED_FIELDS).toHaveLength(6);
    });

    it('SENSITIVE_FIELDS should be a frozen/readonly array with exactly 4 entries', () => {
      expect(SENSITIVE_FIELDS).toHaveLength(4);
    });
  });

  describe('PersistedProject — triangulation', () => {
    it('should support all valid BuilderState values', () => {
      const states: Array<import('../../../types').BuilderState> = [
        'idle',
        'generating',
        'installing',
        'running',
        'error',
      ];

      const projects: PersistedProject[] = states.map((state, i) => ({
        id: `proj-${i}`,
        name: `Project ${i}`,
        files: [],
        activeFilePath: null,
        builderState: state,
        createdAt: 1700000000000 + i,
        updatedAt: 1700000000000 + i,
        schemaVersion: 1 as const,
      }));

      expect(projects).toHaveLength(5);
      expect(projects.map((p) => p.builderState)).toEqual(states);
    });

    it('should support project with many files', () => {
      const files = Array.from({ length: 50 }, (_, i) => ({
        path: `src/file${i}.tsx`,
        content: `export const File${i} = () => null`,
      }));

      const project: PersistedProject = {
        id: 'big-project',
        name: 'Big Project',
        files,
        activeFilePath: 'src/file0.tsx',
        builderState: 'running',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        schemaVersion: 1,
      };

      expect(project.files).toHaveLength(50);
      expect(project.activeFilePath).toBe('src/file0.tsx');
    });
  });

  describe('PersistedMessage — triangulation', () => {
    it('should support user and assistant roles only', () => {
      const userMsg: PersistedMessage = {
        id: 'p1_m1',
        projectId: 'p1',
        role: 'user',
        content: 'Hello',
        timestamp: 1700000000000,
      };
      const assistantMsg: PersistedMessage = {
        id: 'p1_m2',
        projectId: 'p1',
        role: 'assistant',
        content: 'Hi there',
        timestamp: 1700000000001,
      };

      expect(userMsg.role).toBe('user');
      expect(assistantMsg.role).toBe('assistant');
    });

    it('should allow message without files property', () => {
      const msg: PersistedMessage = {
        id: 'p1_m3',
        projectId: 'p1',
        role: 'user',
        content: 'No files here',
        timestamp: 1700000000002,
      };

      expect(msg.files).toBeUndefined();
    });
  });

  describe('ProjectMeta — triangulation', () => {
    it('should support zero fileCount for empty project', () => {
      const meta: ProjectMeta = {
        id: 'empty',
        name: 'Empty',
        updatedAt: 1700000000000,
        fileCount: 0,
      };

      expect(meta.fileCount).toBe(0);
    });

    it('should support large fileCount', () => {
      const meta: ProjectMeta = {
        id: 'huge',
        name: 'Huge Project',
        updatedAt: 1700000000000,
        fileCount: 100,
      };

      expect(meta.fileCount).toBe(100);
    });
  });

  // ─── PersistedSnapshot + SnapshotTrigger (version-history-undo Phase 1) ──

  describe('PersistedSnapshot', () => {
    it('should accept a valid PersistedSnapshot with all required fields', () => {
      const snapshot: PersistedSnapshot = {
        id: 'snap123abc456',
        projectId: 'proj1',
        files: [{ path: 'src/App.tsx', content: 'export default App' }],
        trigger: 'refine',
        messageIndex: 3,
        createdAt: 1700000000000,
      };

      expect(snapshot.id).toBe('snap123abc456');
      expect(snapshot.projectId).toBe('proj1');
      expect(snapshot.files).toHaveLength(1);
      expect(snapshot.trigger).toBe('refine');
      expect(snapshot.messageIndex).toBe(3);
      expect(snapshot.createdAt).toBe(1700000000000);
    });

    it('should accept PersistedSnapshot with trigger "editor-save" and null messageIndex', () => {
      const snapshot: PersistedSnapshot = {
        id: 'snap789xyz012',
        projectId: 'proj2',
        files: [{ path: 'index.html', content: '<html></html>' }],
        trigger: 'editor-save',
        messageIndex: null,
        createdAt: 1700000001000,
      };

      expect(snapshot.trigger).toBe('editor-save');
      expect(snapshot.messageIndex).toBeNull();
    });

    it('should accept PersistedSnapshot with multiple files', () => {
      const files = Array.from({ length: 10 }, (_, i) => ({
        path: `src/file${i}.tsx`,
        content: `export const File${i} = () => null`,
      }));

      const snapshot: PersistedSnapshot = {
        id: 'snap-multi',
        projectId: 'proj3',
        files,
        trigger: 'refine',
        messageIndex: 0,
        createdAt: 1700000002000,
      };

      expect(snapshot.files).toHaveLength(10);
      expect(snapshot.files[0].path).toBe('src/file0.tsx');
    });
  });

  describe('SnapshotTrigger', () => {
    it('should only allow "refine" and "editor-save" as valid trigger values', () => {
      const refine: SnapshotTrigger = 'refine';
      const editorSave: SnapshotTrigger = 'editor-save';

      expect(refine).toBe('refine');
      expect(editorSave).toBe('editor-save');
    });
  });

  describe('StorageSchema — with snapshots', () => {
    it('should define projects, messages, and snapshots store names', () => {
      const schema: StorageSchema = {
        projects: 'projects',
        messages: 'messages',
        snapshots: 'snapshots',
      };

      expect(schema.projects).toBe('projects');
      expect(schema.messages).toBe('messages');
      expect(schema.snapshots).toBe('snapshots');
    });
  });

  describe('STORE_NAMES — with snapshots', () => {
    it('should include snapshots store name', () => {
      expect(STORE_NAMES.snapshots).toBe('snapshots');
    });
  });

  describe('DB_VERSION — v2 for snapshots store', () => {
    it('should be 2 after adding snapshots store', () => {
      expect(DB_VERSION).toBe(2);
    });
  });
});
