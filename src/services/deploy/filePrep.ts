/**
 * File Preparation Service
 *
 * Reads project files and prepares them for Vercel deployment.
 * Filters excluded paths and base64-encodes file contents.
 *
 * @module services/deploy/filePrep
 */

import type { ProjectFile } from '../../types';
import type { VercelDeploymentFile } from './types';

/** Paths that should be excluded from deployment (startsWith match) */
const DEPLOY_EXCLUDED_PATHS = ['node_modules/', '.git/', 'dist/'];

/**
 * Strips leading slash from a file path if present.
 * Vercel expects relative paths without leading slash.
 */
function stripLeadingSlash(path: string): string {
  return path.startsWith('/') ? path.slice(1) : path;
}

/**
 * Checks if a file path should be excluded from deployment.
 */
function isExcludedPath(path: string): boolean {
  const normalizedPath = stripLeadingSlash(path);
  return DEPLOY_EXCLUDED_PATHS.some((prefix) => normalizedPath.startsWith(prefix));
}

/**
 * Encodes a string to base64, handling Unicode characters.
 * Uses TextEncoder for proper UTF-8 encoding before base64 conversion.
 */
function encodeToBase64(content: string): string {
  const bytes = new TextEncoder().encode(content);
  const binaryString = Array.from(bytes)
    .map((byte) => String.fromCharCode(byte))
    .join('');
  return btoa(binaryString);
}

/**
 * Prepares project files for Vercel deployment.
 *
 * Filters out excluded paths (node_modules, .git, dist),
 * strips leading slashes from paths, and base64-encodes
 * file contents for the Vercel API payload.
 *
 * @param files - Array of project files from WebContainer
 * @returns Array of VercelDeploymentFile ready for the API
 * @throws Error if no files remain after filtering
 *
 * @example
 * ```ts
 * const files: ProjectFile[] = [
 *   { path: 'src/App.tsx', content: 'export default function App() {}' },
 *   { path: 'node_modules/react/index.js', content: '...' },
 * ];
 * const prepared = prepareFiles(files);
 * // prepared = [{ file: 'src/App.tsx', data: '...', encoding: 'base64' }]
 * ```
 */
export function prepareFiles(files: ProjectFile[]): VercelDeploymentFile[] {
  const filtered = files.filter((f) => !isExcludedPath(f.path));

  if (filtered.length === 0) {
    throw new Error('No files to deploy');
  }

  return filtered.map((f) => ({
    file: stripLeadingSlash(f.path),
    data: encodeToBase64(f.content ?? ''),
    encoding: 'base64' as const,
  }));
}
