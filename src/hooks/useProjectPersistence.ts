import { useState, useRef, useCallback, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { projectDB } from '../services/storage/projectDB';
import {
  serializeProject,
  deserializeProject,
  serializeMessages,
  deserializeMessages,
} from '../services/storage/serialize';
import type { ProjectMeta } from '../services/storage/types';
import type { ProjectFile, ChatMessage } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────

export interface SavePayload {
  files: ProjectFile[];
  messages: ChatMessage[];
  activeFilePath: string | null;
  builderState: string;
  activeTab?: string;
  showExplorer?: boolean;
}

export interface RestoreData {
  currentFiles: ProjectFile[];
  messages: ChatMessage[];
  activeFilePath: string | null;
  builderState: string;
  activeTab: string;
  showExplorer: boolean;
}

export interface UseProjectPersistenceReturn {
  activeProjectId: string | null;
  activeProjectName: string | null;
  projectList: ProjectMeta[];
  isRestoring: boolean;
  createProject: (name?: string) => Promise<string>;
  openProject: (id: string) => Promise<RestoreData | null>;
  deleteProject: (id: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  saveCurrentProject: (payload: SavePayload) => void;
  flushSave: (payload: SavePayload) => Promise<void>;
  refreshProjectList: () => Promise<void>;
}

// ─── Constants ─────────────────────────────────────────────────────────

const MAX_PROJECTS = 5;
const DEBOUNCE_MS = 2000;

// ─── Hook ──────────────────────────────────────────────────────────────

export function useProjectPersistence(): UseProjectPersistenceReturn {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProjectName, setActiveProjectName] = useState<string | null>(null);
  const [projectList, setProjectList] = useState<ProjectMeta[]>([]);
  const [isRestoring, setIsRestoring] = useState(false);

  // Debounce timer ref
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest payload ref (for debounced save to pick up the most recent)
  const latestPayloadRef = useRef<SavePayload | null>(null);

  // ── refreshProjectList ──────────────────────────────────────────────

  const refreshProjectList = useCallback(async () => {
    try {
      const projects = await projectDB.listProjects();
      const meta: ProjectMeta[] = projects.map((p) => ({
        id: p.id,
        name: p.name,
        updatedAt: p.updatedAt,
        fileCount: p.files.length,
      }));
      setProjectList(meta);
    } catch {
      // Silently fail — project list is non-critical
    }
  }, []);

  // Load project list on mount
  useEffect(() => {
    refreshProjectList();
  }, [refreshProjectList]);

  // ── createProject ───────────────────────────────────────────────────

  const createProject = useCallback(
    async (name?: string): Promise<string> => {
      const count = await projectDB.getProjectCount();
      if (count >= MAX_PROJECTS) {
        throw new Error(
          `Maximum of ${MAX_PROJECTS} projects reached. Delete a project to create a new one.`
        );
      }

      const id = nanoid(12);
      const autoName = name ?? `Project ${count + 1}`;
      const now = Date.now();

      const project = serializeProject({
        id,
        name: autoName,
        files: [],
        activeFilePath: null,
        builderState: 'idle',
        now,
      });

      await projectDB.saveProject(project);
      // Save empty messages
      await projectDB.saveMessages(serializeMessages(id, []));

      setActiveProjectId(id);
      setActiveProjectName(autoName);
      await refreshProjectList();

      return id;
    },
    [refreshProjectList]
  );

  // ── openProject (restore) ───────────────────────────────────────────

  const openProject = useCallback(async (id: string): Promise<RestoreData | null> => {
    setIsRestoring(true);
    try {
      const project = await projectDB.getProject(id);
      if (!project) {
        setIsRestoring(false);
        return null;
      }

      const persistedMessages = await projectDB.getMessages(id);
      const state = deserializeProject(project);
      const messages = deserializeMessages(persistedMessages);

      setActiveProjectId(id);
      setActiveProjectName(project.name);

      return {
        currentFiles: state.currentFiles,
        messages,
        activeFilePath: state.activeFilePath,
        builderState: state.builderState,
        activeTab: state.activeTab,
        showExplorer: state.showExplorer,
      };
    } finally {
      setIsRestoring(false);
    }
  }, []);

  // ── deleteProject ───────────────────────────────────────────────────

  const deleteProject = useCallback(
    async (id: string): Promise<void> => {
      await projectDB.deleteProject(id);

      if (activeProjectId === id) {
        setActiveProjectId(null);
        setActiveProjectName(null);
      }

      await refreshProjectList();
    },
    [activeProjectId, refreshProjectList]
  );

  // ── renameProject ───────────────────────────────────────────────────

  const renameProject = useCallback(
    async (id: string, name: string): Promise<void> => {
      const project = await projectDB.getProject(id);
      if (!project) return;

      const updated = { ...project, name, updatedAt: Date.now() };
      await projectDB.saveProject(updated);

      if (activeProjectId === id) {
        setActiveProjectName(name);
      }

      await refreshProjectList();
    },
    [activeProjectId, refreshProjectList]
  );

  // ── saveCurrentProject (debounced) ──────────────────────────────────

  const saveCurrentProject = useCallback(
    (payload: SavePayload): void => {
      if (!activeProjectId) return;

      // Store latest payload
      latestPayloadRef.current = payload;

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new debounce timer
      debounceTimerRef.current = setTimeout(async () => {
        const latest = latestPayloadRef.current;
        if (!latest || !activeProjectId) return;

        try {
          const existing = await projectDB.getProject(activeProjectId);
          const now = Date.now();

          const project = serializeProject({
            id: activeProjectId,
            name: activeProjectName ?? 'Untitled',
            files: latest.files,
            activeFilePath: latest.activeFilePath,
            builderState: latest.builderState,
            activeTab: latest.activeTab,
            showExplorer: latest.showExplorer,
            now,
            createdAt: existing?.createdAt,
          });

          await projectDB.saveProject(project);
          await projectDB.saveMessages(serializeMessages(activeProjectId, latest.messages));

          await refreshProjectList();
        } catch {
          // Silent fail — auto-save is best-effort
        }
      }, DEBOUNCE_MS);
    },
    [activeProjectId, activeProjectName, refreshProjectList]
  );

  // ── flushSave (immediate, for beforeunload) ─────────────────────────

  const flushSave = useCallback(
    async (payload: SavePayload): Promise<void> => {
      if (!activeProjectId) return;

      // Cancel any pending debounce
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      try {
        const existing = await projectDB.getProject(activeProjectId);
        const now = Date.now();

        const project = serializeProject({
          id: activeProjectId,
          name: activeProjectName ?? 'Untitled',
          files: payload.files,
          activeFilePath: payload.activeFilePath,
          builderState: payload.builderState,
          activeTab: payload.activeTab,
          showExplorer: payload.showExplorer,
          now,
          createdAt: existing?.createdAt,
        });

        await projectDB.saveProject(project);
        await projectDB.saveMessages(serializeMessages(activeProjectId, payload.messages));
      } catch {
        // Silent fail — flushSave is best-effort
      }
    },
    [activeProjectId, activeProjectName]
  );

  // ── Cleanup ─────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    activeProjectId,
    activeProjectName,
    projectList,
    isRestoring,
    createProject,
    openProject,
    deleteProject,
    renameProject,
    saveCurrentProject,
    flushSave,
    refreshProjectList,
  };
}
