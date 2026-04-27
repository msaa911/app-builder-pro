import React, { useState } from 'react';
import { RefreshCw, ExternalLink, Smartphone, Monitor, ShieldCheck, Globe } from 'lucide-react';
import { type BuilderState } from '../../types';
import './PreviewPanel.css';

interface PreviewPanelProps {
  state: BuilderState;
  url?: string;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({ state, url }) => {
  const [hasError, setHasError] = useState(false);
  const isLoading = state === 'generating' || state === 'installing';
  const isError = state === 'error';
  const isRunning = state === 'running' && url;

  const handleRetry = () => setHasError(false);
  const handleIframeError = () => setHasError(true);

  return (
    <div className="preview-panel">
      <div className="preview-toolbar">
        <div className="address-bar glass-accent">
          <Globe size={14} className="icon-globe" />
          <input type="text" value={url || 'localhost:5173'} readOnly />
          <ShieldCheck size={14} className="icon-secure" />
        </div>

        <div className="preview-actions">
          <button className="btn-icon-small" title="Refresh">
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          </button>
          <div className="divider-v"></div>
          <button className="btn-icon-small" title="Mobile View">
            <Smartphone size={14} />
          </button>
          <button className="btn-icon-small active" title="Desktop View">
            <Monitor size={14} />
          </button>
          <div className="divider-v"></div>
          <button className="btn-icon-small" title="Open in New Tab">
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      <div className="preview-viewport">
        {isLoading ? (
          <div className="preview-overlay">
            <div className="loader-container">
              <div className="loading-spinner"></div>
              <h3>{state === 'generating' ? 'Writing Code...' : 'Installing Dependencies...'}</h3>
              <p>Magic is happening in the background.</p>
            </div>
          </div>
        ) : isError ? (
          <div className="preview-error">
            <div className="error-icon">!</div>
            <p>Unable to load preview</p>
          </div>
        ) : isRunning ? (
          hasError ? (
            <div className="preview-error" data-testid="preview-iframe-error">
              <div className="error-icon">!</div>
              <p>Unable to load preview</p>
              <button onClick={handleRetry} data-testid="retry-button">
                Retry
              </button>
            </div>
          ) : (
            <iframe
              src={url}
              sandbox="allow-scripts"
              title="App Preview"
              className="preview-iframe"
              onError={handleIframeError}
            />
          )
        ) : (
          <div className="preview-empty">
            <div className="empty-content">
              <div className="preview-placeholder-art">
                <div className="art-rect rect-1"></div>
                <div className="art-rect rect-2"></div>
                <div className="art-rect rect-3"></div>
              </div>
              <h3>Your app will appear here</h3>
              <p>Type a prompt to start building your application.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPanel;
