import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FolderOpen, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import type { ProjectMeta } from '../../services/storage/types';
import './ProjectDropdown.css';

interface ProjectDropdownProps {
  projectList: ProjectMeta[];
  activeProjectId: string | null;
  activeProjectName: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onOpenProject: (id: string) => Promise<unknown>;
  onCreateProject: (name?: string) => Promise<string>;
  onDeleteProject: (id: string) => Promise<void>;
  onRenameProject: (id: string, name: string) => Promise<void>;
}

const ProjectDropdown: React.FC<ProjectDropdownProps> = ({
  projectList,
  activeProjectId,
  activeProjectName,
  isOpen,
  onToggle,
  onOpenProject,
  onCreateProject,
  onDeleteProject,
  onRenameProject,
}) => {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onToggle();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onToggle]);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleSelectProject = useCallback(
    async (id: string) => {
      if (id === activeProjectId) {
        onToggle();
        return;
      }
      await onOpenProject(id);
      onToggle();
    },
    [activeProjectId, onOpenProject, onToggle]
  );

  const handleCreate = useCallback(async () => {
    try {
      setIsCreating(true);
      await onCreateProject();
      onToggle();
    } catch {
      // Max projects reached — error is handled by caller
    } finally {
      setIsCreating(false);
    }
  }, [onCreateProject, onToggle]);

  const handleDelete = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      await onDeleteProject(id);
    },
    [onDeleteProject]
  );

  const handleStartRename = useCallback((id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(id);
    setRenameValue(name);
  }, []);

  const handleConfirmRename = useCallback(async () => {
    if (renamingId && renameValue.trim()) {
      await onRenameProject(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renamingId, renameValue, onRenameProject]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleConfirmRename();
      } else if (e.key === 'Escape') {
        setRenamingId(null);
        setRenameValue('');
      }
    },
    [handleConfirmRename]
  );

  return (
    <div className="project-dropdown-container" ref={dropdownRef}>
      {/* Trigger is handled by parent (TopBar .project-info) */}
      {isOpen && (
        <div className="project-dropdown" data-testid="project-dropdown">
          <div className="project-dropdown-header">
            <span className="project-dropdown-title">Projects</span>
            <button
              className="project-dropdown-create"
              onClick={handleCreate}
              disabled={isCreating || projectList.length >= 5}
              title={projectList.length >= 5 ? 'Maximum 5 projects reached' : 'New project'}
              data-testid="btn-create-project"
            >
              <Plus size={14} />
              <span>New</span>
            </button>
          </div>

          {projectList.length === 0 ? (
            <div className="project-dropdown-empty">
              <FolderOpen size={20} />
              <span>No projects yet</span>
            </div>
          ) : (
            <ul className="project-dropdown-list">
              {projectList.map((project) => (
                <li
                  key={project.id}
                  className={`project-dropdown-item ${project.id === activeProjectId ? 'active' : ''}`}
                  onClick={() => handleSelectProject(project.id)}
                  data-testid={`project-item-${project.id}`}
                >
                  {renamingId === project.id ? (
                    <div className="project-rename-row">
                      <input
                        ref={renameInputRef}
                        className="project-rename-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={handleRenameKeyDown}
                        onBlur={handleConfirmRename}
                        data-testid="project-rename-input"
                      />
                      <button
                        className="project-rename-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConfirmRename();
                        }}
                        data-testid="project-rename-confirm"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        className="project-rename-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingId(null);
                          setRenameValue('');
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="project-item-info">
                        <span className="project-item-name">
                          {project.id === activeProjectId && activeProjectName
                            ? activeProjectName
                            : project.name}
                        </span>
                        <span className="project-item-meta">
                          {project.fileCount} file{project.fileCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="project-item-actions">
                        <button
                          className="project-item-action"
                          onClick={(e) =>
                            handleStartRename(
                              project.id,
                              project.id === activeProjectId && activeProjectName
                                ? activeProjectName
                                : project.name,
                              e
                            )
                          }
                          title="Rename project"
                          data-testid={`btn-rename-project-${project.id}`}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          className="project-item-action delete"
                          onClick={(e) => handleDelete(project.id, e)}
                          title="Delete project"
                          data-testid={`btn-delete-project-${project.id}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectDropdown;
