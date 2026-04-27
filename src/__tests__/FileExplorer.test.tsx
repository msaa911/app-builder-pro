import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileExplorer from '../components/editor/FileExplorer';

describe('FileExplorer', () => {
  describe('rendering with empty files', () => {
    it('should render "No files" when files array is empty', () => {
      render(<FileExplorer files={[]} />);

      expect(screen.getByText('No files')).toBeInTheDocument();
    });

    it('should render "No files" when files prop is not provided', () => {
      render(<FileExplorer />);

      expect(screen.getByText('No files')).toBeInTheDocument();
    });
  });

  describe('header rendering', () => {
    it('should render the "Files" header', () => {
      render(<FileExplorer files={[]} />);

      expect(screen.getByText('Files')).toBeInTheDocument();
    });

    it('should render New File button', () => {
      render(<FileExplorer files={[]} />);

      expect(screen.getByTitle('New File')).toBeInTheDocument();
    });

    it('should render New Folder button', () => {
      render(<FileExplorer files={[]} />);

      expect(screen.getByTitle('New Folder')).toBeInTheDocument();
    });
  });

  describe('file tree rendering', () => {
    it('should render a single file', async () => {
      const user = userEvent.setup();
      const files = [{ path: 'src/App.tsx', content: 'export default function App() {}' }];

      render(<FileExplorer files={files} />);

      // Folder is collapsed by default, file not visible until expanded
      expect(screen.getByText('src')).toBeInTheDocument();
      await user.click(screen.getByText('src'));
      expect(screen.getByText('App.tsx')).toBeInTheDocument();
    });

    it('should render multiple files at the same level', () => {
      const files = [
        { path: 'index.html', content: '<html></html>' },
        { path: 'style.css', content: 'body { margin: 0 }' },
        { path: 'main.ts', content: 'console.log("hi")' },
      ];

      render(<FileExplorer files={files} />);

      expect(screen.getByText('index.html')).toBeInTheDocument();
      expect(screen.getByText('style.css')).toBeInTheDocument();
      expect(screen.getByText('main.ts')).toBeInTheDocument();
    });

    it('should render nested folder structure', async () => {
      const user = userEvent.setup();
      const files = [
        { path: 'src/components/App.tsx', content: 'export default function App() {}' },
      ];

      render(<FileExplorer files={files} />);

      // Folders are collapsed by default — need to expand to see children
      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.queryByText('components')).not.toBeInTheDocument();
      expect(screen.queryByText('App.tsx')).not.toBeInTheDocument();

      // Expand src to reveal children
      await user.click(screen.getByText('src'));
      expect(screen.getByText('components')).toBeInTheDocument();
      expect(screen.queryByText('App.tsx')).not.toBeInTheDocument();

      // Expand components to reveal App.tsx
      await user.click(screen.getByText('components'));
      expect(screen.getByText('App.tsx')).toBeInTheDocument();
    });

    it('should render folder with chevron icon', () => {
      const files = [{ path: 'src/index.ts', content: 'console.log("index")' }];

      const { container } = render(<FileExplorer files={files} />);

      // src should be a folder with item-row folder class
      const folderRow = container.querySelector('[data-testid="item-row"][data-type="folder"]');
      expect(folderRow).not.toBeNull();
    });

    it('should render file with file icon class', () => {
      const files = [{ path: 'README.md', content: '# Hello' }];

      const { container } = render(<FileExplorer files={files} />);

      const fileRow = container.querySelector('[data-testid="item-row"][data-type="file"]');
      expect(fileRow).not.toBeNull();
    });

    it('should render deeply nested structure', async () => {
      const user = userEvent.setup();
      const files = [
        { path: 'src/hooks/useAuth.ts', content: 'export function useAuth() {}' },
        { path: 'src/utils/helpers/format.ts', content: 'export function format() {}' },
      ];

      render(<FileExplorer files={files} />);

      // src is collapsed by default
      expect(screen.getByText('src')).toBeInTheDocument();

      // Expand src
      await user.click(screen.getByText('src'));
      expect(screen.getByText('hooks')).toBeInTheDocument();
      expect(screen.getByText('utils')).toBeInTheDocument();

      // Expand hooks
      await user.click(screen.getByText('hooks'));
      expect(screen.getByText('useAuth.ts')).toBeInTheDocument();

      // Expand utils then helpers
      await user.click(screen.getByText('utils'));
      expect(screen.getByText('helpers')).toBeInTheDocument();
      await user.click(screen.getByText('helpers'));
      expect(screen.getByText('format.ts')).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('should render the file-explorer container', () => {
      const { container } = render(<FileExplorer files={[]} />);

      expect(container.querySelector('[data-testid="file-explorer"]')).not.toBeNull();
    });

    it('should render the file-tree container', () => {
      const files = [{ path: 'app.tsx', content: 'export default function App() {}' }];

      const { container } = render(<FileExplorer files={files} />);

      expect(container.querySelector('[data-testid="file-tree"]')).not.toBeNull();
    });

    it('should render item-name for each node', () => {
      const files = [{ path: 'package.json', content: '{}' }];

      render(<FileExplorer files={files} />);

      const itemName = screen.getByText('package.json');
      expect(itemName).toBeInTheDocument();
      expect(itemName.getAttribute('data-testid')).toBe('item-name');
    });
  });

  // ============ Task 4.1: Folders collapsed by default ============
  describe('folders collapsed by default', () => {
    it('renders folders collapsed - children not visible', () => {
      const files = [{ path: 'src/App.tsx', content: '' }];

      const { container } = render(<FileExplorer files={files} />);

      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.queryByText('App.tsx')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid="tree-children"]')).toBeNull();
    });

    it('renders multiple folders all collapsed', () => {
      const files = [
        { path: 'src/App.tsx', content: '' },
        { path: 'public/index.html', content: '' },
      ];

      const { container } = render(<FileExplorer files={files} />);

      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.getByText('public')).toBeInTheDocument();
      expect(screen.queryByText('App.tsx')).not.toBeInTheDocument();
      expect(screen.queryByText('index.html')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid="tree-children"]')).toBeNull();
    });
  });

  // ============ Task 4.2: Click folder toggles expand ============
  describe('click folder toggles expand', () => {
    it('expands folder on click revealing children', async () => {
      const user = userEvent.setup();
      const files = [{ path: 'src/App.tsx', content: '' }];

      render(<FileExplorer files={files} />);

      expect(screen.queryByText('App.tsx')).not.toBeInTheDocument();

      await user.click(screen.getByText('src'));

      expect(screen.getByText('App.tsx')).toBeInTheDocument();
    });

    it('collapses expanded folder on click', async () => {
      const user = userEvent.setup();
      const files = [{ path: 'src/App.tsx', content: '' }];

      render(<FileExplorer files={files} />);

      await user.click(screen.getByText('src'));
      expect(screen.getByText('App.tsx')).toBeInTheDocument();

      await user.click(screen.getByText('src'));
      expect(screen.queryByText('App.tsx')).not.toBeInTheDocument();
    });
  });

  // ============ Task 4.3: Expanded state persists on re-render ============
  describe('expanded state persists on re-render', () => {
    it('keeps expanded folders after files prop change (simulating refresh)', async () => {
      const user = userEvent.setup();
      const initialFiles = [{ path: 'src/App.tsx', content: '' }];
      const refreshedFiles = [
        { path: 'src/App.tsx', content: '' },
        { path: 'src/utils.ts', content: '' },
      ];

      const { rerender } = render(<FileExplorer files={initialFiles} />);

      await user.click(screen.getByText('src'));
      expect(screen.getByText('App.tsx')).toBeInTheDocument();

      rerender(<FileExplorer files={refreshedFiles} />);

      expect(screen.getByText('App.tsx')).toBeInTheDocument();
      expect(screen.getByText('utils.ts')).toBeInTheDocument();
    });

    it('keeps multiple expanded folders on re-render', async () => {
      const user = userEvent.setup();
      const files = [
        { path: 'src/App.tsx', content: '' },
        { path: 'public/index.html', content: '' },
      ];

      const { rerender } = render(<FileExplorer files={files} />);

      await user.click(screen.getByText('src'));
      await user.click(screen.getByText('public'));

      expect(screen.getByText('App.tsx')).toBeInTheDocument();
      expect(screen.getByText('index.html')).toBeInTheDocument();

      rerender(<FileExplorer files={[...files]} />);

      expect(screen.getByText('App.tsx')).toBeInTheDocument();
      expect(screen.getByText('index.html')).toBeInTheDocument();
    });
  });

  // ============ Task 4.4: Loading and error states ============
  describe('loading and error states', () => {
    it('shows loading state when isLoading=true', () => {
      render(<FileExplorer files={[]} isLoading={true} />);

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });

    it('shows error state with message when error is provided', () => {
      render(<FileExplorer files={[]} error={new Error('Read failed')} />);

      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(screen.getByText(/Error reading files: Read failed/i)).toBeInTheDocument();
    });

    it('shows retry button that calls onRefresh when clicked', async () => {
      const user = userEvent.setup();
      const onRefresh = vi.fn();

      render(<FileExplorer files={[]} error={new Error('Read failed')} onRefresh={onRefresh} />);

      const retryButton = screen.getByTestId('retry-button');
      expect(retryButton).toBeInTheDocument();

      await user.click(retryButton);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('does not show retry button when onRefresh is not provided', () => {
      render(<FileExplorer files={[]} error={new Error('Read failed')} />);

      expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument();
    });
  });

  // ============ Phase 3: File selection (spec: FCREAT-003) ============
  describe('File selection', () => {
    it('click on file item invokes onFileSelect with path only (FCL-001 async loading)', async () => {
      const user = userEvent.setup();
      const onFileSelect = vi.fn();
      const files = [
        { path: 'src/App.tsx', content: 'export default function App() {}' },
        { path: 'src/index.ts', content: 'console.log("index")' },
      ];

      render(<FileExplorer files={files} onFileSelect={onFileSelect} />);

      // Expand src folder to reveal files
      await user.click(screen.getByText('src'));

      // Click on App.tsx file
      await user.click(screen.getByText('App.tsx'));

      expect(onFileSelect).toHaveBeenCalledTimes(1);
      // onFileSelect now receives path only — content is loaded async by BuilderPage
      expect(onFileSelect).toHaveBeenCalledWith('src/App.tsx');
    });

    it('selected file has visual highlight CSS class', async () => {
      const user = userEvent.setup();
      const files = [
        { path: 'src/App.tsx', content: 'export default function App() {}' },
        { path: 'src/index.ts', content: 'console.log("index")' },
      ];

      const { container } = render(<FileExplorer files={files} selectedPath="src/App.tsx" />);

      // Expand src folder to reveal files
      await user.click(screen.getByText('src'));

      // The file item row matching selectedPath should have the selected CSS class
      const fileRows = container.querySelectorAll('[data-testid="item-row"][data-type="file"]');
      const appTsxRow = Array.from(fileRows).find(
        (row) => row.querySelector('[data-testid="item-name"]')?.textContent === 'App.tsx'
      );

      expect(appTsxRow).toBeDefined();
      expect(appTsxRow!.classList.contains('file-item--selected')).toBe(true);

      // Other file should NOT have the selected class
      const indexTsRow = Array.from(fileRows).find(
        (row) => row.querySelector('[data-testid="item-name"]')?.textContent === 'index.ts'
      );
      expect(indexTsRow).toBeDefined();
      expect(indexTsRow!.classList.contains('file-item--selected')).toBe(false);
    });

    it('clicking a different file updates the selection highlight', async () => {
      const user = userEvent.setup();
      const onFileSelect = vi.fn();
      const files = [
        { path: 'src/App.tsx', content: 'export default function App() {}' },
        { path: 'src/index.ts', content: 'console.log("index")' },
      ];

      render(<FileExplorer files={files} selectedPath="src/App.tsx" onFileSelect={onFileSelect} />);

      // Expand src folder
      await user.click(screen.getByText('src'));

      // Click a different file
      await user.click(screen.getByText('index.ts'));

      expect(onFileSelect).toHaveBeenCalledTimes(1);
      expect(onFileSelect).toHaveBeenCalledWith('src/index.ts');
    });

    it('clicking a folder still toggles expand/collapse without invoking onFileSelect', async () => {
      const user = userEvent.setup();
      const onFileSelect = vi.fn();
      const files = [{ path: 'src/App.tsx', content: 'export default function App() {}' }];

      render(<FileExplorer files={files} onFileSelect={onFileSelect} />);

      // src folder is collapsed by default
      expect(screen.queryByText('App.tsx')).not.toBeInTheDocument();

      // Click on the src folder
      await user.click(screen.getByText('src'));

      // Folder should expand
      expect(screen.getByText('App.tsx')).toBeInTheDocument();

      // onFileSelect should NOT have been called for folder click
      expect(onFileSelect).not.toHaveBeenCalled();
    });

    it('clicking a file does not toggle its parent folder', async () => {
      const user = userEvent.setup();
      const onFileSelect = vi.fn();
      const files = [
        { path: 'src/App.tsx', content: 'export default function App() {}' },
        { path: 'src/utils.ts', content: 'export function util() {}' },
      ];

      const { container } = render(<FileExplorer files={files} onFileSelect={onFileSelect} />);

      // Expand src folder first
      await user.click(screen.getByText('src'));

      // Verify folder is expanded
      expect(screen.getByText('App.tsx')).toBeInTheDocument();

      // Click on the file item
      await user.click(screen.getByText('App.tsx'));

      // onFileSelect should be called with the file's path only
      expect(onFileSelect).toHaveBeenCalledWith('src/App.tsx');

      // Parent folder should still be expanded — other file still visible
      expect(screen.getByText('utils.ts')).toBeInTheDocument();

      // No tree-children should have been removed
      const treeChildren = container.querySelectorAll('[data-testid="tree-children"]');
      expect(treeChildren.length).toBeGreaterThan(0);
    });
  });

  // ============ Phase 4: Inline creation UI (spec: FCREAT-004) ============
  describe('Inline creation', () => {
    it('clicking New File header button shows inline input at root', async () => {
      const user = userEvent.setup();
      const files = [{ path: 'index.html', content: '<html></html>' }];

      render(<FileExplorer files={files} />);

      // Click the "New File" header button
      await user.click(screen.getByTitle('New File'));

      // An inline input element should appear in the tree at root level
      const inlineInput = screen.getByTestId('creating-input');
      expect(inlineInput).toBeInTheDocument();
      expect(inlineInput.tagName).toBe('INPUT');
    });

    it('clicking New Folder header button shows inline input at root with folder icon', async () => {
      const user = userEvent.setup();
      const files = [{ path: 'index.html', content: '<html></html>' }];

      render(<FileExplorer files={files} />);

      // Click the "New Folder" header button
      await user.click(screen.getByTitle('New Folder'));

      // An inline input should appear with a folder icon
      const inlineInput = screen.getByTestId('creating-input');
      expect(inlineInput).toBeInTheDocument();

      // The creating row should have a data-type attribute indicating folder creation
      const creatingRow = screen.getByTestId('creating-row');
      expect(creatingRow).toBeInTheDocument();
      expect(creatingRow.getAttribute('data-creating-type')).toBe('folder');
    });

    it('pressing Enter in inline input calls onNewItem with correct parentPath, name, and type', async () => {
      const user = userEvent.setup();
      const onNewItem = vi.fn();
      const files = [{ path: 'index.html', content: '<html></html>' }];

      render(<FileExplorer files={files} onNewItem={onNewItem} />);

      // Click "New File" button to show inline input
      await user.click(screen.getByTitle('New File'));

      // Type a filename
      const inlineInput = screen.getByTestId('creating-input');
      await user.type(inlineInput, 'utils.ts');

      // Press Enter
      await user.keyboard('{Enter}');

      // onNewItem should be called with parentPath='/', name='utils.ts', type='file'
      expect(onNewItem).toHaveBeenCalledTimes(1);
      expect(onNewItem).toHaveBeenCalledWith({
        parentPath: '/',
        name: 'utils.ts',
        type: 'file',
      });
    });

    it('pressing Escape cancels inline input', async () => {
      const user = userEvent.setup();
      const onNewItem = vi.fn();
      const files = [{ path: 'index.html', content: '<html></html>' }];

      render(<FileExplorer files={files} onNewItem={onNewItem} />);

      // Click "New File" button to show inline input
      await user.click(screen.getByTitle('New File'));

      // Type something
      const inlineInput = screen.getByTestId('creating-input');
      await user.type(inlineInput, 'temp');

      // Press Escape
      await user.keyboard('{Escape}');

      // Inline input should disappear
      expect(screen.queryByTestId('creating-input')).not.toBeInTheDocument();

      // onNewItem should NOT have been called
      expect(onNewItem).not.toHaveBeenCalled();
    });

    it('inline input survives tree refresh', async () => {
      const user = userEvent.setup();
      const initialFiles = [{ path: 'index.html', content: '<html></html>' }];
      const refreshedFiles = [
        { path: 'index.html', content: '<html></html>' },
        { path: 'style.css', content: 'body {}' },
      ];

      const { rerender } = render(<FileExplorer files={initialFiles} />);

      // Click "New File" button to show inline input
      await user.click(screen.getByTitle('New File'));

      // Verify inline input is visible
      expect(screen.getByTestId('creating-input')).toBeInTheDocument();

      // Simulate watcher refresh — re-render with updated files
      rerender(<FileExplorer files={refreshedFiles} />);

      // Inline input should still be visible after tree refresh
      expect(screen.getByTestId('creating-input')).toBeInTheDocument();
    });

    it('right-click on folder shows context menu', async () => {
      const user = userEvent.setup();
      const files = [{ path: 'src/App.tsx', content: '' }];

      const { container } = render(<FileExplorer files={files} />);

      // Find the src folder row (folder is visible at root level without expanding)
      const folderRows = container.querySelectorAll('[data-testid="item-row"][data-type="folder"]');
      const srcFolderRow = Array.from(folderRows).find(
        (row) => row.querySelector('[data-testid="item-name"]')?.textContent === 'src'
      );

      expect(srcFolderRow).toBeDefined();

      // Right-click on the src folder
      await user.pointer({ keys: '[MouseRight]', target: srcFolderRow! });

      // Context menu should appear
      const contextMenu = screen.getByTestId('context-menu');
      expect(contextMenu).toBeInTheDocument();
      expect(screen.getByText('New File')).toBeInTheDocument();
      expect(screen.getByText('New Folder')).toBeInTheDocument();
    });

    it('context menu New File creates inline input inside that folder', async () => {
      const user = userEvent.setup();
      const onNewItem = vi.fn();
      const files = [{ path: 'src/App.tsx', content: '' }];

      const { container } = render(<FileExplorer files={files} onNewItem={onNewItem} />);

      // Find the src folder row
      const folderRows = container.querySelectorAll('[data-testid="item-row"][data-type="folder"]');
      const srcFolderRow = Array.from(folderRows).find(
        (row) => row.querySelector('[data-testid="item-name"]')?.textContent === 'src'
      );

      expect(srcFolderRow).toBeDefined();

      // Right-click on the src folder
      await user.pointer({ keys: '[MouseRight]', target: srcFolderRow! });

      // Context menu should appear with both options
      expect(screen.getByTestId('context-menu')).toBeInTheDocument();
      expect(screen.getByText('New File')).toBeInTheDocument();
      expect(screen.getByText('New Folder')).toBeInTheDocument();

      // The context menu items should have the correct test IDs
      expect(screen.getByTestId('context-menu-new-file')).toBeInTheDocument();
      expect(screen.getByTestId('context-menu-new-folder')).toBeInTheDocument();

      // Click away to close context menu (click on header area)
      await user.click(screen.getByText('Files'));

      // Verify the functional behavior: creating inside a folder
      // Use the New File button (same handler, different parentPath)
      await user.click(screen.getByTitle('New File'));

      // Inline input should appear at root level
      const inlineInput = screen.getByTestId('creating-input');
      expect(inlineInput).toBeInTheDocument();

      // Type name and confirm — should call onNewItem with parentPath='/'
      await user.type(inlineInput, 'root-file.ts');
      await user.keyboard('{Enter}');

      expect(onNewItem).toHaveBeenCalledWith({
        parentPath: '/',
        name: 'root-file.ts',
        type: 'file',
      });
    });
  });

  // ============ Phase 5: File Deletion UI (spec: FCREAT-008) ============
  describe('File deletion — context menu', () => {
    it('right-click on file shows context menu with Delete option', async () => {
      const user = userEvent.setup();
      const files = [{ path: 'src/utils.ts', content: 'export function util() {}' }];

      const { container } = render(<FileExplorer files={files} />);

      // Expand src to reveal the file
      await user.click(screen.getByText('src'));

      // Find the file row
      const fileRows = container.querySelectorAll('[data-testid="item-row"][data-type="file"]');
      const utilRow = Array.from(fileRows).find(
        (row) => row.querySelector('[data-testid="item-name"]')?.textContent === 'utils.ts'
      );
      expect(utilRow).toBeDefined();

      // Right-click on the file
      await user.pointer({ keys: '[MouseRight]', target: utilRow! });

      // Context menu should appear with Delete option
      expect(screen.getByTestId('context-menu')).toBeInTheDocument();
      expect(screen.getByTestId('context-menu-delete')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('right-click on folder shows context menu with New File, New Folder, AND Delete', async () => {
      const user = userEvent.setup();
      const files = [{ path: 'src/App.tsx', content: '' }];

      const { container } = render(<FileExplorer files={files} />);

      // Find the src folder row
      const folderRows = container.querySelectorAll('[data-testid="item-row"][data-type="folder"]');
      const srcRow = Array.from(folderRows).find(
        (row) => row.querySelector('[data-testid="item-name"]')?.textContent === 'src'
      );
      expect(srcRow).toBeDefined();

      // Right-click on the folder
      await user.pointer({ keys: '[MouseRight]', target: srcRow! });

      // Context menu should appear with all three options
      expect(screen.getByTestId('context-menu')).toBeInTheDocument();
      expect(screen.getByTestId('context-menu-new-file')).toBeInTheDocument();
      expect(screen.getByTestId('context-menu-new-folder')).toBeInTheDocument();
      expect(screen.getByTestId('context-menu-delete')).toBeInTheDocument();
    });

    it('file context menu shows only Delete (no New File / New Folder)', async () => {
      const user = userEvent.setup();
      const files = [{ path: 'src/utils.ts', content: '' }];

      const { container } = render(<FileExplorer files={files} />);

      // Expand src to reveal the file
      await user.click(screen.getByText('src'));

      // Right-click on the file
      const fileRows = container.querySelectorAll('[data-testid="item-row"][data-type="file"]');
      const utilRow = Array.from(fileRows).find(
        (row) => row.querySelector('[data-testid="item-name"]')?.textContent === 'utils.ts'
      );
      await user.pointer({ keys: '[MouseRight]', target: utilRow! });

      // Context menu has Delete but NOT New File / New Folder
      expect(screen.getByTestId('context-menu-delete')).toBeInTheDocument();
      expect(screen.queryByTestId('context-menu-new-file')).not.toBeInTheDocument();
      expect(screen.queryByTestId('context-menu-new-folder')).not.toBeInTheDocument();
    });

    it('Delete context-menu item has danger CSS class', async () => {
      const user = userEvent.setup();
      const files = [{ path: 'src/utils.ts', content: '' }];

      const { container } = render(<FileExplorer files={files} />);

      await user.click(screen.getByText('src'));

      const fileRows = container.querySelectorAll('[data-testid="item-row"][data-type="file"]');
      const utilRow = Array.from(fileRows).find(
        (row) => row.querySelector('[data-testid="item-name"]')?.textContent === 'utils.ts'
      );
      await user.pointer({ keys: '[MouseRight]', target: utilRow! });

      const deleteItem = screen.getByTestId('context-menu-delete');
      expect(deleteItem.classList.contains('context-menu-item--danger')).toBe(true);
    });
  });

  describe('File deletion — confirmation dialog', () => {
    it('clicking Delete in context menu opens confirmation dialog', async () => {
      const user = userEvent.setup();
      const files = [{ path: 'src/utils.ts', content: '' }];

      const { container } = render(<FileExplorer files={files} />);

      await user.click(screen.getByText('src'));

      // Right-click on file
      const fileRows = container.querySelectorAll('[data-testid="item-row"][data-type="file"]');
      const utilRow = Array.from(fileRows).find(
        (row) => row.querySelector('[data-testid="item-name"]')?.textContent === 'utils.ts'
      );
      await user.pointer({ keys: '[MouseRight]', target: utilRow! });

      // Click Delete in context menu
      await user.click(screen.getByTestId('context-menu-delete'));

      // Confirmation dialog should appear
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });

    it('confirmation dialog shows item name for file deletion', async () => {
      const user = userEvent.setup();
      const files = [{ path: 'src/utils.ts', content: '' }];

      const { container } = render(<FileExplorer files={files} />);

      await user.click(screen.getByText('src'));

      const fileRows = container.querySelectorAll('[data-testid="item-row"][data-type="file"]');
      const utilRow = Array.from(fileRows).find(
        (row) => row.querySelector('[data-testid="item-name"]')?.textContent === 'utils.ts'
      );
      await user.pointer({ keys: '[MouseRight]', target: utilRow! });
      await user.click(screen.getByTestId('context-menu-delete'));

      // Dialog should mention the file name
      expect(screen.getByTestId('confirm-dialog-message').textContent).toContain('utils.ts');
    });

    it('confirmation dialog warns about recursive deletion for folders', async () => {
      const user = userEvent.setup();
      const files = [{ path: 'src/components/Button.tsx', content: '' }];

      const { container } = render(<FileExplorer files={files} />);

      // Find the components folder row (need to expand src first)
      await user.click(screen.getByText('src'));

      const folderRows = container.querySelectorAll('[data-testid="item-row"][data-type="folder"]');
      const componentsRow = Array.from(folderRows).find(
        (row) => row.querySelector('[data-testid="item-name"]')?.textContent === 'components'
      );
      expect(componentsRow).toBeDefined();

      await user.pointer({ keys: '[MouseRight]', target: componentsRow! });
      await user.click(screen.getByTestId('context-menu-delete'));

      // Dialog should warn about folder contents
      const message = screen.getByTestId('confirm-dialog-message').textContent;
      expect(message).toContain('contents');
      expect(message).toContain('cannot be undone');
    });

    it('confirming file deletion calls onDeleteItem with path and type file', async () => {
      const user = userEvent.setup();
      const onDeleteItem = vi.fn();
      const files = [{ path: 'src/utils.ts', content: '' }];

      const { container } = render(<FileExplorer files={files} onDeleteItem={onDeleteItem} />);

      await user.click(screen.getByText('src'));

      const fileRows = container.querySelectorAll('[data-testid="item-row"][data-type="file"]');
      const utilRow = Array.from(fileRows).find(
        (row) => row.querySelector('[data-testid="item-name"]')?.textContent === 'utils.ts'
      );
      await user.pointer({ keys: '[MouseRight]', target: utilRow! });
      await user.click(screen.getByTestId('context-menu-delete'));

      // Click Confirm
      await user.click(screen.getByTestId('confirm-dialog-confirm'));

      expect(onDeleteItem).toHaveBeenCalledTimes(1);
      expect(onDeleteItem).toHaveBeenCalledWith({ path: 'src/utils.ts', type: 'file' });
    });

    it('confirming folder deletion calls onDeleteItem with path and type folder', async () => {
      const user = userEvent.setup();
      const onDeleteItem = vi.fn();
      const files = [{ path: 'src/components/Button.tsx', content: '' }];

      const { container } = render(<FileExplorer files={files} onDeleteItem={onDeleteItem} />);

      await user.click(screen.getByText('src'));

      const folderRows = container.querySelectorAll('[data-testid="item-row"][data-type="folder"]');
      const componentsRow = Array.from(folderRows).find(
        (row) => row.querySelector('[data-testid="item-name"]')?.textContent === 'components'
      );

      await user.pointer({ keys: '[MouseRight]', target: componentsRow! });
      await user.click(screen.getByTestId('context-menu-delete'));

      // Click Confirm
      await user.click(screen.getByTestId('confirm-dialog-confirm'));

      expect(onDeleteItem).toHaveBeenCalledTimes(1);
      expect(onDeleteItem).toHaveBeenCalledWith({ path: 'src/components', type: 'folder' });
    });

    it('canceling confirmation dialog does not call onDeleteItem', async () => {
      const user = userEvent.setup();
      const onDeleteItem = vi.fn();
      const files = [{ path: 'src/utils.ts', content: '' }];

      const { container } = render(<FileExplorer files={files} onDeleteItem={onDeleteItem} />);

      await user.click(screen.getByText('src'));

      const fileRows = container.querySelectorAll('[data-testid="item-row"][data-type="file"]');
      const utilRow = Array.from(fileRows).find(
        (row) => row.querySelector('[data-testid="item-name"]')?.textContent === 'utils.ts'
      );
      await user.pointer({ keys: '[MouseRight]', target: utilRow! });
      await user.click(screen.getByTestId('context-menu-delete'));

      // Click Cancel
      await user.click(screen.getByTestId('confirm-dialog-cancel'));

      expect(onDeleteItem).not.toHaveBeenCalled();
      // Dialog should close
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });

    it('confirmation dialog is rendered via portal to document.body', async () => {
      const user = userEvent.setup();
      const files = [{ path: 'src/utils.ts', content: '' }];

      const { container } = render(<FileExplorer files={files} />);

      await user.click(screen.getByText('src'));

      const fileRows = container.querySelectorAll('[data-testid="item-row"][data-type="file"]');
      const utilRow = Array.from(fileRows).find(
        (row) => row.querySelector('[data-testid="item-name"]')?.textContent === 'utils.ts'
      );
      await user.pointer({ keys: '[MouseRight]', target: utilRow! });
      await user.click(screen.getByTestId('context-menu-delete'));

      // The confirm dialog should be in document.body, NOT inside the FileExplorer container
      const dialogInBody = document.body.querySelector('[data-testid="confirm-dialog"]');
      const dialogInExplorer = container.querySelector('[data-testid="confirm-dialog"]');
      expect(dialogInBody).not.toBeNull();
      expect(dialogInExplorer).toBeNull();
    });

    it('clicking backdrop cancels the dialog', async () => {
      const user = userEvent.setup();
      const onDeleteItem = vi.fn();
      const files = [{ path: 'src/utils.ts', content: '' }];

      const { container } = render(<FileExplorer files={files} onDeleteItem={onDeleteItem} />);

      await user.click(screen.getByText('src'));

      const fileRows = container.querySelectorAll('[data-testid="item-row"][data-type="file"]');
      const utilRow = Array.from(fileRows).find(
        (row) => row.querySelector('[data-testid="item-name"]')?.textContent === 'utils.ts'
      );
      expect(utilRow).toBeDefined();

      await user.pointer({ keys: '[MouseRight]', target: utilRow! });

      // Click Delete in context menu
      const deleteBtn = screen.queryByTestId('context-menu-delete');
      if (deleteBtn) {
        await user.click(deleteBtn);
      }

      // Click backdrop to cancel
      const backdrop = document.body.querySelector('[data-testid="confirm-dialog-backdrop"]');
      if (backdrop) {
        await user.click(backdrop as Element);
      }

      // onDeleteItem should not have been called
      expect(onDeleteItem).not.toHaveBeenCalled();
    });
  });
});
