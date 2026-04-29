import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Share2,
  Settings,
  ChevronDown,
  Rocket,
  Database,
  Loader2,
  Cloud,
} from 'lucide-react';
import { type BuilderState } from '../../types';
import { QuotaStatus } from './QuotaStatus';
import ProjectDropdown from './ProjectDropdown';
import type { ProjectMeta } from '../../services/storage/types';
import './TopBar.css';

interface TopBarProps {
  projectName: string;
  state: BuilderState;
  onOpenSettings?: () => void;
  /** Whether user has generated code from AI Builder */
  hasGeneratedCode?: boolean;
  /** Whether user is authenticated with Supabase OAuth */
  hasOAuthToken?: boolean;
  /** Whether backend creation is in progress */
  isCreatingBackend?: boolean;
  /** Callback when "Create Backend" button is clicked */
  onCreateBackend?: () => void;
  /** Whether user is authenticated with Vercel OAuth */
  isVercelAuthenticated?: boolean;
  /** Whether Vercel deployment is in progress */
  isDeploying?: boolean;
  /** Callback when "Deploy to Vercel" button is clicked */
  onDeploy?: () => void;
  /** Project persistence props */
  projectList?: ProjectMeta[];
  activeProjectId?: string | null;
  onOpenProject?: (id: string) => Promise<unknown>;
  onCreateProject?: (name?: string) => Promise<string>;
  onDeleteProject?: (id: string) => Promise<void>;
  onRenameProject?: (id: string, name: string) => Promise<void>;
}

const TopBar: React.FC<TopBarProps> = ({
  projectName,
  state,
  onOpenSettings,
  hasGeneratedCode = false,
  hasOAuthToken = false,
  isCreatingBackend = false,
  onCreateBackend,
  isVercelAuthenticated = false,
  isDeploying = false,
  onDeploy,
  projectList = [],
  activeProjectId = null,
  onOpenProject,
  onCreateProject,
  onDeleteProject,
  onRenameProject,
}) => {
  const isGenerating = state === 'generating' || state === 'installing';
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const handleToggleDropdown = useCallback(() => {
    setIsProjectDropdownOpen((prev) => !prev);
  }, []);

  // Determine backend button state
  const isButtonDisabled = !hasOAuthToken || !hasGeneratedCode || isCreatingBackend;
  const buttonTooltip = !hasGeneratedCode
    ? 'Generate code first'
    : !hasOAuthToken
      ? 'Login with Supabase'
      : isCreatingBackend
        ? 'Creating backend...'
        : 'Create Supabase backend';

  // Determine deploy button state
  const isDeployDisabled = !hasGeneratedCode || isDeploying;
  const deployTooltip = !hasGeneratedCode
    ? 'Generate code first'
    : isDeploying
      ? 'Deploying to Vercel...'
      : !isVercelAuthenticated
        ? 'Login with Vercel to deploy'
        : 'Deploy to Vercel';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <Link to="/" className="logo-compact" data-testid="logo-link" aria-label="Go to home page">
          <Sparkles className="logo-icon active" />
        </Link>
        <div className="project-info" onClick={handleToggleDropdown}>
          <h1 className="project-name">{projectName}</h1>
          <ChevronDown size={14} className={`chevron ${isProjectDropdownOpen ? 'rotated' : ''}`} />
          {onOpenProject && (
            <ProjectDropdown
              projectList={projectList}
              activeProjectId={activeProjectId}
              activeProjectName={projectName}
              isOpen={isProjectDropdownOpen}
              onToggle={handleToggleDropdown}
              onOpenProject={onOpenProject}
              onCreateProject={onCreateProject ?? (async () => '')}
              onDeleteProject={onDeleteProject ?? (async () => {})}
              onRenameProject={onRenameProject ?? (async () => {})}
            />
          )}
        </div>
        {state !== 'idle' && (
          <div className="status-badge fade-in">
            {isGenerating && (
              <div className="loader-dots">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </div>
            )}
            <span>
              {state === 'generating'
                ? 'Generating Code'
                : state === 'installing'
                  ? 'Installing Deps'
                  : state === 'running'
                    ? 'App Running'
                    : 'Error'}
            </span>
          </div>
        )}
      </div>

      <div className="topbar-right">
        {/* Create Backend Button */}
        <button
          className={`btn-backend ${isCreatingBackend ? 'loading' : ''}`}
          onClick={onCreateBackend}
          disabled={isButtonDisabled}
          title={buttonTooltip}
          data-testid="btn-create-backend"
        >
          {isCreatingBackend ? <Loader2 size={16} className="icon-spin" /> : <Database size={16} />}
          <span>{isCreatingBackend ? 'Creating...' : 'Create Backend'}</span>
        </button>

        <button className="btn-ghost">
          <Share2 size={18} />
          <span>Share</span>
        </button>
        <button
          className={`btn-secondary ${isDeploying ? 'loading' : ''}`}
          onClick={onDeploy}
          disabled={isDeployDisabled}
          title={deployTooltip}
          data-testid="btn-deploy-vercel"
        >
          {isDeploying ? <Loader2 size={16} className="icon-spin" /> : <Cloud size={16} />}
          <span>{isDeploying ? 'Deploying...' : 'Deploy'}</span>
        </button>
        <button className="btn-accent">
          <Rocket size={16} />
          <span>Publish App</span>
        </button>
        <div className="divider"></div>
        <QuotaStatus />
        <button className="btn-icon" onClick={onOpenSettings}>
          <Settings size={18} />
        </button>
        <div className="user-avatar">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" />
        </div>
      </div>
    </header>
  );
};

export default TopBar;
