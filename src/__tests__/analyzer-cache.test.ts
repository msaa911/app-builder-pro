import { describe, it, expect, beforeEach } from 'vitest';
import { AnalysisCache } from '../services/analyzer/cache';
import type { DetectionResult } from '../services/analyzer/types';

describe('Phase 5: Cache Layer', () => {
  describe('5.1 AnalysisCache hash generation', () => {
    let cache: AnalysisCache;

    beforeEach(() => {
      cache = new AnalysisCache();
    });

    it('should generate consistent hash for same code', () => {
      const code = 'interface User { id: string; name: string; }';

      // Use internal generateKey method via get/has
      // The cache should generate same key for same code
      const key1 = cache.generateKey(code);
      const key2 = cache.generateKey(code);

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(16); // FNV-1a 16-char hex
    });

    it('should generate different hash for different code', () => {
      const code1 = 'interface User { id: string; }';
      const code2 = 'interface Product { id: string; }';

      const key1 = cache.generateKey(code1);
      const key2 = cache.generateKey(code2);

      expect(key1).not.toBe(key2);
    });

    it('should generate different hash for code with whitespace differences', () => {
      const code1 = 'interface User { id: string; }';
      const code2 = 'interface User {id: string;}';

      const key1 = cache.generateKey(code1);
      const key2 = cache.generateKey(code2);

      // Different code produces different hash
      expect(key1).not.toBe(key2);
    });
  });

  describe('5.3 Cache lookup returns cached result', () => {
    let cache: AnalysisCache;

    beforeEach(() => {
      cache = new AnalysisCache();
    });

    it('should return null for non-existent code', () => {
      const result = cache.get('const x = 1;');
      expect(result).toBeNull();
    });

    it('should return cached result if exists', () => {
      const code = 'interface User { id: string; }';
      const mockResult: DetectionResult = {
        sourceHash: 'abc123',
        detected: true,
        requirements: {
          entities: [
            { name: 'User', typeName: 'User', fields: [], confidence: 90, matchType: 'pattern' },
          ],
          hasAuth: false,
          hasStorage: false,
          crudOperations: [],
          overallConfidence: 90,
          analysisMethod: 'pattern',
          analyzedAt: new Date().toISOString(),
        },
        cachedAt: new Date().toISOString(),
      };

      cache.set(code, mockResult);
      const result = cache.get(code);

      expect(result).not.toBeNull();
      expect(result?.sourceHash).toBe('abc123');
    });
  });

  describe('5.5 Cache storage saves analysis result', () => {
    let cache: AnalysisCache;

    beforeEach(() => {
      cache = new AnalysisCache();
    });

    it('should save and retrieve result', () => {
      const code = 'interface User { id: string; }';
      const mockResult: DetectionResult = {
        sourceHash: 'def456',
        detected: false,
        requirements: {
          entities: [],
          hasAuth: false,
          hasStorage: false,
          crudOperations: [],
          overallConfidence: 0,
          analysisMethod: 'pattern',
          analyzedAt: new Date().toISOString(),
        },
        cachedAt: new Date().toISOString(),
      };

      cache.set(code, mockResult);
      const retrieved = cache.get(code);

      expect(retrieved?.sourceHash).toBe('def456');
    });

    it('has() should return true for stored code', () => {
      const code = 'interface User { id: string; }';
      const mockResult: DetectionResult = {
        sourceHash: 'xyz',
        detected: true,
        requirements: {
          entities: [],
          hasAuth: false,
          hasStorage: false,
          crudOperations: [],
          overallConfidence: 50,
          analysisMethod: 'pattern',
          analyzedAt: new Date().toISOString(),
        },
        cachedAt: new Date().toISOString(),
      };

      cache.set(code, mockResult);
      expect(cache.has(code)).toBe(true);
    });

    it('has() should return false for non-stored code', () => {
      const cache = new AnalysisCache();
      expect(cache.has('const x = 1;')).toBe(false);
    });
  });

  describe('5.7 Cache respects TTL', () => {
    it('should return null after TTL expires', async () => {
      const shortTTL = 100; // 100ms
      const cache = new AnalysisCache(shortTTL);
      const code = 'interface User { id: string; }';

      const mockResult: DetectionResult = {
        sourceHash: 'expired',
        detected: true,
        requirements: {
          entities: [],
          hasAuth: false,
          hasStorage: false,
          crudOperations: [],
          overallConfidence: 50,
          analysisMethod: 'pattern',
          analyzedAt: new Date().toISOString(),
        },
        cachedAt: new Date().toISOString(),
      };

      cache.set(code, mockResult);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      const result = cache.get(code);
      expect(result).toBeNull();
    });

    it('should return result before TTL expires', async () => {
      const shortTTL = 5000; // 5 seconds
      const cache = new AnalysisCache(shortTTL);
      const code = 'interface User { id: string; }';

      const mockResult: DetectionResult = {
        sourceHash: 'valid',
        detected: true,
        requirements: {
          entities: [],
          hasAuth: false,
          hasStorage: false,
          crudOperations: [],
          overallConfidence: 50,
          analysisMethod: 'pattern',
          analyzedAt: new Date().toISOString(),
        },
        cachedAt: new Date().toISOString(),
      };

      cache.set(code, mockResult);

      // Wait a bit but less than TTL
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = cache.get(code);
      expect(result).not.toBeNull();
      expect(result?.sourceHash).toBe('valid');
    });

    it('isExpired should detect expired entries', () => {
      const cache = new AnalysisCache(100);

      // Create expired entry manually
      const oldTime = Date.now() - 200;
      // @ts-ignore - accessing private method for test
      const expired = cache.isExpired({
        createdAt: oldTime,
        ttl: 100,
        key: '',
        result: {} as DetectionResult,
      });

      expect(expired).toBe(true);
    });
  });

  describe('5.9 Cache clear functionality', () => {
    let cache: AnalysisCache;

    beforeEach(() => {
      cache = new AnalysisCache();
    });

    it('should clear all cached entries', () => {
      const code1 = 'interface User { id: string; }';
      const code2 = 'interface Product { id: string; }';

      const mockResult: DetectionResult = {
        sourceHash: 'hash',
        detected: true,
        requirements: {
          entities: [],
          hasAuth: false,
          hasStorage: false,
          crudOperations: [],
          overallConfidence: 50,
          analysisMethod: 'pattern',
          analyzedAt: new Date().toISOString(),
        },
        cachedAt: new Date().toISOString(),
      };

      cache.set(code1, mockResult);
      cache.set(code2, mockResult);

      expect(cache.has(code1)).toBe(true);
      expect(cache.has(code2)).toBe(true);

      cache.clear();

      expect(cache.has(code1)).toBe(false);
      expect(cache.has(code2)).toBe(false);
    });
  });
});
