/**
 * BackendRequirementsAnalyzer Branch Coverage Tests
 *
 * Tests uncovered branches:
 * - Empty code path → createEmptyRequirements
 * - Cache hit path → return cached requirements
 * - AI fallback trigger (low confidence) → hybrid mode
 * - AI fallback error → pattern-only fallback with warning
 * - Pattern-only mode (high confidence, no AI)
 * - mergeResults: AI entities added, AI auth/storage fallback, AI CRUD merge
 * - combineResults: hasAuth and hasStorage derivation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackendRequirementsAnalyzer } from '../BackendRequirementsAnalyzer';
import type { PatternAnalysis } from '../PatternMatcher';
import type { BackendRequirements, DetectionResult } from '../types';

// Mock the logger to verify warning calls
vi.mock('../../../utils/logger', () => ({
  logWarnSafe: vi.fn(),
}));

import { logWarnSafe } from '../../../utils/logger';

const mockLogWarnSafe = vi.mocked(logWarnSafe);

// ============ Helpers ============

function createPatternResult(overrides: Partial<PatternAnalysis> = {}): PatternAnalysis {
  return {
    entities: [],
    authRequirements: [],
    storageRequirements: [],
    crudOperations: [],
    overallConfidence: 90,
    ...overrides,
  };
}

function createRequirements(overrides: Partial<BackendRequirements> = {}): BackendRequirements {
  return {
    entities: [],
    hasAuth: false,
    authRequirements: [],
    hasStorage: false,
    storageRequirements: [],
    crudOperations: [],
    overallConfidence: 90,
    analysisMethod: 'pattern',
    analyzedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============ Mock dependencies ============

function createMockPatternMatcher(result?: Partial<PatternAnalysis>) {
  return {
    analyze: vi.fn().mockReturnValue(createPatternResult(result)),
  };
}

function createMockConfidenceCalculator(shouldTrigger = false) {
  return {
    shouldTriggerAIFallback: vi.fn().mockReturnValue(shouldTrigger),
    calculateEntityConfidence: vi.fn().mockReturnValue(85),
    calculateAuthConfidence: vi.fn().mockReturnValue(80),
    calculateStorageConfidence: vi.fn().mockReturnValue(80),
    calculateCRUDConfidence: vi.fn().mockReturnValue(80),
    calculateAggregate: vi.fn().mockReturnValue(80),
    isHighConfidence: vi.fn(),
    isMediumConfidence: vi.fn(),
    isLowConfidence: vi.fn(),
  };
}

function createMockAIFallback(requirements?: BackendRequirements, shouldReject = false) {
  if (shouldReject) {
    return {
      analyze: vi.fn().mockRejectedValue(new Error('AI service unavailable')),
    };
  }
  return {
    analyze: vi
      .fn()
      .mockResolvedValue(
        requirements ?? createRequirements({ analysisMethod: 'ai', overallConfidence: 75 })
      ),
  };
}

function createMockCache() {
  const cache = new Map<string, DetectionResult>();
  return {
    get: vi.fn((code: string) => cache.get(code) ?? null),
    set: vi.fn((code: string, result: DetectionResult) => {
      cache.set(code, result);
    }),
    has: vi.fn((code: string) => cache.has(code)),
    generateKey: vi.fn((code: string) => `key-${code.length}`),
    clear: vi.fn(() => cache.clear()),
    _cache: cache,
  };
}

// ============ Tests ============

describe('BackendRequirementsAnalyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('empty code path', () => {
    it('should return empty requirements for empty string', async () => {
      const analyzer = new BackendRequirementsAnalyzer();
      const result = await analyzer.analyze('');

      expect(result.entities).toEqual([]);
      expect(result.hasAuth).toBe(false);
      expect(result.hasStorage).toBe(false);
      expect(result.overallConfidence).toBe(0);
      expect(result.analysisMethod).toBe('pattern');
    });

    it('should return empty requirements for whitespace-only string', async () => {
      const analyzer = new BackendRequirementsAnalyzer();
      const result = await analyzer.analyze('   \n\t  ');

      expect(result.entities).toEqual([]);
      expect(result.hasAuth).toBe(false);
      expect(result.overallConfidence).toBe(0);
    });
  });

  describe('cache path', () => {
    it('should return cached requirements on cache hit', async () => {
      const mockCache = createMockCache();
      const cachedRequirements = createRequirements({
        entities: [
          { name: 'Cached', typeName: 'Cached', fields: [], confidence: 90, matchType: 'pattern' },
        ],
        overallConfidence: 95,
      });

      const code = 'interface User { id: string; }';
      const detectionResult: DetectionResult = {
        sourceHash: 'hash-123',
        detected: true,
        requirements: cachedRequirements,
        cachedAt: new Date().toISOString(),
      };
      mockCache.get.mockReturnValue(detectionResult);

      const analyzer = new BackendRequirementsAnalyzer({
        cache: mockCache as unknown as import('../cache').AnalysisCache,
        useCache: true,
      });

      const result = await analyzer.analyze(code);

      expect(result).toEqual(cachedRequirements);
      expect(mockCache.get).toHaveBeenCalled();
    });

    it('should store result in cache after analysis when cache is enabled', async () => {
      const mockCache = createMockCache();
      mockCache.get.mockReturnValue(null);

      const analyzer = new BackendRequirementsAnalyzer({
        patternMatcher:
          createMockPatternMatcher() as unknown as import('../PatternMatcher').PatternMatcher,
        confidenceCalculator:
          createMockConfidenceCalculator() as unknown as import('../confidence').ConfidenceCalculator,
        cache: mockCache as unknown as import('../cache').AnalysisCache,
        useCache: true,
      });

      await analyzer.analyze('interface User { id: string; }');

      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should not check cache when useCache is false', async () => {
      const mockCache = createMockCache();

      const analyzer = new BackendRequirementsAnalyzer({
        patternMatcher:
          createMockPatternMatcher() as unknown as import('../PatternMatcher').PatternMatcher,
        confidenceCalculator:
          createMockConfidenceCalculator() as unknown as import('../confidence').ConfidenceCalculator,
        cache: mockCache as unknown as import('../cache').AnalysisCache,
        useCache: false,
      });

      await analyzer.analyze('some code');

      expect(mockCache.get).not.toHaveBeenCalled();
    });
  });

  describe('pattern-only mode (high confidence)', () => {
    it('should use pattern-only analysis when confidence is high', async () => {
      const mockMatcher = createMockPatternMatcher({
        overallConfidence: 90,
        entities: [
          { name: 'User', typeName: 'User', fields: [], confidence: 90, matchType: 'pattern' },
        ],
      });
      const mockConfidence = createMockConfidenceCalculator(false);

      const analyzer = new BackendRequirementsAnalyzer({
        patternMatcher: mockMatcher as unknown as import('../PatternMatcher').PatternMatcher,
        confidenceCalculator:
          mockConfidence as unknown as import('../confidence').ConfidenceCalculator,
      });

      const result = await analyzer.analyze('interface User { id: string; }');

      expect(result.analysisMethod).toBe('pattern');
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('User');
      expect(mockConfidence.shouldTriggerAIFallback).toHaveBeenCalledWith(90);
    });

    it('should derive hasAuth from authRequirements in combineResults', async () => {
      const mockMatcher = createMockPatternMatcher({
        overallConfidence: 90,
        authRequirements: [{ type: 'login' as const, triggerPattern: 'useAuth', confidence: 95 }],
      });
      const mockConfidence = createMockConfidenceCalculator(false);

      const analyzer = new BackendRequirementsAnalyzer({
        patternMatcher: mockMatcher as unknown as import('../PatternMatcher').PatternMatcher,
        confidenceCalculator:
          mockConfidence as unknown as import('../confidence').ConfidenceCalculator,
      });

      const result = await analyzer.analyze('const auth = useAuth();');

      expect(result.hasAuth).toBe(true);
      expect(result.authRequirements).toHaveLength(1);
    });

    it('should derive hasStorage from storageRequirements in combineResults', async () => {
      const mockMatcher = createMockPatternMatcher({
        overallConfidence: 90,
        storageRequirements: [
          { contentType: 'image' as const, triggerPattern: 'fileInput', confidence: 85 },
        ],
      });
      const mockConfidence = createMockConfidenceCalculator(false);

      const analyzer = new BackendRequirementsAnalyzer({
        patternMatcher: mockMatcher as unknown as import('../PatternMatcher').PatternMatcher,
        confidenceCalculator:
          mockConfidence as unknown as import('../confidence').ConfidenceCalculator,
      });

      const result = await analyzer.analyze('<input type="file" />');

      expect(result.hasStorage).toBe(true);
      expect(result.storageRequirements).toHaveLength(1);
    });
  });

  describe('AI fallback trigger (hybrid mode)', () => {
    it('should trigger AI fallback when confidence is below threshold', async () => {
      const mockMatcher = createMockPatternMatcher({ overallConfidence: 50 });
      const mockConfidence = createMockConfidenceCalculator(true);
      const mockAI = createMockAIFallback(
        createRequirements({
          entities: [
            { name: 'AIEntity', typeName: 'AIEntity', fields: [], confidence: 70, matchType: 'ai' },
          ],
          overallConfidence: 70,
          analysisMethod: 'ai',
        })
      );

      const analyzer = new BackendRequirementsAnalyzer({
        patternMatcher: mockMatcher as unknown as import('../PatternMatcher').PatternMatcher,
        confidenceCalculator:
          mockConfidence as unknown as import('../confidence').ConfidenceCalculator,
        aiFallback: mockAI as unknown as import('../AIFallbackAnalyzer').AIFallbackAnalyzer,
      });

      const result = await analyzer.analyze('const x = 1;');

      expect(mockAI.analyze).toHaveBeenCalled();
      expect(result.analysisMethod).toBe('hybrid');
    });

    it('should merge pattern and AI entities (dedup by name, pattern wins)', async () => {
      const mockMatcher = createMockPatternMatcher({
        overallConfidence: 50,
        entities: [
          {
            name: 'PatternEntity',
            typeName: 'PatternEntity',
            fields: [],
            confidence: 50,
            matchType: 'pattern',
          },
        ],
      });
      const mockConfidence = createMockConfidenceCalculator(true);
      const mockAI = createMockAIFallback(
        createRequirements({
          entities: [
            { name: 'AIEntity', typeName: 'AIEntity', fields: [], confidence: 70, matchType: 'ai' },
            {
              name: 'PatternEntity',
              typeName: 'PatternEntity',
              fields: [],
              confidence: 60,
              matchType: 'ai',
            },
          ],
          overallConfidence: 70,
          analysisMethod: 'ai',
        })
      );

      const analyzer = new BackendRequirementsAnalyzer({
        patternMatcher: mockMatcher as unknown as import('../PatternMatcher').PatternMatcher,
        confidenceCalculator:
          mockConfidence as unknown as import('../confidence').ConfidenceCalculator,
        aiFallback: mockAI as unknown as import('../AIFallbackAnalyzer').AIFallbackAnalyzer,
      });

      const result = await analyzer.analyze('some code');

      expect(result.entities).toHaveLength(2);
      const names = result.entities.map((e) => e.name);
      expect(names).toContain('PatternEntity');
      expect(names).toContain('AIEntity');
    });

    it('should fall back to AI auth/storage when pattern has none', async () => {
      const mockMatcher = createMockPatternMatcher({
        overallConfidence: 50,
        authRequirements: [],
        storageRequirements: [],
      });
      const mockConfidence = createMockConfidenceCalculator(true);
      const mockAI = createMockAIFallback(
        createRequirements({
          entities: [],
          authRequirements: [
            { type: 'login' as const, triggerPattern: 'aiDetected', confidence: 75 },
          ],
          storageRequirements: [
            { contentType: 'image' as const, triggerPattern: 'aiUpload', confidence: 70 },
          ],
          overallConfidence: 70,
          analysisMethod: 'ai',
        })
      );

      const analyzer = new BackendRequirementsAnalyzer({
        patternMatcher: mockMatcher as unknown as import('../PatternMatcher').PatternMatcher,
        confidenceCalculator:
          mockConfidence as unknown as import('../confidence').ConfidenceCalculator,
        aiFallback: mockAI as unknown as import('../AIFallbackAnalyzer').AIFallbackAnalyzer,
      });

      const result = await analyzer.analyze('some code');

      expect(result.authRequirements).toHaveLength(1);
      expect(result.authRequirements![0].triggerPattern).toBe('aiDetected');
      expect(result.storageRequirements).toHaveLength(1);
      expect(result.storageRequirements![0].triggerPattern).toBe('aiUpload');
      expect(result.hasAuth).toBe(true);
      expect(result.hasStorage).toBe(true);
    });

    it('should merge AI CRUD operations with pattern CRUD (dedup by entity-operation)', async () => {
      const mockMatcher = createMockPatternMatcher({
        overallConfidence: 50,
        crudOperations: [
          {
            entity: 'User',
            operation: 'create' as const,
            triggerPattern: 'formCreate',
            confidence: 80,
          },
        ],
      });
      const mockConfidence = createMockConfidenceCalculator(true);
      const mockAI = createMockAIFallback(
        createRequirements({
          entities: [],
          crudOperations: [
            {
              entity: 'User',
              operation: 'create' as const,
              triggerPattern: 'aiCreate',
              confidence: 60,
            },
            {
              entity: 'User',
              operation: 'delete' as const,
              triggerPattern: 'aiDelete',
              confidence: 70,
            },
          ],
          overallConfidence: 65,
          analysisMethod: 'ai',
        })
      );

      const analyzer = new BackendRequirementsAnalyzer({
        patternMatcher: mockMatcher as unknown as import('../PatternMatcher').PatternMatcher,
        confidenceCalculator:
          mockConfidence as unknown as import('../confidence').ConfidenceCalculator,
        aiFallback: mockAI as unknown as import('../AIFallbackAnalyzer').AIFallbackAnalyzer,
      });

      const result = await analyzer.analyze('some code');

      expect(result.crudOperations).toHaveLength(2);
      const keys = result.crudOperations.map((op) => `${op.entity}-${op.operation}`);
      expect(keys).toContain('User-create');
      expect(keys).toContain('User-delete');
    });

    it('should use max confidence between pattern and AI in hybrid mode', async () => {
      const mockMatcher = createMockPatternMatcher({ overallConfidence: 50 });
      const mockConfidence = createMockConfidenceCalculator(true);
      const mockAI = createMockAIFallback(
        createRequirements({
          entities: [],
          overallConfidence: 75,
          analysisMethod: 'ai',
        })
      );

      const analyzer = new BackendRequirementsAnalyzer({
        patternMatcher: mockMatcher as unknown as import('../PatternMatcher').PatternMatcher,
        confidenceCalculator:
          mockConfidence as unknown as import('../confidence').ConfidenceCalculator,
        aiFallback: mockAI as unknown as import('../AIFallbackAnalyzer').AIFallbackAnalyzer,
      });

      const result = await analyzer.analyze('some code');

      expect(result.overallConfidence).toBe(75);
    });
  });

  describe('AI fallback error', () => {
    it('should fall back to pattern-only when AI analysis fails', async () => {
      const mockMatcher = createMockPatternMatcher({
        overallConfidence: 50,
        entities: [
          { name: 'User', typeName: 'User', fields: [], confidence: 50, matchType: 'pattern' },
        ],
      });
      const mockConfidence = createMockConfidenceCalculator(true);
      const mockAI = createMockAIFallback(undefined, true);

      const analyzer = new BackendRequirementsAnalyzer({
        patternMatcher: mockMatcher as unknown as import('../PatternMatcher').PatternMatcher,
        confidenceCalculator:
          mockConfidence as unknown as import('../confidence').ConfidenceCalculator,
        aiFallback: mockAI as unknown as import('../AIFallbackAnalyzer').AIFallbackAnalyzer,
      });

      const result = await analyzer.analyze('interface User { id: string; }');

      expect(result.analysisMethod).toBe('pattern');
      expect(mockLogWarnSafe).toHaveBeenCalledWith(
        'BackendRequirementsAnalyzer',
        'AI fallback failed, using pattern results'
      );
    });
  });

  describe('no AI fallback configured', () => {
    it('should use pattern-only when confidence is low but no AI configured', async () => {
      const mockMatcher = createMockPatternMatcher({ overallConfidence: 50 });
      const mockConfidence = createMockConfidenceCalculator(true);

      const analyzer = new BackendRequirementsAnalyzer({
        patternMatcher: mockMatcher as unknown as import('../PatternMatcher').PatternMatcher,
        confidenceCalculator:
          mockConfidence as unknown as import('../confidence').ConfidenceCalculator,
      });

      const result = await analyzer.analyze('some code');

      expect(result.analysisMethod).toBe('pattern');
    });
  });
});
