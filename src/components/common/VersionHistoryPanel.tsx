/**
 * VersionHistoryPanel — displays list of snapshots with restore/delete actions
 * Task 3.2 GREEN
 */

import React from 'react';
import { X, RotateCcw, Trash2, Loader2, Clock, FileCode } from 'lucide-react';
import type { PersistedSnapshot, SnapshotTrigger } from '../../services/storage/types';
import './VersionHistoryPanel.css';

// ─── Types ─────────────────────────────────────────────────────────────

export interface VersionHistoryPanelProps {
  snapshots: PersistedSnapshot[];
  isLoading: boolean;
  isGenerating: boolean;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

// ─── Display Utils ─────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<SnapshotTrigger, string> = {
  refine: 'Refine',
  'editor-save': 'Editor Save',
};

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

// ─── Component ─────────────────────────────────────────────────────────

const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  snapshots,
  isLoading,
  isGenerating,
  onRestore,
  onDelete,
  onClose,
}) => {
  return (
    <div className="version-history-panel" data-testid="version-history-panel">
      <div className="history-header">
        <div className="history-title">
          <Clock size={18} className="icon-history" />
          <span>Version History</span>
        </div>
        <button
          className="btn-close-history"
          data-testid="btn-close-history"
          onClick={onClose}
          aria-label="Close version history"
        >
          <X size={16} />
        </button>
      </div>

      <div className="history-content">
        {isLoading ? (
          <div className="history-loading" data-testid="history-loading">
            <Loader2 size={24} className="icon-spin" />
            <span>Loading versions...</span>
          </div>
        ) : snapshots.length === 0 ? (
          <div className="history-empty" data-testid="history-empty">
            <FileCode size={32} className="empty-icon" />
            <p>No versions saved yet</p>
            <p className="hint-text">Versions are saved automatically before AI refinements and editor saves.</p>
          </div>
        ) : (
          <ul className="snapshot-list">
            {snapshots.map((snap) => (
              <li
                key={snap.id}
                className="snapshot-item"
                data-testid="snapshot-item"
                data-snapshot-id={snap.id}
              >
                <div className="snapshot-info">
                  <span className="trigger-label">{TRIGGER_LABELS[snap.trigger]}</span>
                  {snap.trigger === 'refine' && snap.messageIndex !== null && (
                    <span className="message-index" data-testid="message-index">
                      #{snap.messageIndex}
                    </span>
                  )}
                  <span className="snapshot-time">{formatRelativeTime(snap.createdAt)}</span>
                </div>
                <div className="snapshot-actions">
                  <button
                    className="btn-restore-snapshot"
                    data-testid="btn-restore-snapshot"
                    onClick={() => onRestore(snap.id)}
                    disabled={isGenerating}
                    title={isGenerating ? 'Cannot restore while generating' : 'Restore this version'}
                  >
                    <RotateCcw size={14} />
                    <span>Restore</span>
                  </button>
                  <button
                    className="btn-delete-snapshot"
                    data-testid="btn-delete-snapshot"
                    onClick={() => onDelete(snap.id)}
                    title="Delete this version"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default VersionHistoryPanel;
