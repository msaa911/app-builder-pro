import { describe, it, expect } from 'vitest';
import type { ProjectFile } from '../../types';

// ITR-005, ITR-007: mergeFiles — pure function for merging existing and incoming files
// The function does NOT exist yet — these tests SHOULD FAIL (RED phase)
import { mergeFiles } from '../mergeFiles';

describe('mergeFiles', () => {
  // ITR-005: Merge preserves unmodified files
  it('keeps unchanged files when AI returns modified files', () => {
    // Given — currentFiles = [A.tsx, B.tsx, C.tsx], AI returns [A.tsx (modified), D.tsx (new)]
    const existing: ProjectFile[] = [
      { path: 'src/A.tsx', content: 'original A' },
      { path: 'src/B.tsx', content: 'original B' },
      { path: 'src/C.tsx', content: 'original C' },
    ];
    const incoming: ProjectFile[] = [
      { path: 'src/A.tsx', content: 'modified A' },
      { path: 'src/D.tsx', content: 'new D' },
    ];

    // When
    const { merged, overwrittenPaths } = mergeFiles(existing, incoming);

    // Then — result = [A (updated), B (kept), C (kept), D (added)]
    expect(merged).toHaveLength(4);
    const aFile = merged.find((f) => f.path === 'src/A.tsx');
    const bFile = merged.find((f) => f.path === 'src/B.tsx');
    const cFile = merged.find((f) => f.path === 'src/C.tsx');
    const dFile = merged.find((f) => f.path === 'src/D.tsx');
    expect(aFile?.content).toBe('modified A');
    expect(bFile?.content).toBe('original B');
    expect(cFile?.content).toBe('original C');
    expect(dFile?.content).toBe('new D');
    expect(overwrittenPaths).toEqual(['src/A.tsx']);
  });

  // ITR-005: AI returns empty files
  it('preserves all existing files when AI returns empty array', () => {
    // Given — currentFiles = [A.tsx, B.tsx], AI returns no files
    const existing: ProjectFile[] = [
      { path: 'src/A.tsx', content: 'content A' },
      { path: 'src/B.tsx', content: 'content B' },
    ];
    const incoming: ProjectFile[] = [];

    // When
    const { merged, overwrittenPaths } = mergeFiles(existing, incoming);

    // Then — result = [A.tsx, B.tsx] unchanged
    expect(merged).toHaveLength(2);
    expect(merged[0].content).toBe('content A');
    expect(merged[1].content).toBe('content B');
    expect(overwrittenPaths).toEqual([]);
  });

  // ITR-005: Add new files without collision
  it('adds new files from AI response when no path collision', () => {
    const existing: ProjectFile[] = [{ path: 'src/App.tsx', content: 'app code' }];
    const incoming: ProjectFile[] = [
      { path: 'src/utils.ts', content: 'util code' },
      { path: 'src/styles.css', content: 'body { margin: 0; }' },
    ];

    const { merged, overwrittenPaths } = mergeFiles(existing, incoming);

    expect(merged).toHaveLength(3);
    expect(overwrittenPaths).toEqual([]);
  });

  // ITR-007: AI version wins on collision, and overwrittenPaths tracks collisions
  it('overwrites existing file with AI version and reports collision path', () => {
    const existing: ProjectFile[] = [{ path: 'src/App.tsx', content: 'user-edited version' }];
    const incoming: ProjectFile[] = [{ path: 'src/App.tsx', content: 'AI-generated version' }];

    const { merged, overwrittenPaths } = mergeFiles(existing, incoming);

    expect(merged).toHaveLength(1);
    expect(merged[0].content).toBe('AI-generated version');
    expect(overwrittenPaths).toEqual(['src/App.tsx']);
  });

  // Edge case: both arrays empty
  it('returns empty result when both existing and incoming are empty', () => {
    const { merged, overwrittenPaths } = mergeFiles([], []);

    expect(merged).toEqual([]);
    expect(overwrittenPaths).toEqual([]);
  });

  // Edge case: only new files, no existing
  it('returns only incoming files when existing is empty', () => {
    const incoming: ProjectFile[] = [
      { path: 'src/App.tsx', content: 'new app' },
      { path: 'index.html', content: '<html></html>' },
    ];

    const { merged, overwrittenPaths } = mergeFiles([], incoming);

    expect(merged).toHaveLength(2);
    expect(overwrittenPaths).toEqual([]);
  });

  // Multiple collisions
  it('reports all overwritten paths when multiple files collide', () => {
    const existing: ProjectFile[] = [
      { path: 'src/App.tsx', content: 'old App' },
      { path: 'src/utils.ts', content: 'old utils' },
      { path: 'src/styles.css', content: 'old styles' },
    ];
    const incoming: ProjectFile[] = [
      { path: 'src/App.tsx', content: 'new App' },
      { path: 'src/utils.ts', content: 'new utils' },
    ];

    const { merged, overwrittenPaths } = mergeFiles(existing, incoming);

    expect(merged).toHaveLength(3);
    expect(overwrittenPaths).toContain('src/App.tsx');
    expect(overwrittenPaths).toContain('src/utils.ts');
    expect(overwrittenPaths).toHaveLength(2);
  });
});
