import type { PersistedProject, PersistedMessage } from './types';
import type { ProjectFile, ChatMessage } from '../../types/index';
import { SCHEMA_VERSION } from './types';

// ─── serializeProject ─────────────────────────────────────────────────
// Converts BuilderPage state into a PersistedProject for IDB storage.
// D5: Allowlist-only — only persists currentFiles, messages, builderState,
//     activeFilePath, activeTab, showExplorer
// D9: NEVER persists apiKey, OAuth tokens, isDevRunning, hasDevCrashed

interface SerializeProjectInput {
  id: string;
  name: string;
  files: ProjectFile[];
  activeFilePath: string | null;
  builderState: string;
  activeTab?: string;
  showExplorer?: boolean;
  now: number;
  createdAt?: number; // preserve original createdAt on updates
}

export function serializeProject(input: SerializeProjectInput): PersistedProject {
  return {
    id: input.id,
    name: input.name,
    files: input.files,
    activeFilePath: input.activeFilePath,
    builderState: input.builderState as PersistedProject['builderState'],
    ...(input.activeTab !== undefined && { activeTab: input.activeTab }),
    ...(input.showExplorer !== undefined && { showExplorer: input.showExplorer }),
    createdAt: input.createdAt ?? input.now,
    updatedAt: input.now,
    schemaVersion: SCHEMA_VERSION,
  };
}

// ─── deserializeProject ───────────────────────────────────────────────
// Converts a PersistedProject back into BuilderPage state shape.

interface DeserializedProjectState {
  currentFiles: ProjectFile[];
  activeFilePath: string | null;
  builderState: string;
  activeTab: string;
  showExplorer: boolean;
}

export function deserializeProject(project: PersistedProject): DeserializedProjectState {
  return {
    currentFiles: project.files,
    activeFilePath: project.activeFilePath,
    builderState: project.builderState,
    activeTab: project.activeTab ?? 'preview',
    showExplorer: project.showExplorer ?? true,
  };
}

// ─── serializeMessages ────────────────────────────────────────────────
// Converts ChatMessage[] to PersistedMessage[] for IDB storage.
// Compound ID: `${projectId}_${msgId}` for IDB key uniqueness.

export function serializeMessages(projectId: string, messages: ChatMessage[]): PersistedMessage[] {
  return messages.map((msg) => ({
    id: `${projectId}_${msg.id}`,
    projectId,
    role: msg.role,
    content: msg.content,
    ...(msg.files && { files: msg.files }),
    timestamp: msg.timestamp,
  }));
}

// ─── deserializeMessages ──────────────────────────────────────────────
// Converts PersistedMessage[] back to ChatMessage[].
// Strips the projectId prefix from the ID to recover the original msgId.

export function deserializeMessages(messages: PersistedMessage[]): ChatMessage[] {
  return messages.map((msg) => ({
    id: msg.id.replace(/^.*_/, ''),
    role: msg.role,
    content: msg.content,
    ...(msg.files && { files: msg.files }),
    timestamp: msg.timestamp,
  }));
}
