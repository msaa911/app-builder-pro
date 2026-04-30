import { openDB, type IDBPDatabase } from 'idb';
import type { PersistedProject, PersistedMessage, PersistedSnapshot } from './types';
import { DB_NAME, DB_VERSION, STORE_NAMES } from './types';

// ─── Database Schema ──────────────────────────────────────────────────
// D1: IDB database `app-builder-projects` v2
// Stores: 'projects' (key: id) + 'messages' (key: id, index: by-projectId) + 'snapshots' (key: id, index: by-projectId)

interface AppBuilderDB extends IDBPDatabase {
  projects: PersistedProject;
  messages: PersistedMessage;
  snapshots: PersistedSnapshot;
}

// ─── Singleton DB connection ──────────────────────────────────────────

let dbPromise: Promise<IDBPDatabase<AppBuilderDB>> | null = null;

function getDB(): Promise<IDBPDatabase<AppBuilderDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AppBuilderDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Create 'projects' store with keyPath 'id'
      if (!db.objectStoreNames.contains(STORE_NAMES.projects)) {
        db.createObjectStore(STORE_NAMES.projects, { keyPath: 'id' });
      }
      // Create 'messages' store with keyPath 'id' + index on projectId
      if (!db.objectStoreNames.contains(STORE_NAMES.messages)) {
        const messageStore = db.createObjectStore(STORE_NAMES.messages, { keyPath: 'id' });
        messageStore.createIndex('by-projectId', 'projectId');
      }
      // v2 migration: add 'snapshots' store for version-history-undo
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(STORE_NAMES.snapshots)) {
          const snapshotStore = db.createObjectStore(STORE_NAMES.snapshots, { keyPath: 'id' });
          snapshotStore.createIndex('by-projectId', 'projectId');
        }
      }
    },
    });
  }
  return dbPromise;
}

// ─── Reset for testing ────────────────────────────────────────────────

export function resetDBConnection(): void {
  dbPromise = null;
}

// ─── CRUD Operations ──────────────────────────────────────────────────

export const projectDB = {
  // ── Projects ──────────────────────────────────────────────────────

  async getProject(id: string): Promise<PersistedProject | undefined> {
    const db = await getDB();
    return db.get(STORE_NAMES.projects, id);
  },

  async saveProject(project: PersistedProject): Promise<string> {
    const db = await getDB();
    return db.put(STORE_NAMES.projects, project) as Promise<string>;
  },

  async deleteProject(id: string): Promise<void> {
    const db = await getDB();
    // Delete project record
    await db.delete(STORE_NAMES.projects, id);
    // Delete associated messages
    await projectDB.deleteMessages(id);
    // Delete associated snapshots (cascade)
    await projectDB.deleteSnapshots(id);
  },

  async listProjects(): Promise<PersistedProject[]> {
    const db = await getDB();
    const all = await db.getAll(STORE_NAMES.projects);
    // Sort by updatedAt descending (most recent first)
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async getProjectCount(): Promise<number> {
    const db = await getDB();
    const all = await db.getAll(STORE_NAMES.projects);
    return all.length;
  },

  // ── Messages ──────────────────────────────────────────────────────

  async getMessages(projectId: string): Promise<PersistedMessage[]> {
    const db = await getDB();
    return db.getAllFromIndex(STORE_NAMES.messages, 'by-projectId', projectId);
  },

  async saveMessages(messages: PersistedMessage[]): Promise<void> {
    if (messages.length === 0) return;
    const db = await getDB();
    const tx = db.transaction(STORE_NAMES.messages, 'readwrite');
    for (const msg of messages) {
      await tx.store.put(msg);
    }
    await tx.done;
  },

  async deleteMessages(projectId: string): Promise<void> {
    const db = await getDB();
    const messages = await db.getAllFromIndex(STORE_NAMES.messages, 'by-projectId', projectId);
    const tx = db.transaction(STORE_NAMES.messages, 'readwrite');
    for (const msg of messages) {
      await tx.store.delete(msg.id);
    }
    await tx.done;
  },

  // ── Snapshots (version-history-undo) ─────────────────────────────

  async saveSnapshot(snapshot: PersistedSnapshot): Promise<string> {
    const db = await getDB();
    return db.put(STORE_NAMES.snapshots, snapshot) as Promise<string>;
  },

  async getSnapshots(projectId: string): Promise<PersistedSnapshot[]> {
    const db = await getDB();
    const all = await db.getAllFromIndex(STORE_NAMES.snapshots, 'by-projectId', projectId);
    // Sort by createdAt descending (newest first) — matches FIFO eviction order
    return all.sort((a, b) => b.createdAt - a.createdAt);
  },

  async getSnapshotCount(projectId: string): Promise<number> {
    const db = await getDB();
    const all = await db.getAllFromIndex(STORE_NAMES.snapshots, 'by-projectId', projectId);
    return all.length;
  },

  async deleteSnapshot(id: string): Promise<void> {
    const db = await getDB();
    await db.delete(STORE_NAMES.snapshots, id);
  },

  async deleteSnapshots(projectId: string): Promise<void> {
    const db = await getDB();
    const snapshots = await db.getAllFromIndex(STORE_NAMES.snapshots, 'by-projectId', projectId);
    if (snapshots.length === 0) return;
    const tx = db.transaction(STORE_NAMES.snapshots, 'readwrite');
    for (const snap of snapshots) {
      await tx.store.delete(snap.id);
    }
    await tx.done;
  },
};
