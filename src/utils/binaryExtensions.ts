/**
 * Set of file extensions that indicate binary files.
 * Used to detect binary files before attempting to load them into Monaco editor.
 */
export const BINARY_EXTENSIONS: Set<string> = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.webp',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.mp3',
  '.mp4',
]);

/**
 * Determines whether a file path points to a binary file based on its extension.
 * Case-insensitive: `.PNG` and `.png` are both detected as binary.
 *
 * @param path - The file path to check
 * @returns true if the file extension is in BINARY_EXTENSIONS, false otherwise
 */
export function isBinaryFile(path: string): boolean {
  const lastDotIndex = path.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === path.length - 1) return false;

  const ext = path.slice(lastDotIndex).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}
