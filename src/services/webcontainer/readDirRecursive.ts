import type { ProjectFile } from '../../types';

export interface ReadDirOptions {
  exclude?: string[];
  maxDepth?: number;
}

const DEFAULT_EXCLUDES = ['node_modules', '.git', 'dist'];
const DEFAULT_MAX_DEPTH = 10;

interface DirEnt {
  name: string;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

// Use unknown to accept any WC fs object with readdir, then cast internally
// The WebContainer fs.readdir has multiple overloads that don't match a simple type
type WcFs = {
  readdir(path: string, options: { withFileTypes: true }): Promise<DirEnt[]>;
};

export async function readDirRecursive(
  fs: unknown,
  dirPath: string,
  options?: ReadDirOptions
): Promise<ProjectFile[]> {
  const exclude = options?.exclude ?? DEFAULT_EXCLUDES;
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;

  // Cast fs to our expected interface — WC fs supports readdir with withFileTypes
  const wcFs = fs as WcFs;

  const results: ProjectFile[] = [];

  function joinPath(base: string, name: string): string {
    if (base === '/' || base === '') return `/${name}`;
    return `${base}/${name}`;
  }

  async function walk(currentPath: string, depth: number, relativePrefix: string): Promise<void> {
    if (depth >= maxDepth) return;

    const entries = await wcFs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryRelativePath = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;

      if (entry.isFile()) {
        results.push({ path: entryRelativePath });
      } else if (entry.isDirectory()) {
        if (exclude.includes(entry.name)) continue;
        await walk(joinPath(currentPath, entry.name), depth + 1, entryRelativePath);
      }
      // Skip symbolic links
    }
  }

  const initialRelative = dirPath === '/' ? '' : dirPath.replace(/^\//, '');
  await walk(dirPath, 0, initialRelative);
  return results;
}
