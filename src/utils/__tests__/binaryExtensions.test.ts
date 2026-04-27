import { describe, it, expect } from 'vitest';
import { isBinaryFile, BINARY_EXTENSIONS } from '../binaryExtensions';

describe('isBinaryFile', () => {
  describe('returns true for binary extensions', () => {
    it('detects .png as binary', () => {
      expect(isBinaryFile('public/logo.png')).toBe(true);
    });

    it('detects .woff2 as binary', () => {
      expect(isBinaryFile('fonts/inter.woff2')).toBe(true);
    });

    it('detects .jpg as binary', () => {
      expect(isBinaryFile('images/photo.jpg')).toBe(true);
    });

    it('detects .jpeg as binary', () => {
      expect(isBinaryFile('images/photo.jpeg')).toBe(true);
    });

    it('detects .gif as binary', () => {
      expect(isBinaryFile('images/anim.gif')).toBe(true);
    });

    it('detects .ico as binary', () => {
      expect(isBinaryFile('public/favicon.ico')).toBe(true);
    });

    it('detects .webp as binary', () => {
      expect(isBinaryFile('images/photo.webp')).toBe(true);
    });

    it('detects .svg as binary', () => {
      expect(isBinaryFile('public/logo.svg')).toBe(true);
    });

    it('detects .woff as binary', () => {
      expect(isBinaryFile('fonts/roboto.woff')).toBe(true);
    });

    it('detects .ttf as binary', () => {
      expect(isBinaryFile('fonts/arial.ttf')).toBe(true);
    });

    it('detects .eot as binary', () => {
      expect(isBinaryFile('fonts/old-font.eot')).toBe(true);
    });

    it('detects .mp3 as binary', () => {
      expect(isBinaryFile('audio/song.mp3')).toBe(true);
    });

    it('detects .mp4 as binary', () => {
      expect(isBinaryFile('video/clip.mp4')).toBe(true);
    });
  });

  describe('returns false for text extensions', () => {
    it('detects .ts as text', () => {
      expect(isBinaryFile('src/App.ts')).toBe(false);
    });

    it('detects .tsx as text', () => {
      expect(isBinaryFile('src/App.tsx')).toBe(false);
    });

    it('detects .js as text', () => {
      expect(isBinaryFile('src/index.js')).toBe(false);
    });

    it('detects .css as text', () => {
      expect(isBinaryFile('src/styles.css')).toBe(false);
    });

    it('detects .json as text', () => {
      expect(isBinaryFile('package.json')).toBe(false);
    });

    it('detects .html as text', () => {
      expect(isBinaryFile('index.html')).toBe(false);
    });

    it('detects .md as text', () => {
      expect(isBinaryFile('README.md')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles uppercase extension .PNG as binary', () => {
      expect(isBinaryFile('public/logo.PNG')).toBe(true);
    });

    it('handles mixed case extension .Png as binary', () => {
      expect(isBinaryFile('public/logo.Png')).toBe(true);
    });

    it('handles uppercase .JPG as binary', () => {
      expect(isBinaryFile('images/photo.JPG')).toBe(true);
    });

    it('returns false for file with no extension', () => {
      expect(isBinaryFile('Makefile')).toBe(false);
    });

    it('returns false for file with empty path', () => {
      expect(isBinaryFile('')).toBe(false);
    });
  });

  describe('BINARY_EXTENSIONS set', () => {
    it('contains all expected extensions', () => {
      const expected = [
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
      ];
      for (const ext of expected) {
        expect(BINARY_EXTENSIONS.has(ext)).toBe(true);
      }
    });

    it('has exactly 13 extensions', () => {
      expect(BINARY_EXTENSIONS.size).toBe(13);
    });
  });
});
