/**
 * ProjectDropdown Tests
 * Validates dropdown rendering, project selection, creation, rename, delete,
 * click-outside close, and max-projects limit.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectDropdown from '../ProjectDropdown';
import type { ProjectMeta } from '../../../services/storage/types';

// Mock lucide-react icons — return simple spans with data-testid
vi.mock('lucide-react', () => ({
  FolderOpen: (props: any) => <span data-testid="icon-folder-open" {...props} />,
  Plus: (props: any) => <span data-testid="icon-plus" {...props} />,
  Trash2: (props: any) => <span data-testid="icon-trash" {...props} />,
  Pencil: (props: any) => <span data-testid="icon-pencil" {...props} />,
  Check: (props: any) => <span data-testid="icon-check" {...props} />,
  X: (props: any) => <span data-testid="icon-x" {...props} />,
}));

// ─── Fixtures ──────────────────────────────────────────────────────────

const makeProject = (overrides: Partial<ProjectMeta> = {}): ProjectMeta => ({
  id: 'proj_abc123',
  name: 'My Project',
  updatedAt: Date.now(),
  fileCount: 3,
  ...overrides,
});

const makeProps = (overrides: Record<string, any> = {}) => ({
  projectList: [] as ProjectMeta[],
  activeProjectId: null as string | null,
  activeProjectName: null as string | null,
  isOpen: true,
  onToggle: vi.fn(),
  onOpenProject: vi.fn(async () => {}),
  onCreateProject: vi.fn(async () => 'new-id'),
  onDeleteProject: vi.fn(async () => {}),
  onRenameProject: vi.fn(async () => {}),
  ...overrides,
});

// ─── Tests ─────────────────────────────────────────────────────────────

describe('ProjectDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Rendering ──────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders nothing when isOpen is false', () => {
      const props = makeProps({ isOpen: false });
      render(<ProjectDropdown {...props} />);

      expect(screen.queryByTestId('project-dropdown')).toBeNull();
    });

    it('renders dropdown when isOpen is true', () => {
      const props = makeProps();
      render(<ProjectDropdown {...props} />);

      expect(screen.getByTestId('project-dropdown')).toBeDefined();
    });

    it('shows "Projects" header', () => {
      const props = makeProps();
      render(<ProjectDropdown {...props} />);

      expect(screen.getByText('Projects')).toBeDefined();
    });

    it('shows "New" create button', () => {
      const props = makeProps();
      render(<ProjectDropdown {...props} />);

      expect(screen.getByTestId('btn-create-project')).toBeDefined();
      expect(screen.getByText('New')).toBeDefined();
    });

    it('shows empty state when no projects exist', () => {
      const props = makeProps({ projectList: [] });
      render(<ProjectDropdown {...props} />);

      expect(screen.getByText('No projects yet')).toBeDefined();
    });

    it('renders project list items', () => {
      const projects = [
        makeProject({ id: 'p1', name: 'Alpha', fileCount: 5 }),
        makeProject({ id: 'p2', name: 'Beta', fileCount: 2 }),
      ];
      const props = makeProps({ projectList: projects, activeProjectId: 'p1' });
      render(<ProjectDropdown {...props} />);

      expect(screen.getByTestId('project-item-p1')).toBeDefined();
      expect(screen.getByTestId('project-item-p2')).toBeDefined();
    });

    it('shows file count for each project', () => {
      const projects = [makeProject({ id: 'p1', name: 'Alpha', fileCount: 5 })];
      const props = makeProps({ projectList: projects });
      render(<ProjectDropdown {...props} />);

      expect(screen.getByText('5 files')).toBeDefined();
    });

    it('shows singular "file" for single-file project', () => {
      const projects = [makeProject({ id: 'p1', name: 'Alpha', fileCount: 1 })];
      const props = makeProps({ projectList: projects });
      render(<ProjectDropdown {...props} />);

      expect(screen.getByText('1 file')).toBeDefined();
    });

    it('shows activeProjectName for active project when provided', () => {
      const projects = [makeProject({ id: 'p1', name: 'Stored Name', fileCount: 3 })];
      const props = makeProps({
        projectList: projects,
        activeProjectId: 'p1',
        activeProjectName: 'Live Name',
      });
      render(<ProjectDropdown {...props} />);

      expect(screen.getByText('Live Name')).toBeDefined();
    });

    it('falls back to project.name for non-active projects', () => {
      const projects = [
        makeProject({ id: 'p1', name: 'Active', fileCount: 3 }),
        makeProject({ id: 'p2', name: 'Inactive', fileCount: 1 }),
      ];
      const props = makeProps({
        projectList: projects,
        activeProjectId: 'p1',
        activeProjectName: 'Active Live',
      });
      render(<ProjectDropdown {...props} />);

      expect(screen.getByText('Inactive')).toBeDefined();
    });

    it('applies active class to the active project item', () => {
      const projects = [makeProject({ id: 'p1', name: 'Alpha', fileCount: 3 })];
      const props = makeProps({ projectList: projects, activeProjectId: 'p1' });
      render(<ProjectDropdown {...props} />);

      const item = screen.getByTestId('project-item-p1');
      expect(item.className).toContain('active');
    });
  });

  // ─── Select Project ─────────────────────────────────────────────────

  describe('project selection', () => {
    it('calls onOpenProject and onToggle when clicking a different project', async () => {
      const onOpenProject = vi.fn(async () => {});
      const onToggle = vi.fn();
      const projects = [
        makeProject({ id: 'p1', name: 'Alpha', fileCount: 3 }),
        makeProject({ id: 'p2', name: 'Beta', fileCount: 1 }),
      ];
      const props = makeProps({
        projectList: projects,
        activeProjectId: 'p1',
        onOpenProject,
        onToggle,
      });
      render(<ProjectDropdown {...props} />);

      await userEvent.click(screen.getByTestId('project-item-p2'));

      expect(onOpenProject).toHaveBeenCalledWith('p2');
      expect(onToggle).toHaveBeenCalled();
    });

    it('only calls onToggle when clicking the already-active project', async () => {
      const onOpenProject = vi.fn(async () => {});
      const onToggle = vi.fn();
      const projects = [makeProject({ id: 'p1', name: 'Alpha', fileCount: 3 })];
      const props = makeProps({
        projectList: projects,
        activeProjectId: 'p1',
        onOpenProject,
        onToggle,
      });
      render(<ProjectDropdown {...props} />);

      await userEvent.click(screen.getByTestId('project-item-p1'));

      expect(onOpenProject).not.toHaveBeenCalled();
      expect(onToggle).toHaveBeenCalled();
    });
  });

  // ─── Create Project ─────────────────────────────────────────────────

  describe('create project', () => {
    it('calls onCreateProject and onToggle when "New" button is clicked', async () => {
      const onCreateProject = vi.fn(async () => 'new-id');
      const onToggle = vi.fn();
      const props = makeProps({ onCreateProject, onToggle });
      render(<ProjectDropdown {...props} />);

      await userEvent.click(screen.getByTestId('btn-create-project'));

      expect(onCreateProject).toHaveBeenCalled();
      expect(onToggle).toHaveBeenCalled();
    });

    it('disables "New" button when 5 projects exist', () => {
      const projects = Array.from({ length: 5 }, (_, i) =>
        makeProject({ id: `p${i}`, name: `Project ${i}`, fileCount: i + 1 })
      );
      const props = makeProps({ projectList: projects });
      render(<ProjectDropdown {...props} />);

      const btn = screen.getByTestId('btn-create-project') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('shows max-projects tooltip when 5 projects exist', () => {
      const projects = Array.from({ length: 5 }, (_, i) =>
        makeProject({ id: `p${i}`, name: `Project ${i}`, fileCount: i + 1 })
      );
      const props = makeProps({ projectList: projects });
      render(<ProjectDropdown {...props} />);

      const btn = screen.getByTestId('btn-create-project');
      expect(btn.getAttribute('title')).toBe('Maximum 5 projects reached');
    });

    it('does not call onCreateProject when button is disabled', async () => {
      const onCreateProject = vi.fn(async () => 'new-id');
      const projects = Array.from({ length: 5 }, (_, i) =>
        makeProject({ id: `p${i}`, name: `Project ${i}`, fileCount: i + 1 })
      );
      const props = makeProps({ projectList: projects, onCreateProject });
      render(<ProjectDropdown {...props} />);

      const btn = screen.getByTestId('btn-create-project') as HTMLButtonElement;
      // fireEvent.click works on disabled buttons (bypasses browser) — use userEvent
      // but userEvent won't click disabled buttons, so just verify the mock hasn't been called
      expect(btn.disabled).toBe(true);
      expect(onCreateProject).not.toHaveBeenCalled();
    });
  });

  // ─── Delete Project ─────────────────────────────────────────────────

  describe('delete project', () => {
    it('calls onDeleteProject when delete button is clicked', async () => {
      const onDeleteProject = vi.fn(async () => {});
      const projects = [makeProject({ id: 'p1', name: 'Alpha', fileCount: 3 })];
      const props = makeProps({ projectList: projects, onDeleteProject });
      render(<ProjectDropdown {...props} />);

      const deleteBtn = screen.getByTestId('btn-delete-project-p1');
      await userEvent.click(deleteBtn);

      expect(onDeleteProject).toHaveBeenCalledWith('p1');
    });
  });

  // ─── Rename Project ─────────────────────────────────────────────────

  describe('rename project', () => {
    it('enters rename mode when pencil button is clicked', async () => {
      const projects = [makeProject({ id: 'p1', name: 'Alpha', fileCount: 3 })];
      const props = makeProps({ projectList: projects });
      render(<ProjectDropdown {...props} />);

      const renameBtn = screen.getByTestId('btn-rename-project-p1');
      await userEvent.click(renameBtn);

      // Rename input should appear
      expect(screen.getByTestId('project-rename-input')).toBeDefined();
      expect(screen.getByTestId('project-rename-confirm')).toBeDefined();
    });

    it('pre-fills rename input with current project name', async () => {
      const projects = [makeProject({ id: 'p1', name: 'Alpha', fileCount: 3 })];
      const props = makeProps({ projectList: projects });
      render(<ProjectDropdown {...props} />);

      await userEvent.click(screen.getByTestId('btn-rename-project-p1'));

      const input = screen.getByTestId('project-rename-input') as HTMLInputElement;
      expect(input.value).toBe('Alpha');
    });

    it('calls onRenameProject on Enter key', async () => {
      const onRenameProject = vi.fn(async () => {});
      const projects = [makeProject({ id: 'p1', name: 'Alpha', fileCount: 3 })];
      const props = makeProps({ projectList: projects, onRenameProject });
      render(<ProjectDropdown {...props} />);

      await userEvent.click(screen.getByTestId('btn-rename-project-p1'));

      const input = screen.getByTestId('project-rename-input');
      await userEvent.clear(input);
      await userEvent.type(input, 'Renamed{Enter}');

      expect(onRenameProject).toHaveBeenCalledWith('p1', 'Renamed');
    });

    it('calls onRenameProject on confirm button click', async () => {
      const onRenameProject = vi.fn(async () => {});
      const projects = [makeProject({ id: 'p1', name: 'Alpha', fileCount: 3 })];
      const props = makeProps({ projectList: projects, onRenameProject });
      render(<ProjectDropdown {...props} />);

      await userEvent.click(screen.getByTestId('btn-rename-project-p1'));

      const input = screen.getByTestId('project-rename-input');
      await userEvent.clear(input);
      await userEvent.type(input, 'Renamed');

      await userEvent.click(screen.getByTestId('project-rename-confirm'));

      expect(onRenameProject).toHaveBeenCalledWith('p1', 'Renamed');
    });

    it('cancels rename on Escape key', async () => {
      const onRenameProject = vi.fn(async () => {});
      const projects = [makeProject({ id: 'p1', name: 'Alpha', fileCount: 3 })];
      const props = makeProps({ projectList: projects, onRenameProject });
      render(<ProjectDropdown {...props} />);

      await userEvent.click(screen.getByTestId('btn-rename-project-p1'));

      const input = screen.getByTestId('project-rename-input');
      await userEvent.type(input, '{Escape}');

      // Rename input should disappear
      expect(screen.queryByTestId('project-rename-input')).toBeNull();
      expect(onRenameProject).not.toHaveBeenCalled();
    });

    it('does not call onRenameProject with empty name', async () => {
      const onRenameProject = vi.fn(async () => {});
      const projects = [makeProject({ id: 'p1', name: 'Alpha', fileCount: 3 })];
      const props = makeProps({ projectList: projects, onRenameProject });
      render(<ProjectDropdown {...props} />);

      await userEvent.click(screen.getByTestId('btn-rename-project-p1'));

      const input = screen.getByTestId('project-rename-input');
      await userEvent.clear(input);
      // Type spaces only
      await userEvent.type(input, '   {Enter}');

      expect(onRenameProject).not.toHaveBeenCalled();
    });

    it('calls onRenameProject on blur', async () => {
      const onRenameProject = vi.fn(async () => {});
      const projects = [makeProject({ id: 'p1', name: 'Alpha', fileCount: 3 })];
      const props = makeProps({ projectList: projects, onRenameProject });
      render(<ProjectDropdown {...props} />);

      await userEvent.click(screen.getByTestId('btn-rename-project-p1'));

      const input = screen.getByTestId('project-rename-input');
      await userEvent.clear(input);
      await userEvent.type(input, 'New Name');
      // Blur the input — wrapped in act because async onRenameProject causes state update
      await act(async () => {
        fireEvent.blur(input);
      });

      expect(onRenameProject).toHaveBeenCalledWith('p1', 'New Name');
    });
  });

  // ─── Click Outside ──────────────────────────────────────────────────

  describe('click outside', () => {
    it('calls onToggle when clicking outside the dropdown', () => {
      const onToggle = vi.fn();
      const props = makeProps({ onToggle });
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <ProjectDropdown {...props} />
        </div>
      );

      fireEvent.mouseDown(screen.getByTestId('outside'));

      expect(onToggle).toHaveBeenCalled();
    });

    it('does not call onToggle when clicking inside the dropdown', () => {
      const onToggle = vi.fn();
      const props = makeProps({ onToggle });
      render(<ProjectDropdown {...props} />);

      fireEvent.mouseDown(screen.getByTestId('project-dropdown'));

      expect(onToggle).not.toHaveBeenCalled();
    });

    it('removes event listener when dropdown closes', () => {
      const onToggle = vi.fn();
      const { rerender } = render(<ProjectDropdown {...makeProps({ onToggle, isOpen: true })} />);

      // Rerender with isOpen=false
      rerender(<ProjectDropdown {...makeProps({ onToggle, isOpen: false })} />);

      // Click outside — should NOT trigger onToggle since dropdown is closed
      fireEvent.mouseDown(document.body);

      // onToggle should NOT have been called by the effect (only by us)
      // The effect returns early if isOpen is false
      expect(onToggle).not.toHaveBeenCalled();
    });
  });

  // ─── Create Error Handling ──────────────────────────────────────────

  describe('create error handling', () => {
    it('resets isCreating state when onCreateProject throws', async () => {
      const onCreateProject = vi.fn(async () => {
        throw new Error('Max projects reached');
      });
      const props = makeProps({ onCreateProject });
      render(<ProjectDropdown {...props} />);

      const btn = screen.getByTestId('btn-create-project') as HTMLButtonElement;

      // Click triggers async that catches error internally
      await userEvent.click(btn);

      // After error is caught, button should not remain in loading state
      // (isCreating resets in finally block)
      expect(btn.disabled).toBe(false);
    });
  });
});
