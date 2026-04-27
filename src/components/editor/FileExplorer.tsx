import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  Plus,
  FolderPlus,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { type ProjectFile } from '../../types';
import './FileExplorer.css';

interface FileExplorerProps {
  files?: ProjectFile[];
  isLoading?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  onFileSelect?: (path: string) => void;
  selectedPath?: string;
  onNewItem?: (item: { parentPath: string; name: string; type: 'file' | 'folder' }) => void;
  onDeleteItem?: (item: { path: string; type: 'file' | 'folder' }) => void;
}

interface TreeNode {
  name: string;
  type: 'folder' | 'file' | 'creating';
  children?: TreeNode[];
  path?: string;
  content?: string;
  creatingType?: 'file' | 'folder';
}

function buildTree(
  files: ProjectFile[],
  creatingInPath: string | null,
  creatingType: 'file' | 'folder' | null
): TreeNode[] {
  const root: TreeNode[] = [];

  files.forEach((file) => {
    const parts = file.path.split('/').filter(Boolean);
    let current = root;

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      const existing = current.find((n) => n.name === part);

      if (existing) {
        if (!isLast) {
          if (!existing.children) existing.children = [];
          current = existing.children;
        }
      } else {
        const newNode: TreeNode = {
          name: part,
          type: isLast ? 'file' : 'folder',
          children: isLast ? undefined : [],
          path: file.path,
          content: file.content,
        };
        current.push(newNode);
        if (!isLast) current = newNode.children!;
      }
    });
  });

  // Insert virtual 'creating' node if creation is active
  if (creatingInPath !== null && creatingType !== null) {
    const creatingNode: TreeNode = {
      name: '',
      type: 'creating',
      creatingType,
      path: creatingInPath === '/' ? '/__creating__' : creatingInPath + '/__creating__',
    };

    if (creatingInPath === '/') {
      // Insert at root level as first child
      root.unshift(creatingNode);
    } else {
      // Find the folder at creatingInPath and insert as first child
      const findAndInsert = (nodes: TreeNode[], parentPath: string): boolean => {
        for (const node of nodes) {
          if (node.type === 'folder') {
            const nodePath = node.path || node.name;
            if (nodePath === parentPath) {
              if (!node.children) node.children = [];
              node.children.unshift({ ...creatingNode, path: parentPath + '/__creating__' });
              return true;
            }
            if (node.children && findAndInsert(node.children, parentPath)) {
              return true;
            }
          }
        }
        return false;
      };
      findAndInsert(root, creatingInPath);
    }
  }

  return root;
}

interface ConfirmDialogState {
  isOpen: boolean;
  itemPath: string;
  itemType: 'file' | 'folder';
  itemName: string;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  files = [],
  isLoading,
  error,
  onRefresh,
  onFileSelect,
  selectedPath,
  onNewItem,
  onDeleteItem,
}) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [creatingInPath, setCreatingInPath] = useState<string | null>(null);
  const [creatingType, setCreatingType] = useState<'file' | 'folder' | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    folderPath: string;
    itemType?: 'file' | 'folder';
    itemName?: string;
  } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    itemPath: '',
    itemType: 'file',
    itemName: '',
  });
  const [creatingValue, setCreatingValue] = useState('');
  const creatingInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const tree = useMemo(
    () => buildTree(files, creatingInPath, creatingType),
    [files, creatingInPath, creatingType]
  );

  // Auto-focus the creating input when it appears
  useEffect(() => {
    if (creatingInPath !== null && creatingInputRef.current) {
      creatingInputRef.current.focus();
    }
  }, [creatingInPath]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      // Don't close if clicking inside the context menu
      if (contextMenuRef.current && contextMenuRef.current.contains(e.target as Node)) return;
      setContextMenu(null);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu]);

  const toggleFolder = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleStartCreating = (parentPath: string, type: 'file' | 'folder') => {
    setCreatingInPath(parentPath);
    setCreatingType(type);
    setCreatingValue('');

    // If creating inside a folder, auto-expand it
    if (parentPath !== '/') {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        next.add(parentPath);
        return next;
      });
    }
  };

  const handleCreatingConfirm = () => {
    if (creatingInPath !== null && creatingType !== null && creatingValue.trim()) {
      onNewItem?.({
        parentPath: creatingInPath,
        name: creatingValue.trim(),
        type: creatingType,
      });
    }
    setCreatingInPath(null);
    setCreatingType(null);
    setCreatingValue('');
  };

  const handleCreatingCancel = () => {
    setCreatingInPath(null);
    setCreatingType(null);
    setCreatingValue('');
  };

  const handleContextMenu = (
    e: React.MouseEvent,
    itemPath: string,
    itemType: 'file' | 'folder',
    itemName: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, folderPath: itemPath, itemType, itemName });
  };

  const handleDeleteClick = () => {
    if (!contextMenu) return;
    setConfirmDialog({
      isOpen: true,
      itemPath: contextMenu.folderPath,
      itemType: contextMenu.itemType ?? 'file',
      itemName: contextMenu.itemName ?? '',
    });
    setContextMenu(null);
  };

  const handleConfirmDelete = () => {
    if (confirmDialog.isOpen && onDeleteItem) {
      onDeleteItem({ path: confirmDialog.itemPath, type: confirmDialog.itemType });
    }
    setConfirmDialog({ isOpen: false, itemPath: '', itemType: 'file', itemName: '' });
  };

  const handleCancelDelete = () => {
    setConfirmDialog({ isOpen: false, itemPath: '', itemType: 'file', itemName: '' });
  };

  const renderTree = (
    nodes: TreeNode[],
    depth: number = 0,
    parentPath: string = ''
  ): React.ReactNode => {
    return nodes.map((item) => {
      const fullPath = parentPath ? `${parentPath}/${item.name}` : item.name;
      const isExpanded = expandedPaths.has(fullPath);

      // Render creating node as inline input
      if (item.type === 'creating') {
        return (
          <div key="__creating__" className="tree-item">
            <div
              className="item-row creating"
              data-testid="creating-row"
              data-creating-type={item.creatingType}
            >
              {item.creatingType === 'folder' ? (
                <Folder size={14} className="folder-icon" />
              ) : (
                <File size={14} className="file-icon" />
              )}
              <input
                ref={creatingInputRef}
                data-testid="creating-input"
                className="creating-input"
                value={creatingValue}
                onChange={(e) => setCreatingValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreatingConfirm();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCreatingCancel();
                  }
                }}
                placeholder={item.creatingType === 'folder' ? 'folder name' : 'file name'}
              />
            </div>
          </div>
        );
      }

      const isSelected = item.type === 'file' && selectedPath === fullPath;

      return (
        <div key={fullPath} className="tree-item">
          <div
            className={`item-row ${item.type}${isSelected ? ' file-item--selected' : ''}`}
            data-testid="item-row"
            data-type={item.type}
            data-path={fullPath}
            onClick={
              item.type === 'folder'
                ? () => toggleFolder(fullPath)
                : onFileSelect
                  ? () => onFileSelect(fullPath)
                  : undefined
            }
            onContextMenu={(e) =>
              handleContextMenu(e, fullPath, item.type as 'file' | 'folder', item.name)
            }
            style={item.type === 'folder' ? { cursor: 'pointer' } : undefined}
          >
            {item.type === 'folder' ? (
              <>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Folder size={14} className="folder-icon" />
              </>
            ) : (
              <File size={14} className="file-icon" />
            )}
            <span className="item-name" data-testid="item-name">
              {item.name}
            </span>
          </div>

          {item.type === 'folder' && isExpanded && item.children && (
            <div className="tree-children" data-testid="tree-children">
              {renderTree(item.children, depth + 1, fullPath)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div
      className="file-explorer"
      data-testid="file-explorer"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="explorer-header">
        <span>Files</span>
        <div className="explorer-actions">
          <button title="New File" onClick={() => handleStartCreating('/', 'file')}>
            <Plus size={14} />
          </button>
          <button title="New Folder" onClick={() => handleStartCreating('/', 'folder')}>
            <FolderPlus size={14} />
          </button>
        </div>
      </div>

      <div className="file-tree" data-testid="file-tree">
        {isLoading ? (
          <div className="empty-state" data-testid="loading-state">
            <Loader2 size={16} className="spin" /> Loading...
          </div>
        ) : error ? (
          <div className="empty-state" data-testid="error-state">
            <AlertCircle size={16} /> Error reading files: {error.message}
            {onRefresh && (
              <button
                onClick={onRefresh}
                title="Retry"
                data-testid="retry-button"
                className="retry-button"
              >
                <RefreshCw size={12} /> Retry
              </button>
            )}
          </div>
        ) : tree.length > 0 ? (
          renderTree(tree)
        ) : (
          <div className="empty-state">No files</div>
        )}
      </div>

      {contextMenu &&
        createPortal(
          <div
            ref={contextMenuRef}
            className="context-menu"
            data-testid="context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            {contextMenu.itemType === 'folder' && (
              <>
                <div
                  className="context-menu-item"
                  data-testid="context-menu-new-file"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartCreating(contextMenu.folderPath, 'file');
                    setContextMenu(null);
                  }}
                >
                  New File
                </div>
                <div
                  className="context-menu-item"
                  data-testid="context-menu-new-folder"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartCreating(contextMenu.folderPath, 'folder');
                    setContextMenu(null);
                  }}
                >
                  New Folder
                </div>
              </>
            )}
            <div
              className="context-menu-item context-menu-item--danger"
              data-testid="context-menu-delete"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick();
              }}
            >
              Delete
            </div>
          </div>,
          document.body
        )}

      {confirmDialog.isOpen &&
        createPortal(
          <div
            className="confirm-dialog-backdrop"
            data-testid="confirm-dialog-backdrop"
            onClick={handleCancelDelete}
          >
            <div
              className="confirm-dialog"
              data-testid="confirm-dialog"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="confirm-dialog__title">Confirm Deletion</div>
              <div className="confirm-dialog__message" data-testid="confirm-dialog-message">
                {confirmDialog.itemType === 'folder'
                  ? `Delete ${confirmDialog.itemName} and all its contents? This action cannot be undone.`
                  : `Delete ${confirmDialog.itemName}?`}
              </div>
              <div className="confirm-dialog__actions">
                <button
                  className="confirm-dialog__cancel"
                  data-testid="confirm-dialog-cancel"
                  onClick={handleCancelDelete}
                >
                  Cancel
                </button>
                <button
                  className="confirm-dialog__confirm confirm-dialog__confirm--danger"
                  data-testid="confirm-dialog-confirm"
                  onClick={handleConfirmDelete}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default FileExplorer;
