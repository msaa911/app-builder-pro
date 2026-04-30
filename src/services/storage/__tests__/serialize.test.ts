import { describe, it, expect } from 'vitest';
import {
  serializeProject,
  deserializeProject,
  serializeMessages,
  deserializeMessages,
  serializeSnapshot,
  deserializeSnapshot,
} from '../serialize';
import type { PersistedProject, PersistedSnapshot } from '../types';
import type { ProjectFile, ChatMessage } from '../../../types/index';

describe('serialize', () => {
  // ─── serializeProject ─────────────────────────────────────────────────

  describe('serializeProject', () => {
    it('should serialize BuilderPage state into a PersistedProject', () => {
      const now = Date.now();
      const files: ProjectFile[] = [
        { path: 'src/App.tsx', content: 'export default App' },
        { path: 'package.json', content: '{"name": "test"}' },
      ];

      const result = serializeProject({
        id: 'proj1',
        name: 'Test Project',
        files,
        activeFilePath: 'src/App.tsx',
        builderState: 'running',
        activeTab: 'code',
        showExplorer: true,
        now,
      });

      expect(result.id).toBe('proj1');
      expect(result.name).toBe('Test Project');
      expect(result.files).toEqual(files);
      expect(result.activeFilePath).toBe('src/App.tsx');
      expect(result.builderState).toBe('running');
      expect(result.activeTab).toBe('code');
      expect(result.showExplorer).toBe(true);
      expect(result.createdAt).toBe(now);
      expect(result.updatedAt).toBe(now);
      expect(result.schemaVersion).toBe(1);
    });

    it('should handle null activeFilePath', () => {
      const result = serializeProject({
        id: 'proj2',
        name: 'Empty',
        files: [],
        activeFilePath: null,
        builderState: 'idle',
        now: 1000,
      });

      expect(result.activeFilePath).toBeNull();
      expect(result.files).toEqual([]);
    });

    it('should omit optional fields when not provided', () => {
      const result = serializeProject({
        id: 'proj3',
        name: 'Minimal',
        files: [],
        activeFilePath: null,
        builderState: 'idle',
        now: 2000,
      });

      expect(result.activeTab).toBeUndefined();
      expect(result.showExplorer).toBeUndefined();
    });
  });

  // ─── deserializeProject ───────────────────────────────────────────────

  describe('deserializeProject', () => {
    it('should deserialize a PersistedProject back to BuilderPage state shape', () => {
      const persisted: PersistedProject = {
        id: 'proj1',
        name: 'Test Project',
        files: [{ path: 'src/App.tsx', content: 'export default App' }],
        activeFilePath: 'src/App.tsx',
        builderState: 'running',
        activeTab: 'code',
        showExplorer: true,
        createdAt: 1000,
        updatedAt: 2000,
        schemaVersion: 1,
      };

      const result = deserializeProject(persisted);

      expect(result.currentFiles).toEqual(persisted.files);
      expect(result.activeFilePath).toBe('src/App.tsx');
      expect(result.builderState).toBe('running');
      expect(result.activeTab).toBe('code');
      expect(result.showExplorer).toBe(true);
    });

    it('should handle missing optional fields with defaults', () => {
      const persisted: PersistedProject = {
        id: 'proj2',
        name: 'Minimal',
        files: [],
        activeFilePath: null,
        builderState: 'idle',
        createdAt: 1000,
        updatedAt: 2000,
        schemaVersion: 1,
      };

      const result = deserializeProject(persisted);

      expect(result.activeTab).toBe('preview');
      expect(result.showExplorer).toBe(true);
    });

    it('should return null activeFilePath when persisted as null', () => {
      const persisted: PersistedProject = {
        id: 'proj3',
        name: 'No active',
        files: [{ path: 'src/App.tsx', content: 'x' }],
        activeFilePath: null,
        builderState: 'idle',
        createdAt: 1000,
        updatedAt: 2000,
        schemaVersion: 1,
      };

      const result = deserializeProject(persisted);
      expect(result.activeFilePath).toBeNull();
    });
  });

  // ─── serializeMessages / deserializeMessages ──────────────────────────

  describe('serializeMessages', () => {
    it('should convert ChatMessage[] to PersistedMessage[]', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg1',
          role: 'user',
          content: 'Build me a todo app',
          timestamp: 1000,
        },
        {
          id: 'msg2',
          role: 'assistant',
          content: 'Here is your app',
          files: [{ path: 'src/App.tsx', content: 'export default App' }],
          timestamp: 2000,
        },
      ];

      const result = serializeMessages('proj1', messages);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('proj1_msg1');
      expect(result[0].projectId).toBe('proj1');
      expect(result[0].role).toBe('user');
      expect(result[0].content).toBe('Build me a todo app');
      expect(result[1].files).toHaveLength(1);
    });

    it('should handle empty messages array', () => {
      const result = serializeMessages('proj1', []);
      expect(result).toEqual([]);
    });
  });

  describe('deserializeMessages', () => {
    it('should convert PersistedMessage[] back to ChatMessage[]', () => {
      const persisted = [
        {
          id: 'proj1_msg1',
          projectId: 'proj1',
          role: 'user' as const,
          content: 'Build me a todo app',
          timestamp: 1000,
        },
        {
          id: 'proj1_msg2',
          projectId: 'proj1',
          role: 'assistant' as const,
          content: 'Here is your app',
          files: [{ path: 'src/App.tsx', content: 'export default App' }],
          timestamp: 2000,
        },
      ];

      const result = deserializeMessages(persisted);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('msg1');
      expect(result[0].role).toBe('user');
      expect(result[1].files).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const result = deserializeMessages([]);
      expect(result).toEqual([]);
    });
  });

  // ─── Security (D9) ───────────────────────────────────────────────────

  describe('Security boundary (D9)', () => {
    it('serialized project should NEVER contain sensitive fields', () => {
      const result = serializeProject({
        id: 'proj1',
        name: 'Test',
        files: [],
        activeFilePath: null,
        builderState: 'idle',
        now: 1000,
      });

      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('apiKey');
      expect(serialized).not.toContain('oauthToken');
      expect(serialized).not.toContain('isDevRunning');
      expect(serialized).not.toContain('hasDevCrashed');
    });
  });

  // ─── serializeSnapshot / deserializeSnapshot (version-history-undo) ────

  describe('serializeSnapshot', () => {
    it('should serialize files into a PersistedSnapshot with refine trigger', () => {
      const files: ProjectFile[] = [
        { path: 'src/App.tsx', content: 'export default App' },
        { path: 'package.json', content: '{"name": "test"}' },
      ];

      const result = serializeSnapshot({
        id: 'snap1',
        projectId: 'proj1',
        files,
        trigger: 'refine',
        messageIndex: 5,
        createdAt: 1700000000000,
      });

      expect(result.id).toBe('snap1');
      expect(result.projectId).toBe('proj1');
      expect(result.files).toEqual(files);
      expect(result.trigger).toBe('refine');
      expect(result.messageIndex).toBe(5);
      expect(result.createdAt).toBe(1700000000000);
    });

    it('should serialize files with editor-save trigger and null messageIndex', () => {
      const files: ProjectFile[] = [
        { path: 'src/index.tsx', content: 'import React' },
      ];

      const result = serializeSnapshot({
        id: 'snap2',
        projectId: 'proj2',
        files,
        trigger: 'editor-save',
        messageIndex: null,
        createdAt: 1700000001000,
      });

      expect(result.trigger).toBe('editor-save');
      expect(result.messageIndex).toBeNull();
    });

    it('should deep-clone files so original array is not shared', () => {
      const files: ProjectFile[] = [
        { path: 'src/App.tsx', content: 'original' },
      ];

      const result = serializeSnapshot({
        id: 'snap3',
        projectId: 'proj3',
        files,
        trigger: 'refine',
        messageIndex: 0,
        createdAt: 1700000002000,
      });

      // Mutating the result's files should NOT affect the original
      result.files[0].content = 'mutated';
      expect(files[0].content).toBe('original');
    });
  });

  describe('deserializeSnapshot', () => {
    it('should deserialize a PersistedSnapshot and return deep-cloned files', () => {
      const persisted: PersistedSnapshot = {
        id: 'snap1',
        projectId: 'proj1',
        files: [{ path: 'src/App.tsx', content: 'export default App' }],
        trigger: 'refine',
        messageIndex: 3,
        createdAt: 1700000000000,
      };

      const result = deserializeSnapshot(persisted);

      expect(result.id).toBe('snap1');
      expect(result.projectId).toBe('proj1');
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('src/App.tsx');
      expect(result.files[0].content).toBe('export default App');
      expect(result.trigger).toBe('refine');
      expect(result.messageIndex).toBe(3);
    });

    it('should deep-clone files so modifying result does not affect the persisted original', () => {
      const persisted: PersistedSnapshot = {
        id: 'snap2',
        projectId: 'proj2',
        files: [{ path: 'src/App.tsx', content: 'original' }],
        trigger: 'editor-save',
        messageIndex: null,
        createdAt: 1700000001000,
      };

      const result = deserializeSnapshot(persisted);

      // Mutating the deserialized result should NOT affect the persisted original
      result.files[0].content = 'mutated';
      expect(persisted.files[0].content).toBe('original');
    });

    it('should round-trip: deserialize(serialize(data)) should preserve all fields', () => {
      const files: ProjectFile[] = [
        { path: 'src/App.tsx', content: 'export default App' },
        { path: 'package.json', content: '{"name": "round-trip"}' },
      ];

      const serialized = serializeSnapshot({
        id: 'snap-rt',
        projectId: 'proj-rt',
        files,
        trigger: 'refine',
        messageIndex: 10,
        createdAt: 1700000005000,
      });

      const deserialized = deserializeSnapshot(serialized);

      expect(deserialized.id).toBe('snap-rt');
      expect(deserialized.projectId).toBe('proj-rt');
      expect(deserialized.files).toEqual(files);
      expect(deserialized.trigger).toBe('refine');
      expect(deserialized.messageIndex).toBe(10);
      expect(deserialized.createdAt).toBe(1700000005000);
    });
  });
});
