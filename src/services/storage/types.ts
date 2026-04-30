import type { ProjectFile, ChatMessage, BuilderState } from '../../types/index';

// ─── Database Constants (D1) ───────────────────────────────────────────

/** IDB database name — design decision D1 */
export const DB_NAME = 'app-builder-projects' as const;

/** IDB database version — bumped to 2 for snapshots store (D1 + version-history) */
export const DB_VERSION = 2 as const;

/** Schema version stored on each project record — D9 */
export const SCHEMA_VERSION = 1 as const;

// ─── Store Names (D1) ─────────────────────────────────────────────────

export interface StorageSchema {
  projects: 'projects';
  messages: 'messages';
  snapshots: 'snapshots';
}

export const STORE_NAMES: StorageSchema = {
  projects: 'projects',
  messages: 'messages',
  snapshots: 'snapshots',
} as const;

// ─── Allowlist Fields (D5) ────────────────────────────────────────────

/**
 * Fields from builder state that ARE allowed to be persisted.
 * Design decision D5: only these fields survive serialization.
 */
export const PERSISTED_FIELDS: readonly string[] = [
  'currentFiles',
  'messages',
  'builderState',
  'activeFilePath',
  'activeTab',
  'showExplorer',
] as const;

/**
 * Fields that MUST NEVER be persisted to IndexedDB.
 * Design decision D9: security — no credentials or runtime state.
 */
export const SENSITIVE_FIELDS: readonly string[] = [
  'apiKey',
  'oauthToken',
  'isDevRunning',
  'hasDevCrashed',
] as const;

// ─── Persisted Project ────────────────────────────────────────────────

export interface PersistedProject {
  /** Project ID — nanoid(12), design decision D2 */
  id: string;
  /** Project name — auto from first message or "Untitled Project" (D5) */
  name: string;
  /** Project files */
  files: ProjectFile[];
  /** Currently active file path — nullable when no files */
  activeFilePath: string | null;
  /** Builder state at time of save */
  builderState: BuilderState;
  /** Active editor tab — 'code' | 'preview' */
  activeTab?: string;
  /** Whether explorer panel is visible */
  showExplorer?: boolean;
  /** Creation timestamp (epoch ms) */
  createdAt: number;
  /** Last update timestamp (epoch ms) */
  updatedAt: number;
  /** Schema version for future migrations (D9) */
  schemaVersion: typeof SCHEMA_VERSION;
}

// ─── Persisted Message ────────────────────────────────────────────────

export interface PersistedMessage {
  /** Compound ID: `${projectId}_${msgId}` */
  id: string;
  /** Foreign key to PersistedProject.id */
  projectId: string;
  /** Message role */
  role: 'user' | 'assistant';
  /** Message content */
  content: string;
  /** Files referenced in this message (stripped of API keys by serialize) */
  files?: ProjectFile[];
  /** Message timestamp (epoch ms) */
  timestamp: number;
}

// ─── Persisted Snapshot (version-history-undo) ────────────────────────

/** Snapshot trigger — what caused the snapshot to be created */
export type SnapshotTrigger = 'refine' | 'editor-save';

export interface PersistedSnapshot {
  /** Snapshot ID — nanoid(12) */
  id: string;
  /** Foreign key to PersistedProject.id */
  projectId: string;
  /** Deep-cloned file state at time of snapshot */
  files: ProjectFile[];
  /** What triggered this snapshot */
  trigger: SnapshotTrigger;
  /** Message index for refine triggers; null for editor-save */
  messageIndex: number | null;
  /** Creation timestamp (epoch ms) */
  createdAt: number;
}

// ─── Project Meta (lightweight listing) ───────────────────────────────

export interface ProjectMeta {
  /** Project ID */
  id: string;
  /** Project name */
  name: string;
  /** Last update timestamp */
  updatedAt: number;
  /** Number of files in project */
  fileCount: number;
}

// ─── Re-exports for convenience ───────────────────────────────────────

export type { ProjectFile, ChatMessage, BuilderState };
