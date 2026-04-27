import { describe, it, expect } from 'vitest';
import { computeFileDiff, formatDiffSummary } from '../fileDiff';
import type { ProjectFile } from '../../types';

describe('computeFileDiff', () => {
  it('detects added files (in after but not before)', () => {
    // Given
    const before: ProjectFile[] = [{ path: 'src/App.tsx', content: 'old' }];
    const after: ProjectFile[] = [
      { path: 'src/App.tsx', content: 'old' },
      { path: 'src/New.tsx', content: 'new file' },
    ];

    // When
    const diffs = computeFileDiff(before, after);

    // Then
    const newDiff = diffs.find((d) => d.path === 'src/New.tsx');
    expect(newDiff).toBeDefined();
    expect(newDiff!.status).toBe('added');
    expect(newDiff!.addedLines).toBe(1);
    expect(newDiff!.removedLines).toBe(0);
  });

  it('detects removed files (in before but not after)', () => {
    // Given
    const before: ProjectFile[] = [
      { path: 'src/App.tsx', content: 'old' },
      { path: 'src/Old.tsx', content: 'to be removed' },
    ];
    const after: ProjectFile[] = [{ path: 'src/App.tsx', content: 'old' }];

    // When
    const diffs = computeFileDiff(before, after);

    // Then
    const removedDiff = diffs.find((d) => d.path === 'src/Old.tsx');
    expect(removedDiff).toBeDefined();
    expect(removedDiff!.status).toBe('removed');
    expect(removedDiff!.removedLines).toBe(1);
    expect(removedDiff!.addedLines).toBe(0);
  });

  it('detects modified files with added and removed lines', () => {
    // Given
    const before: ProjectFile[] = [{ path: 'src/App.tsx', content: 'line1\nline2\nline3' }];
    const after: ProjectFile[] = [
      { path: 'src/App.tsx', content: 'line1\nline2-modified\nline3\nline4' },
    ];

    // When
    const diffs = computeFileDiff(before, after);

    // Then
    const modDiff = diffs.find((d) => d.path === 'src/App.tsx');
    expect(modDiff).toBeDefined();
    expect(modDiff!.status).toBe('modified');
    // line1 unchanged, line2 removed+added, line3 unchanged, line4 added
    expect(modDiff!.addedLines).toBeGreaterThanOrEqual(1);
    expect(modDiff!.removedLines).toBeGreaterThanOrEqual(1);
  });

  it('detects unchanged files (same content) — should NOT appear in diff', () => {
    // Given
    const before: ProjectFile[] = [{ path: 'src/App.tsx', content: 'unchanged content' }];
    const after: ProjectFile[] = [{ path: 'src/App.tsx', content: 'unchanged content' }];

    // When
    const diffs = computeFileDiff(before, after);

    // Then — unchanged files should NOT appear in diff
    expect(diffs).toHaveLength(0);
  });

  it('handles empty before (all files are added)', () => {
    // Given
    const before: ProjectFile[] = [];
    const after: ProjectFile[] = [
      { path: 'src/App.tsx', content: 'new' },
      { path: 'src/index.css', content: 'body {}' },
    ];

    // When
    const diffs = computeFileDiff(before, after);

    // Then
    expect(diffs).toHaveLength(2);
    expect(diffs.every((d) => d.status === 'added')).toBe(true);
  });

  it('handles empty after (all files are removed)', () => {
    // Given
    const before: ProjectFile[] = [{ path: 'src/App.tsx', content: 'old' }];
    const after: ProjectFile[] = [];

    // When
    const diffs = computeFileDiff(before, after);

    // Then
    expect(diffs).toHaveLength(1);
    expect(diffs[0].status).toBe('removed');
  });

  it('handles files with undefined content (treated as empty string)', () => {
    // Given
    const before: ProjectFile[] = [{ path: 'src/App.tsx', content: undefined }];
    const after: ProjectFile[] = [{ path: 'src/App.tsx', content: 'some content' }];

    // When
    const diffs = computeFileDiff(before, after);

    // Then
    expect(diffs).toHaveLength(1);
    expect(diffs[0].status).toBe('modified');
    expect(diffs[0].addedLines).toBe(1);
  });
});

describe('formatDiffSummary', () => {
  it('formats added files with + prefix', () => {
    // Given
    const diffs = [
      { path: 'src/New.tsx', status: 'added' as const, addedLines: 5, removedLines: 0 },
    ];

    // When
    const summary = formatDiffSummary(diffs);

    // Then
    expect(summary).toContain('+ src/New.tsx');
    expect(summary).toContain('+5');
  });

  it('formats removed files with - prefix', () => {
    // Given
    const diffs = [
      { path: 'src/Old.tsx', status: 'removed' as const, addedLines: 0, removedLines: 3 },
    ];

    // When
    const summary = formatDiffSummary(diffs);

    // Then
    expect(summary).toContain('- src/Old.tsx');
    expect(summary).toContain('-3');
  });

  it('formats modified files with ~ prefix and both +/- counts', () => {
    // Given
    const diffs = [
      { path: 'src/App.tsx', status: 'modified' as const, addedLines: 3, removedLines: 1 },
    ];

    // When
    const summary = formatDiffSummary(diffs);

    // Then
    expect(summary).toContain('~ src/App.tsx');
    expect(summary).toContain('+3');
    expect(summary).toContain('-1');
  });

  it('returns empty string for empty diff', () => {
    // Given
    const diffs: ReturnType<typeof computeFileDiff> = [];

    // When
    const summary = formatDiffSummary(diffs);

    // Then
    expect(summary).toBe('');
  });

  it('formats multiple diffs in order', () => {
    // Given
    const diffs = [
      { path: 'src/App.tsx', status: 'modified' as const, addedLines: 2, removedLines: 1 },
      { path: 'src/New.tsx', status: 'added' as const, addedLines: 10, removedLines: 0 },
    ];

    // When
    const summary = formatDiffSummary(diffs);

    // Then
    expect(summary).toContain('~ src/App.tsx');
    expect(summary).toContain('+ src/New.tsx');
  });
});
