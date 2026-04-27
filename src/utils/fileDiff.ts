import type { ProjectFile } from '../types';

export interface FileDiffEntry {
  path: string;
  status: 'added' | 'removed' | 'modified';
  addedLines: number;
  removedLines: number;
}

/**
 * Computes a simple line-level diff between two project file snapshots.
 * Uses Set-based line comparison (not Myers diff) — pragmatic for AI-generated code
 * where lines are typically wholesale replaced, not subtly edited.
 */
export function computeFileDiff(before: ProjectFile[], after: ProjectFile[]): FileDiffEntry[] {
  const beforeMap = new Map<string, string>();
  for (const f of before) {
    beforeMap.set(f.path, f.content ?? '');
  }

  const afterMap = new Map<string, string>();
  for (const f of after) {
    afterMap.set(f.path, f.content ?? '');
  }

  const diffs: FileDiffEntry[] = [];
  const allPaths = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  for (const path of allPaths) {
    const beforeContent = beforeMap.get(path);
    const afterContent = afterMap.get(path);

    if (beforeContent === undefined && afterContent !== undefined) {
      const lines = afterContent.split('\n').filter((l) => l.trim() !== '');
      diffs.push({ path, status: 'added', addedLines: lines.length, removedLines: 0 });
    } else if (beforeContent !== undefined && afterContent === undefined) {
      const lines = beforeContent.split('\n').filter((l) => l.trim() !== '');
      diffs.push({ path, status: 'removed', addedLines: 0, removedLines: lines.length });
    } else if (beforeContent !== undefined && afterContent !== undefined) {
      if (beforeContent === afterContent) continue;

      const beforeLines = new Set(beforeContent.split('\n'));
      const afterLines = new Set(afterContent.split('\n'));

      let addedCount = 0;
      for (const line of afterLines) {
        if (!beforeLines.has(line)) addedCount++;
      }

      let removedCount = 0;
      for (const line of beforeLines) {
        if (!afterLines.has(line)) removedCount++;
      }

      diffs.push({ path, status: 'modified', addedLines: addedCount, removedLines: removedCount });
    }
  }

  return diffs;
}

/**
 * Formats a list of FileDiffEntry objects into a human-readable summary
 * suitable for display in the chat panel.
 */
export function formatDiffSummary(diffs: FileDiffEntry[]): string {
  if (diffs.length === 0) return '';

  const lines: string[] = [];

  for (const diff of diffs) {
    const prefix = diff.status === 'added' ? '+' : diff.status === 'removed' ? '-' : '~';
    const counts: string[] = [];
    if (diff.addedLines > 0) counts.push(`+${diff.addedLines}`);
    if (diff.removedLines > 0) counts.push(`-${diff.removedLines}`);

    const countStr = counts.length > 0 ? ` (${counts.join('/')})` : '';
    lines.push(`${prefix} ${diff.path}${countStr}`);
  }

  return lines.join('\n');
}
