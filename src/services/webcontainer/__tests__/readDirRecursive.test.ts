import { describe, it, expect, vi } from 'vitest';
import { readDirRecursive } from '../readDirRecursive';
import type { ProjectFile } from '../../../types';

// Helper: create a mock fs.readdir that maps directory paths to DirEnt arrays
function createMockFs(
  structure: Record<
    string,
    { name: string; isFile(): boolean; isDirectory(): boolean; isSymbolicLink(): boolean }[]
  >
) {
  return {
    readdir: vi.fn((path: string, _options?: { withFileTypes?: boolean }) => {
      if (structure[path]) {
        return Promise.resolve(structure[path]);
      }
      return Promise.reject(new Error(`ENOENT: no such file or directory, scandir '${path}'`));
    }),
  };
}

describe('readDirRecursive', () => {
  describe('1.1 - flat directory read', () => {
    it('returns ProjectFile[] from flat file entries', async () => {
      // GIVEN: /src contains two files
      const mockFs = createMockFs({
        '/src': [
          {
            name: 'App.tsx',
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          },
          {
            name: 'index.ts',
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          },
        ],
      });

      // WHEN
      const result = await readDirRecursive(mockFs, '/src');

      // THEN - results only contain path (content loaded lazily on click)
      expect(result).toEqual([{ path: 'src/App.tsx' }, { path: 'src/index.ts' }]);
    });

    it('returns multiple files at same level with relative paths', async () => {
      // GIVEN: / contains three files
      const mockFs = createMockFs({
        '/': [
          {
            name: 'index.html',
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          },
          {
            name: 'package.json',
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          },
          {
            name: 'README.md',
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          },
        ],
      });

      // WHEN
      const result = await readDirRecursive(mockFs, '/');

      // THEN - results only contain path (content loaded lazily on click)
      expect(result.map((f) => f.path)).toEqual(['index.html', 'package.json', 'README.md']);
      // No file entry should have a content field
      expect(result.every((f) => !('content' in f))).toBe(true);
    });
  });

  describe('1.2 - nested directory recursion', () => {
    it('recurses into subdirectories', async () => {
      // GIVEN: /src is a directory containing components/App.tsx
      const mockFs = createMockFs({
        '/src': [
          {
            name: 'components',
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
        ],
        '/src/components': [
          {
            name: 'App.tsx',
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          },
        ],
      });

      // WHEN
      const result = await readDirRecursive(mockFs, '/src');

      // THEN - results only contain path (content loaded lazily on click)
      expect(result).toEqual([{ path: 'src/components/App.tsx' }]);
    });

    it('handles 3-level nesting with mixed files and folders', async () => {
      // GIVEN: src/hooks/useAuth.ts and src/utils/helpers/format.ts
      const mockFs = createMockFs({
        '/src': [
          {
            name: 'hooks',
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
          {
            name: 'utils',
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
          {
            name: 'App.tsx',
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          },
        ],
        '/src/hooks': [
          {
            name: 'useAuth.ts',
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          },
        ],
        '/src/utils': [
          {
            name: 'helpers',
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
        ],
        '/src/utils/helpers': [
          {
            name: 'format.ts',
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          },
        ],
      });

      // WHEN
      const result = await readDirRecursive(mockFs, '/src');

      // THEN
      expect(result).toHaveLength(3);
      expect(result.map((f) => f.path)).toEqual([
        'src/hooks/useAuth.ts',
        'src/utils/helpers/format.ts',
        'src/App.tsx',
      ]);
    });
  });

  describe('1.3 - exclude patterns', () => {
    it('excludes node_modules and .git by default', async () => {
      // GIVEN: / contains src/App.tsx, node_modules (dir), .git (dir)
      const mockFs = createMockFs({
        '/': [
          {
            name: 'src',
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
          {
            name: 'node_modules',
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
          {
            name: '.git',
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
        ],
        '/src': [
          {
            name: 'App.tsx',
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          },
        ],
      });

      // WHEN
      const result = await readDirRecursive(mockFs, '/');

      // THEN - node_modules and .git are NOT recursed into
      expect(result).toEqual([{ path: 'src/App.tsx' }]);
      // readdir should NOT have been called for excluded dirs
      expect(mockFs.readdir).not.toHaveBeenCalledWith('/node_modules', expect.anything());
      expect(mockFs.readdir).not.toHaveBeenCalledWith('/.git', expect.anything());
    });

    it('respects custom exclude list', async () => {
      // GIVEN: custom exclude that only excludes 'dist'
      const mockFs = createMockFs({
        '/': [
          {
            name: 'src',
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
          {
            name: 'dist',
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
          {
            name: 'node_modules',
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
        ],
        '/src': [
          {
            name: 'App.tsx',
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          },
        ],
        '/node_modules': [
          {
            name: 'react',
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          },
        ],
      });

      // WHEN - custom exclude only has 'dist'
      const result = await readDirRecursive(mockFs, '/', { exclude: ['dist'] });

      // THEN - node_modules is NOT excluded (we only exclude dist)
      expect(result).toEqual([{ path: 'src/App.tsx' }, { path: 'node_modules/react' }]);
      expect(mockFs.readdir).toHaveBeenCalledWith('/node_modules', expect.anything());
    });

    it('excludes .git directory', async () => {
      // GIVEN: root with .git directory
      const mockFs = createMockFs({
        '/project': [
          {
            name: '.git',
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
          {
            name: 'src',
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
        ],
        '/project/src': [
          {
            name: 'main.ts',
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          },
        ],
      });

      // WHEN
      const result = await readDirRecursive(mockFs, '/project');

      // THEN - results only contain path (content loaded lazily on click)
      expect(result).toEqual([{ path: 'project/src/main.ts' }]);
      expect(mockFs.readdir).not.toHaveBeenCalledWith('/project/.git', expect.anything());
    });
  });

  describe('1.4 - depth limit enforcement', () => {
    it('stops recursion at maxDepth', async () => {
      // GIVEN: structure deeper than maxDepth=2
      const mockFs = createMockFs({
        '/root': [
          {
            name: 'level1',
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
        ],
        '/root/level1': [
          {
            name: 'level2',
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
        ],
        '/root/level1/level2': [
          {
            name: 'level3',
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
        ],
        '/root/level1/level2/level3': [
          {
            name: 'deep.txt',
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          },
        ],
      });

      // WHEN - maxDepth=2 (root=0, level1=1, level2=2)
      const result = await readDirRecursive(mockFs, '/root', { maxDepth: 2 });

      // THEN - no files beyond depth 2
      expect(result).toEqual([]);
      expect(mockFs.readdir).not.toHaveBeenCalledWith('/root/level1/level2', expect.anything());
    });

    it('default maxDepth is 10', async () => {
      // GIVEN: 11-level deep structure
      const structure: Record<
        string,
        { name: string; isFile(): boolean; isDirectory(): boolean; isSymbolicLink(): boolean }[]
      > = {};
      let path = '/root';
      structure[path] = [
        { name: 'd1', isFile: () => false, isDirectory: () => true, isSymbolicLink: () => false },
      ];
      for (let i = 1; i <= 11; i++) {
        path = `${path}/d${i}`;
        if (i < 11) {
          structure[path] = [
            {
              name: `d${i + 1}`,
              isFile: () => false,
              isDirectory: () => true,
              isSymbolicLink: () => false,
            },
          ];
        } else {
          structure[path] = [
            {
              name: 'deep.txt',
              isFile: () => true,
              isDirectory: () => false,
              isSymbolicLink: () => false,
            },
          ];
        }
      }

      const mockFs = createMockFs(structure);

      // WHEN - default maxDepth=10, dirPath starts at depth 0
      // root(d0) → d1(d1) → d2(d2) → ... → d10(d10) → d11(d11, beyond)
      const result = await readDirRecursive(mockFs, '/root');

      // THEN - d11 should NOT be read (depth 11 > maxDepth 10)
      expect(mockFs.readdir).not.toHaveBeenCalledWith(
        '/root/d1/d2/d3/d4/d5/d6/d7/d8/d9/d10/d11',
        expect.anything()
      );
    });

    it('reads files within depth limit', async () => {
      // GIVEN: structure within maxDepth
      const mockFs = createMockFs({
        '/root': [
          {
            name: 'level1',
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
          {
            name: 'readme.txt',
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          },
        ],
        '/root/level1': [
          {
            name: 'file.ts',
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          },
        ],
      });

      // WHEN - maxDepth=2
      const result = await readDirRecursive(mockFs, '/root', { maxDepth: 2 });

      // THEN - results only contain path (content loaded lazily on click)
      expect(result).toEqual([{ path: 'root/level1/file.ts' }, { path: 'root/readme.txt' }]);
    });
  });

  describe('1.5 - empty directory and ENOENT', () => {
    it('returns empty array for empty directory', async () => {
      // GIVEN: /empty contains nothing
      const mockFs = createMockFs({
        '/empty': [],
      });

      // WHEN
      const result = await readDirRecursive(mockFs, '/empty');

      // THEN
      expect(result).toEqual([]);
    });

    it('throws ENOENT for non-existent directory', async () => {
      // GIVEN: path that doesn't exist in mock
      const mockFs = createMockFs({});

      // WHEN / THEN
      await expect(readDirRecursive(mockFs, '/nonexistent')).rejects.toThrow('ENOENT');
    });

    it('returns empty array for directory with only excluded subdirs', async () => {
      // GIVEN: / has only node_modules and .git
      const mockFs = createMockFs({
        '/project': [
          {
            name: 'node_modules',
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
          {
            name: '.git',
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
          {
            name: 'dist',
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
        ],
      });

      // WHEN
      const result = await readDirRecursive(mockFs, '/project');

      // THEN - all entries are excluded dirs, so no files
      expect(result).toEqual([]);
    });
  });

  // FCL-002: readDirRecursive must NOT include content field (lazy loading)
  describe('1.6 - no content field in results (lazy file loading)', () => {
    it('returns file entries without content field', async () => {
      // GIVEN: /src contains App.tsx
      const mockFs = createMockFs({
        '/src': [
          {
            name: 'App.tsx',
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          },
        ],
      });

      // WHEN
      const result = await readDirRecursive(mockFs, '/src');

      // THEN - result should only have path, no content field
      expect(result).toEqual([{ path: 'src/App.tsx' }]);
      // Double-check: content key must not be present
      expect(result[0]).not.toHaveProperty('content');
    });

    it('returns nested file entries without content field', async () => {
      // GIVEN: nested structure
      const mockFs = createMockFs({
        '/src': [
          {
            name: 'components',
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          },
        ],
        '/src/components': [
          {
            name: 'App.tsx',
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          },
        ],
      });

      // WHEN
      const result = await readDirRecursive(mockFs, '/src');

      // THEN - no file entry should have a content field
      expect(result).toEqual([{ path: 'src/components/App.tsx' }]);
      expect(result[0]).not.toHaveProperty('content');
    });

    it('returns multiple files all without content field', async () => {
      // GIVEN: root with multiple files
      const mockFs = createMockFs({
        '/': [
          {
            name: 'index.html',
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          },
          {
            name: 'package.json',
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          },
        ],
      });

      // WHEN
      const result = await readDirRecursive(mockFs, '/');

      // THEN - all files should have only path
      expect(result).toEqual([{ path: 'index.html' }, { path: 'package.json' }]);
      for (const file of result) {
        expect(file).not.toHaveProperty('content');
      }
    });
  });
});
