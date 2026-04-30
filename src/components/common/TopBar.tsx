import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Share2,
  Check,
  Settings,
  ChevronDown,
  Rocket,
  Database,
  Loader2,
  Cloud,
  LogOut,
  User,
  History,
} from 'lucide-react';
import { type BuilderState } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
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
  /** Whether the Share button is disabled (true when !activeProjectId) */
  isShareDisabled?: boolean;
  /** Callback when Share button is clicked — clipboard logic in BuilderPage */
  onShare?: () => void;
  /** Callback when History button is clicked — version-history-undo */
  onOpenHistory?: () => void;
  /** Callback when Sign In button is clicked (opens SignInModal) — AUTH-008 */
  onSignIn?: () => void;
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
  isShareDisabled = true,
  onShare,
  onOpenHistory,
  onSignIn,
}) => {
  // Auth context — AUTH-007, AUTH-008, AUTH-009
  const { user, logout } = useAuth();
  const isAuthenticated = !!user;

  const isGenerating = state === 'generating' || state === 'installing';
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Share button click handler — TBS-001, TBS-009, TBS-010
  const handleShareClick = useCallback(() => {
    if (isCopied) return; // prevent double-click during copied state
    onShare?.();
    setIsCopied(true);
    copiedTimeoutRef.current = setTimeout(() => setIsCopied(false), 2000);
  }, [isCopied, onShare]);

  // Cleanup timeout on unmount — NFR-002
  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    };
  }, []);

  // Close user dropdown on outside click
  useEffect(() => {
    if (!isUserDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.user-avatar-wrapper')) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [isUserDropdownOpen]);

  const handleToggleDropdown = useCallback(() => {
    setIsProjectDropdownOpen((prev) => !prev);
  }, []);

  const handleToggleUserDropdown = useCallback(() => {
    setIsUserDropdownOpen((prev) => !prev);
  }, []);

  const handleLogout = useCallback(async () => {
    setIsUserDropdownOpen(false);
    await logout();
  }, [logout]);

  // Get user display info from auth metadata — AUTH-007
  const userDisplayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'User';
  const userAvatarUrl =
    user?.user_metadata?.avatar_url ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userDisplayName)}`;

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

        <button
          className={`btn-ghost ${isShareDisabled ? 'disabled' : ''} ${isCopied ? 'copied' : ''}`}
          disabled={isShareDisabled}
          title={isShareDisabled ? 'No project to share' : isCopied ? 'Copied!' : 'Share project link'}
          data-testid="btn-share"
          onClick={handleShareClick}
        >
          {isCopied ? <Check size={18} data-testid="icon-check" /> : <Share2 size={18} />}
          <span>{isCopied ? 'Copied!' : 'Share'}</span>
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
    {onOpenHistory && (
      <button
        className="btn-icon"
        onClick={onOpenHistory}
        data-testid="btn-open-history"
        title="Version History"
      >
        <History size={18} />
      </button>
    )}
    <button className="btn-icon" onClick={onOpenSettings}>
      <Settings size={18} />
    </button>

        {/* Auth-aware user section — AUTH-007, AUTH-008, AUTH-009 */}
        {isAuthenticated ? (
          <div className="user-avatar-wrapper" data-testid="user-avatar-wrapper">
            <button
              className="user-avatar-btn"
              data-testid="user-avatar-btn"
              onClick={handleToggleUserDropdown}
              title={userDisplayName}
            >
              <img
                src={userAvatarUrl}
                alt={userDisplayName}
                data-testid="user-avatar-img"
              />
              <span className="user-avatar-name" data-testid="user-avatar-name">
                {userDisplayName}
              </span>
            </button>
            {isUserDropdownOpen && (
              <div className="user-dropdown" data-testid="user-dropdown">
                <div className="user-dropdown-info" data-testid="user-dropdown-email">
                  {user?.email}
                </div>
                <button
                  className="user-dropdown-item"
                  data-testid="btn-logout"
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            className="btn-outline-sm"
            data-testid="btn-signin"
            onClick={onSignIn}
            title="Sign In"
          >
            <User size={16} />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default TopBar;
