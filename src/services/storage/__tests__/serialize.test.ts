import { describe, it, expect } from 'vitest';
import {
  serializeProject,
  deserializeProject,
  serializeMessages,
  deserializeMessages,
} from '../serialize';
import type { PersistedProject } from '../types';
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
});
