/**
 * Analysis Cache for Backend Requirements Analyzer
 * CHANGE 2 - Phase 5: Cache Layer
 */

import type { DetectionResult } from './types';

/**
 * Simple deterministic hash for cache keys.
 * Uses FNV-1a algorithm — fast, well-distributed, no Node.js crypto dependency.
 * Not cryptographically secure, but cache keys don't need that.
 */
function fnv1aHash(input: string): string {
  const FNV_PRIME = 0x01000193;
  const FNV_OFFSET = 0x811c9dc5;
  let hash = FNV_OFFSET;

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }

  // Convert to 16-char hex string (64-bit equivalent via two 32-bit halves)
  // Use a second pass with different seed for more bits
  let hash2 = FNV_OFFSET + 0x9e3779b9; // golden ratio offset
  for (let i = 0; i < input.length; i++) {
    hash2 ^= input.charCodeAt(i) + i;
    hash2 = Math.imul(hash2, FNV_PRIME + 0x9e3779b9);
  }

  return (hash >>> 0).toString(16).padStart(8, '0') + (hash2 >>> 0).toString(16).padStart(8, '0');
}

/**
 * Cache entry with metadata
 */
interface CacheEntry {
  key: string;
  result: DetectionResult;
  createdAt: number;
  ttl: number;
}

/**
 * In-memory cache for analysis results with TTL support
 */
export class AnalysisCache {
  private cache: Map<string, CacheEntry> = new Map();
  private defaultTTL: number;

  /**
   * Create a new analysis cache
   * @param defaultTTL - Time-to-live in milliseconds (default: 5 minutes = 300000ms)
   */
  /**
   * Create a new analysis cache with configurable TTL (time-to-live).
   * @param defaultTTL - Time-to-live in milliseconds (default: 5 minutes = 300000ms)
   * @example
   * ```typescript
   * // Default: 5 minute TTL
   * const cache = new AnalysisCache();
   *
   * // Custom: 10 minute TTL
   * const cache = new AnalysisCache(600000);
   * ```
   */
  constructor(defaultTTL: number = 300000) {
    this.defaultTTL = defaultTTL;
  }

  /**
   * Generate a deterministic hash key from code content for cache lookup.
   * Uses FNV-1a algorithm — no Node.js crypto dependency required.
   * @param code - Source code to hash
   * @returns 16-char hex hash string
   * @example
   * ```typescript
   * const cache = new AnalysisCache();
   * const key = cache.generateKey('interface User { id: string; }');
   * ```
   */
  generateKey(code: string): string {
    return fnv1aHash(code);
  }

  /**
   * Check if an entry is expired
   */
  isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.createdAt > entry.ttl;
  }

  /**
   * Get cached result for code
   * @returns DetectionResult or null if not found or expired
   */
  /**
   * Get cached analysis result for given code if exists and not expired.
   * Checks FNV-1a hash key, validates TTL expiration before returning.
   * @param code - Source code to look up in cache
   * @returns DetectionResult or null if not found or expired
   * @example
   * ```typescript
   * const cache = new AnalysisCache();
   * const result = cache.get('interface User { id: string; }');
   * if (result) { console.log('Cache hit:', result); }
   * ```
   */
  get(code: string): DetectionResult | null {
    const key = this.generateKey(code);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  /**
   * Store analysis result in cache
   */
  /**
   * Store analysis result in cache with FNV-1a hash key and TTL expiration.
   * @param code - Source code as cache key
   * @param result - DetectionResult to store
   * @example
   * ```typescript
   * const cache = new AnalysisCache();
   * cache.set('interface User { id: string; }', { sourceHash: '...', detected: true, requirements: {...}, cachedAt: '...' });
   * ```
   */
  set(code: string, result: DetectionResult): void {
    const key = this.generateKey(code);
    this.cache.set(key, {
      key,
      result,
      createdAt: Date.now(),
      ttl: this.defaultTTL,
    });
  }

  /**
   * Check if code exists in cache (and is not expired)
   */
  /**
   * Check if code exists in cache and is not expired.
   * Useful for quick cache existence checks without retrieving data.
   * @param code - Source code to check in cache
   * @returns True if code is in cache and not expired
   * @example
   * ```typescript
   * const cache = new AnalysisCache();
   * if (cache.has('interface User { id: string; }')) {
   *   console.log('Cache entry exists');
   * }
   * ```
   */
  has(code: string): boolean {
    const key = this.generateKey(code);
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all cached entries
   */
  /**
   * Clear all cached entries, removing all analysis results from cache.
   * Useful for testing or when cache needs to be invalidated.
   * @example
   * ```typescript
   * const cache = new AnalysisCache();
   * cache.clear(); // All entries removed
   * ```
   */
  clear(): void {
    this.cache.clear();
  }
}
