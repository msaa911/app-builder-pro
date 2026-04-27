import type { ProjectFile } from '../types';

/**
 * Merge existing project files with incoming AI-generated files.
 * Pure function — no side effects.
 *
 * - Keeps files absent from AI response (no deletion)
 * - Updates files with matching path (AI version wins — ITR-007)
 * - Adds new files from AI response
 *
 * @returns merged file list + paths that were overwritten (for ITR-007 toast)
 */
export function mergeFiles(
  existingFiles: ProjectFile[],
  incomingFiles: ProjectFile[]
): { merged: ProjectFile[]; overwrittenPaths: string[] } {
  const fileMap = new Map<string, ProjectFile>();
  const overwrittenPaths: string[] = [];

  // Populate map with existing files
  for (const file of existingFiles) {
    fileMap.set(file.path, file);
  }

  // Apply incoming files — overwrite on collision, add new
  for (const file of incomingFiles) {
    if (fileMap.has(file.path)) {
      overwrittenPaths.push(file.path);
    }
    fileMap.set(file.path, file);
  }

  const merged = Array.from(fileMap.values());

  return { merged, overwrittenPaths };
}
