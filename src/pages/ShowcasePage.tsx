import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, FolderOpen, FileCode2, Clock, ArrowLeft } from 'lucide-react';
import { useProjectPersistence } from '../hooks/useProjectPersistence';
import './ShowcasePage.css';

/**
 * ShowcasePage — Gallery of persisted local projects (IDB).
 * Phase 3: Full implementation with project cards + empty state.
 */
const ShowcasePage: React.FC = () => {
  const { projectList, refreshProjectList } = useProjectPersistence();

  // Refresh project list on mount (in case projects changed elsewhere)
  React.useEffect(() => {
    refreshProjectList();
  }, [refreshProjectList]);

  const hasProjects = projectList.length > 0;

  return (
    <div className="showcase-container" data-testid="showcase-container">
      {/* Background Orbs */}
      <div className="bg-orb orb-1"></div>
      <div className="bg-orb orb-2"></div>

      {/* Header */}
      <header className="showcase-header">
        <Link to="/" className="logo-compact" data-testid="logo-link" aria-label="Go to home page">
          <Sparkles className="logo-icon active" />
        </Link>
        <Link to="/" className="btn-back" data-testid="showcase-back-link">
          <ArrowLeft size={16} />
          <span>Back</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="showcase-main">
        <motion.h1
          className="showcase-title"
          data-testid="showcase-title"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          My Projects
        </motion.h1>

        {!hasProjects ? (
          <motion.div
            className="showcase-empty"
            data-testid="showcase-empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <FolderOpen className="empty-icon" />
            <p className="empty-title">No projects yet</p>
            <p className="empty-description">
              Start building your first app and it will appear here.
            </p>
            <Link to="/" className="btn-start" data-testid="showcase-start-link">
              Start Building
            </Link>
          </motion.div>
        ) : (
          <motion.div
            className="project-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {projectList.map((project) => (
              <Link
                key={project.id}
                to={`/builder/${project.id}`}
                className="project-card glass"
                data-testid="project-card-link"
              >
                <div className="project-card-inner" data-testid="project-card">
                  <div className="project-card-header">
                    <FileCode2 size={20} className="project-card-icon" />
                    <h3 className="project-card-name">{project.name}</h3>
                  </div>
                  <div className="project-card-meta">
                    <span className="project-card-files">
                      <FileCode2 size={14} />
                      {project.fileCount} {project.fileCount === 1 ? 'file' : 'files'}
                    </span>
                    <span className="project-card-date">
                      <Clock size={14} />
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default ShowcasePage;
