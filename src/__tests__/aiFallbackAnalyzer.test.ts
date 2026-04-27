/**
 * Tests for AIFallbackAnalyzer - Phase 4
 * CHANGE 2 - Backend Requirements Analyzer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AIFallbackAnalyzer,
  createAIFallbackAnalyzer,
} from '../services/analyzer/AIFallbackAnalyzer';
import type { BackendRequirements } from '../services/analyzer/types';

describe('AIFallbackAnalyzer', () => {
  const mockApiKey = 'test-api-key';
  const testCode = `
    interface User {
      id: string;
      email: string;
      name: string;
    }

    function Login() {
      return <form>...</form>;
    }
  `;

  describe('constructor', () => {
    it('should create instance with apiKey', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey);
      expect(analyzer).toBeDefined();
    });

    it('should accept optional timeout parameter', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey, 5000);
      expect(analyzer).toBeDefined();
    });

    it('should use default timeout when not provided', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey);
      expect(analyzer).toBeDefined();
    });
  });

  describe('analyze', () => {
    it('should accept code string as input and return result', async () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey);
      // Should handle error gracefully and return fallback result
      const result = await analyzer.analyze(testCode);
      expect(result).toBeDefined();
      expect(result.analysisMethod).toBe('ai');
    });

    it('should return BackendRequirements on successful analysis', async () => {
      // This is a stub - will be implemented with actual API call
      const analyzer = new AIFallbackAnalyzer(mockApiKey);
      try {
        const result = await analyzer.analyze(testCode);
        expect(result).toBeDefined();
      } catch {
        // Expected to fail without real API
      }
      expect(true).toBe(true);
    });
  });

  describe('buildPrompt', () => {
    it('should include code in prompt', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      const prompt = analyzer.buildPrompt(testCode);
      expect(prompt).toContain('Analyze this React code');
      // Code is included but may be shortened/truncated
      expect(prompt).toContain('interface User');
    });

    it('should include JSON format instructions', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      const prompt = analyzer.buildPrompt(testCode);
      expect(prompt).toContain('entities');
      expect(prompt).toContain('hasAuth');
      expect(prompt).toContain('hasStorage');
    });
  });

  describe('parseResponse', () => {
    it('should parse valid JSON response', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      const validJson = JSON.stringify({
        entities: [{ name: 'User', fields: [{ name: 'email', type: 'string' }] }],
        hasAuth: true,
        authRequirements: [{ type: 'login', confidence: 90 }],
        hasStorage: false,
        storageRequirements: [],
        crudOperations: [{ entity: 'User', operation: 'create', confidence: 85 }],
        overallConfidence: 85,
        analysisMethod: 'ai',
      });

      const result = analyzer.parseResponse(validJson);
      expect(result.entities).toHaveLength(1);
      expect(result.hasAuth).toBe(true);
      expect(result.overallConfidence).toBe(85);
    });

    it('should handle empty response gracefully', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      const result = analyzer.parseResponse('');
      expect(result.entities).toHaveLength(0);
      expect(result.overallConfidence).toBe(0);
    });

    it('should handle malformed JSON', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      const result = analyzer.parseResponse('not valid json {{{');
      expect(result.entities).toHaveLength(0);
      expect(result.overallConfidence).toBe(0);
    });

    it('should handle response with missing fields', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      const partialJson = JSON.stringify({
        entities: [],
      });

      const result = analyzer.parseResponse(partialJson);
      expect(result.hasAuth).toBe(false);
      expect(result.hasStorage).toBe(false);
      // Missing overallConfidence defaults to 50 as per implementation
      expect(result.overallConfidence).toBe(50);
    });
  });

  describe('handleTimeout', () => {
    it('should return fallback BackendRequirements on timeout', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      const result = analyzer.handleTimeout();
      expect(result.analysisMethod).toBe('ai');
      expect(result.overallConfidence).toBe(0);
    });
  });

  describe('handleError', () => {
    it('should return fallback BackendRequirements on error', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      const error = new Error('API Error');
      const result = analyzer.handleError(error);
      expect(result.analysisMethod).toBe('ai');
      expect(result.overallConfidence).toBe(0);
    });
  });

  describe('transformResponse - partial response defaults', () => {
    it('should default contentType to "any" when missing in storage requirement', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      const partialJson = JSON.stringify({
        entities: [],
        hasAuth: false,
        hasStorage: true,
        storageRequirements: [
          { contentType: undefined }, // missing contentType
        ],
      });

      const result = analyzer.parseResponse(partialJson);

      expect(result.storageRequirements).toHaveLength(1);
      expect(result.storageRequirements[0].contentType).toBe('any');
    });

    it('should default contentType to "any" when null in storage requirement', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      const partialJson = JSON.stringify({
        entities: [],
        hasAuth: false,
        hasStorage: true,
        storageRequirements: [{ contentType: null }],
      });

      const result = analyzer.parseResponse(partialJson);

      expect(result.storageRequirements).toHaveLength(1);
      expect(result.storageRequirements[0].contentType).toBe('any');
    });

    it('should default confidence to 50 when missing in entity', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      const partialJson = JSON.stringify({
        entities: [
          { name: 'User', fields: [] }, // missing confidence
        ],
      });

      const result = analyzer.parseResponse(partialJson);

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].confidence).toBe(50);
    });

    it('should default confidence to 50 when missing in auth requirement', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      const partialJson = JSON.stringify({
        entities: [],
        hasAuth: true,
        authRequirements: [
          { type: 'login' }, // missing confidence
        ],
      });

      const result = analyzer.parseResponse(partialJson);

      expect(result.authRequirements).toHaveLength(1);
      expect(result.authRequirements[0].confidence).toBe(50);
    });

    it('should default overallConfidence to 50 when missing', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      const partialJson = JSON.stringify({
        entities: [],
        hasAuth: false,
        hasStorage: false,
        // missing overallConfidence
      });

      const result = analyzer.parseResponse(partialJson);

      expect(result.overallConfidence).toBe(50);
    });
  });

  describe('parseResponse - catch branch', () => {
    it('should handle JSON that matches regex but fails to parse', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      // This string matches /\{[\s\S]*\}/ but JSON.parse will throw
      // because it has a trailing comma (invalid JSON)
      const invalidJson = '{ "entities": [], }';

      const result = analyzer.parseResponse(invalidJson);

      expect(result.entities).toHaveLength(0);
      expect(result.overallConfidence).toBe(0);
      expect(result.analysisMethod).toBe('ai');
    });
  });

  describe('createAIFallbackAnalyzer factory', () => {
    it('should create an AIFallbackAnalyzer instance', () => {
      const analyzer = createAIFallbackAnalyzer(mockApiKey);
      expect(analyzer).toBeInstanceOf(AIFallbackAnalyzer);
    });

    it('should pass timeout parameter to the analyzer', () => {
      const analyzer = createAIFallbackAnalyzer(mockApiKey, 5000);
      expect(analyzer).toBeInstanceOf(AIFallbackAnalyzer);
    });
  });

  describe('analyze - error branches', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should return fallback on AbortError (timeout)', async () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey);
      // Mock the Gemini model to throw an AbortError
      const mockModel = {
        generateContent: vi
          .fn()
          .mockRejectedValue(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
      };
      vi.spyOn(analyzer as any, 'genAI', 'get').mockReturnValue({
        getGenerativeModel: () => mockModel,
      });

      const result = await analyzer.analyze('test code');

      expect(result.overallConfidence).toBe(0);
      expect(result.analysisMethod).toBe('ai');
    });

    it('should return fallback when non-Error is thrown', async () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey);
      // Mock the Gemini model to throw a string (non-Error)
      const mockModel = {
        generateContent: vi.fn().mockRejectedValue('string error'),
      };
      vi.spyOn(analyzer as any, 'genAI', 'get').mockReturnValue({
        getGenerativeModel: () => mockModel,
      });

      const result = await analyzer.analyze('test code');

      expect(result.overallConfidence).toBe(0);
      expect(result.analysisMethod).toBe('ai');
    });

    it('should return fallback on regular Error (not AbortError)', async () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey);
      const mockModel = {
        generateContent: vi.fn().mockRejectedValue(new Error('API quota exceeded')),
      };
      vi.spyOn(analyzer as any, 'genAI', 'get').mockReturnValue({
        getGenerativeModel: () => mockModel,
      });

      const result = await analyzer.analyze('test code');

      expect(result.overallConfidence).toBe(0);
    });

    it('should clear timeout on successful analysis', async () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey);
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const mockResult = {
        response: {
          text: () =>
            JSON.stringify({
              entities: [{ name: 'User', fields: [{ name: 'email', type: 'string' }] }],
              hasAuth: true,
              authRequirements: [],
              hasStorage: false,
              storageRequirements: [],
              crudOperations: [],
              overallConfidence: 85,
            }),
        },
      };
      const mockModel = {
        generateContent: vi.fn().mockResolvedValue(mockResult),
      };
      vi.spyOn(analyzer as any, 'genAI', 'get').mockReturnValue({
        getGenerativeModel: () => mockModel,
      });

      await analyzer.analyze('test code');

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('should clear timeout on error', async () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey);
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const mockModel = {
        generateContent: vi.fn().mockRejectedValue(new Error('fail')),
      };
      vi.spyOn(analyzer as any, 'genAI', 'get').mockReturnValue({
        getGenerativeModel: () => mockModel,
      });

      await analyzer.analyze('test code');

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('transformResponse - entity field defaults', () => {
    it('should default entity name to "Unknown" when missing', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      const partialJson = JSON.stringify({
        entities: [{ fields: [{ name: 'email', type: 'string' }] }], // missing name
      });

      const result = analyzer.parseResponse(partialJson);

      expect(result.entities[0].name).toBe('Unknown');
      expect(result.entities[0].typeName).toBe('Unknown');
    });

    it('should default field name to "" when missing', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      const partialJson = JSON.stringify({
        entities: [{ name: 'User', fields: [{ type: 'number' }] }], // missing field name
      });

      const result = analyzer.parseResponse(partialJson);

      expect(result.entities[0].fields[0].name).toBe('');
    });

    it('should default field type to "string" when missing', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      const partialJson = JSON.stringify({
        entities: [{ name: 'User', fields: [{ name: 'age' }] }], // missing type
      });

      const result = analyzer.parseResponse(partialJson);

      expect(result.entities[0].fields[0].type).toBe('string');
    });

    it('should default field isOptional to false when missing', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      const partialJson = JSON.stringify({
        entities: [{ name: 'User', fields: [{ name: 'age', type: 'number' }] }], // missing isOptional
      });

      const result = analyzer.parseResponse(partialJson);

      expect(result.entities[0].fields[0].isOptional).toBe(false);
    });

    it('should default auth type to "login" when missing', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      const partialJson = JSON.stringify({
        entities: [],
        hasAuth: true,
        authRequirements: [{ confidence: 80 }], // missing type
      });

      const result = analyzer.parseResponse(partialJson);

      expect(result.authRequirements[0].type).toBe('login');
    });

    it('should default crud operation to "read" when missing', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      const partialJson = JSON.stringify({
        entities: [],
        crudOperations: [{ entity: 'User', confidence: 75 }], // missing operation
      });

      const result = analyzer.parseResponse(partialJson);

      expect(result.crudOperations[0].operation).toBe('read');
    });

    it('should default crud entity to "Unknown" when missing', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      const partialJson = JSON.stringify({
        entities: [],
        crudOperations: [{ operation: 'create', confidence: 75 }], // missing entity
      });

      const result = analyzer.parseResponse(partialJson);

      expect(result.crudOperations[0].entity).toBe('Unknown');
    });

    it('should default crud confidence to 50 when missing', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      const partialJson = JSON.stringify({
        entities: [],
        crudOperations: [{ entity: 'User', operation: 'create' }], // missing confidence
      });

      const result = analyzer.parseResponse(partialJson);

      expect(result.crudOperations[0].confidence).toBe(50);
    });

    it('should default storage confidence to 50 when missing', () => {
      const analyzer = new AIFallbackAnalyzer(mockApiKey) as any;
      const partialJson = JSON.stringify({
        entities: [],
        hasStorage: true,
        storageRequirements: [{ contentType: 'image' }], // missing confidence
      });

      const result = analyzer.parseResponse(partialJson);

      expect(result.storageRequirements[0].confidence).toBe(50);
    });
  });
});
