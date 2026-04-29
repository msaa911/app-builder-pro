/**
 * ShowcasePage Tests
 * Phase 3 — Gallery of persisted local projects (IDB)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import ShowcasePage from '../ShowcasePage';

// ─── Mocks ───────────────────────────────────────────────────────────

// Mock useProjectPersistence
const mockRefreshProjectList = vi.fn();
const mockOpenProject = vi.fn();

vi.mock('../../hooks/useProjectPersistence', () => ({
  useProjectPersistence: () => ({
    projectList: mockProjectList,
    activeProjectId: null,
    activeProjectName: null,
    isRestoring: false,
    refreshProjectList: mockRefreshProjectList,
    openProject: mockOpenProject,
    deleteProject: vi.fn(),
    renameProject: vi.fn(),
    createProject: vi.fn(),
    saveCurrentProject: vi.fn(),
    flushSave: vi.fn(),
  }),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Sparkles: () => <span data-testid="icon-sparkles">Sparkles</span>,
  FolderOpen: () => <span data-testid="icon-folder-open">FolderOpen</span>,
  FileCode2: () => <span data-testid="icon-file-code">FileCode2</span>,
  Clock: () => <span data-testid="icon-clock">Clock</span>,
  ArrowLeft: () => <span data-testid="icon-arrow-left">ArrowLeft</span>,
}));

// ─── Test Helpers ────────────────────────────────────────────────────

let mockProjectList: any[] = [];

function renderShowcase() {
  return render(
    <MemoryRouter>
      <ShowcasePage />
    </MemoryRouter>
  );
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('ShowcasePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectList = [];
  });

  // ── Empty State ─────────────────────────────────────────────────────

  describe('empty state', () => {
    it('should render page title "My Projects"', () => {
      renderShowcase();
      expect(screen.getByTestId('showcase-title')).toHaveTextContent('My Projects');
    });

    it('should show empty state message when no projects exist', () => {
      renderShowcase();
      expect(screen.getByTestId('showcase-empty')).toBeInTheDocument();
      expect(screen.getByTestId('showcase-empty')).toHaveTextContent(/no projects yet/i);
    });

    it('should show "Start Building" link in empty state that navigates to /', () => {
      renderShowcase();
      const link = screen.getByTestId('showcase-start-link');
      expect(link).toHaveAttribute('href', '/');
    });

    it('should not render project cards when list is empty', () => {
      renderShowcase();
      expect(screen.queryByTestId('project-card')).not.toBeInTheDocument();
    });
  });

  // ── Project List ────────────────────────────────────────────────────

  describe('project list', () => {
    const sampleProjects = [
      { id: 'abc123', name: 'My Portfolio', updatedAt: 1745800000000, fileCount: 8 },
      { id: 'def456', name: 'Todo App', updatedAt: 1745900000000, fileCount: 5 },
    ];

    beforeEach(() => {
      mockProjectList = sampleProjects;
    });

    it('should render a project card for each project', () => {
      renderShowcase();
      const cards = screen.getAllByTestId('project-card');
      expect(cards).toHaveLength(2);
    });

    it('should display project name on each card', () => {
      renderShowcase();
      expect(screen.getByText('My Portfolio')).toBeInTheDocument();
      expect(screen.getByText('Todo App')).toBeInTheDocument();
    });

    it('should display file count on each card', () => {
      renderShowcase();
      expect(screen.getByText(/8 files/)).toBeInTheDocument();
      expect(screen.getByText(/5 files/)).toBeInTheDocument();
    });

    it('should link each card to /builder/:id', () => {
      renderShowcase();
      const links = screen.getAllByTestId('project-card-link');
      expect(links[0]).toHaveAttribute('href', '/builder/abc123');
      expect(links[1]).toHaveAttribute('href', '/builder/def456');
    });

    it('should NOT show empty state when projects exist', () => {
      renderShowcase();
      expect(screen.queryByTestId('showcase-empty')).not.toBeInTheDocument();
    });
  });

  // ── Navigation ──────────────────────────────────────────────────────

  describe('navigation', () => {
    it('should render a "Back" link to home page', () => {
      renderShowcase();
      const backLink = screen.getByTestId('showcase-back-link');
      expect(backLink).toHaveAttribute('href', '/');
    });

    it('should render logo link that navigates to home', () => {
      renderShowcase();
      const logoLink = screen.getByTestId('logo-link');
      expect(logoLink).toHaveAttribute('href', '/');
    });
  });

  // ── Data Loading ────────────────────────────────────────────────────

  describe('data loading', () => {
    it('should call refreshProjectList on mount', () => {
      renderShowcase();
      expect(mockRefreshProjectList).toHaveBeenCalledTimes(1);
    });
  });

  // ── Single project display ─────────────────────────────────────────

  describe('single project display', () => {
    beforeEach(() => {
      mockProjectList = [
        { id: 'xyz789', name: 'Dashboard', updatedAt: 1746000000000, fileCount: 12 },
      ];
    });

    it('should render exactly one project card', () => {
      renderShowcase();
      const cards = screen.getAllByTestId('project-card');
      expect(cards).toHaveLength(1);
    });

    it('should display "12 files" text for project with 12 files', () => {
      renderShowcase();
      expect(screen.getByText(/12 files/)).toBeInTheDocument();
    });
  });
});
