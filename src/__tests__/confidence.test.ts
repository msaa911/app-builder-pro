/**
 * Tests for ConfidenceCalculator (Phase 3)
 * CHANGE 2 - Backend Requirements Analyzer
 */

import { describe, it, expect } from 'vitest';
import { ConfidenceCalculator, createConfidenceCalculator } from '../services/analyzer/confidence';
import type {
  Entity,
  AuthRequirement,
  StorageRequirement,
  CRUDSOperation,
  BackendRequirements,
} from '../services/analyzer/types';

describe('ConfidenceCalculator', () => {
  describe('calculateEntityConfidence', () => {
    it('should return 0-100 score for entity detection', () => {
      const calculator = new ConfidenceCalculator();

      const entity: Entity = {
        name: 'User',
        typeName: 'User',
        fields: [
          { name: 'id', type: 'string', isOptional: false },
          { name: 'email', type: 'string', isOptional: false },
          { name: 'name', type: 'string', isOptional: true },
        ],
        confidence: 90,
        matchType: 'pattern',
      };

      const result = calculator.calculateEntityConfidence(entity);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should return high confidence for explicit interface', () => {
      const calculator = new ConfidenceCalculator();

      const entity: Entity = {
        name: 'User',
        typeName: 'User',
        fields: [
          { name: 'id', type: 'string', isOptional: false },
          { name: 'email', type: 'string', isOptional: false },
        ],
        confidence: 90,
        matchType: 'pattern',
      };

      const result = calculator.calculateEntityConfidence(entity);

      // Base 90 + explicit types + multiple fields
      expect(result).toBeGreaterThanOrEqual(80);
    });

    it('should return Low confidence for generic entity name', () => {
      const calculator = new ConfidenceCalculator();

      const entity: Entity = {
        name: 'Data',
        typeName: 'Data',
        fields: [],
        confidence: 50,
        matchType: 'pattern',
      };

      const result = calculator.calculateEntityConfidence(entity);

      // Should be penalized for generic name
      expect(result).toBeLessThan(80);
    });
  });

  describe('calculateAuthConfidence', () => {
    it('should return high confidence for useAuth hook detection', () => {
      const calculator = new ConfidenceCalculator();

      const auth: AuthRequirement = {
        type: 'login',
        triggerPattern: 'useAuth',
        confidence: 95,
      };

      const result = calculator.calculateAuthConfidence(auth);

      expect(result).toBeGreaterThanOrEqual(90);
    });

    it('should return medium confidence for user state detection', () => {
      const calculator = new ConfidenceCalculator();

      const auth: AuthRequirement = {
        type: 'login',
        triggerPattern: 'user',
        confidence: 70,
      };

      const result = calculator.calculateAuthConfidence(auth);

      expect(result).toBeGreaterThanOrEqual(60);
    });
  });

  describe('calculateStorageConfidence', () => {
    it('should return high confidence for file input detection', () => {
      const calculator = new ConfidenceCalculator();

      const storage: StorageRequirement = {
        contentType: 'image',
        triggerPattern: 'fileInput',
        confidence: 85,
      };

      const result = calculator.calculateStorageConfidence(storage);

      expect(result).toBeGreaterThanOrEqual(80);
    });

    it('should return high confidence for upload handler', () => {
      const calculator = new ConfidenceCalculator();

      const storage: StorageRequirement = {
        contentType: 'document',
        triggerPattern: 'uploadHandler',
        confidence: 90,
      };

      const result = calculator.calculateStorageConfidence(storage);

      expect(result).toBeGreaterThanOrEqual(85);
    });
  });

  describe('calculateCRUDConfidence', () => {
    it('should return high confidence for delete handler', () => {
      const calculator = new ConfidenceCalculator();

      const crud: CRUDSOperation = {
        entity: 'User',
        operation: 'delete',
        triggerPattern: 'handleDelete',
        confidence: 85,
      };

      const result = calculator.calculateCRUDConfidence(crud);

      expect(result).toBeGreaterThanOrEqual(80);
    });

    it('should return medium confidence for form submit', () => {
      const calculator = new ConfidenceCalculator();

      const crud: CRUDSOperation = {
        entity: 'User',
        operation: 'create',
        triggerPattern: 'formSubmit',
        confidence: 80,
      };

      const result = calculator.calculateCRUDConfidence(crud);

      expect(result).toBeGreaterThanOrEqual(70);
    });
  });

  describe('calculateAggregate', () => {
    it('should return aggregate confidence score between 0-100', () => {
      const calculator = new ConfidenceCalculator();

      const requirements: BackendRequirements = {
        entities: [
          {
            name: 'User',
            typeName: 'User',
            fields: [{ name: 'id', type: 'string', isOptional: false }],
            confidence: 90,
            matchType: 'pattern',
          },
        ],
        hasAuth: true,
        authRequirements: [{ type: 'login', triggerPattern: 'useAuth', confidence: 95 }],
        hasStorage: false,
        storageRequirements: [],
        crudOperations: [
          { entity: 'User', operation: 'create', triggerPattern: 'formCreate', confidence: 80 },
        ],
        overallConfidence: 88,
        analysisMethod: 'pattern',
        analyzedAt: new Date().toISOString(),
      };

      const result = calculator.calculateAggregate(requirements);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should weight entity confidence at 0.4', () => {
      const calculator = new ConfidenceCalculator();

      const requirements: BackendRequirements = {
        entities: [
          {
            name: 'User',
            typeName: 'User',
            fields: [
              { name: 'id', type: 'string', isOptional: false },
              { name: 'email', type: 'string', isOptional: false },
            ],
            confidence: 95,
            matchType: 'pattern',
          },
        ],
        hasAuth: true,
        authRequirements: [{ type: 'login', triggerPattern: 'useAuth', confidence: 95 }],
        hasStorage: true,
        storageRequirements: [
          { contentType: 'image', triggerPattern: 'fileInput', confidence: 85 },
        ],
        crudOperations: [
          { entity: 'User', operation: 'create', triggerPattern: 'formCreate', confidence: 80 },
        ],
        overallConfidence: 90,
        analysisMethod: 'pattern',
        analyzedAt: new Date().toISOString(),
      };

      const result = calculator.calculateAggregate(requirements);

      // Should reflect high entity weight
      expect(result).toBeGreaterThanOrEqual(80);
    });
  });

  describe('shouldTriggerAIFallback', () => {
    it('should trigger AI fallback when confidence < 60', () => {
      const calculator = new ConfidenceCalculator();

      const result = calculator.shouldTriggerAIFallback(50);

      expect(result).toBe(true);
    });

    it('should NOT trigger AI fallback when confidence >= 80', () => {
      const calculator = new ConfidenceCalculator();

      const result = calculator.shouldTriggerAIFallback(80);

      expect(result).toBe(false);
    });

    it('should trigger AI fallback at threshold 0.7 (70%)', () => {
      const calculator = new ConfidenceCalculator();

      // 70% should trigger (MEDIUM confidence -> AI fallback)
      const result70 = calculator.shouldTriggerAIFallback(70);
      expect(result70).toBe(true);

      // 65% should trigger
      const result65 = calculator.shouldTriggerAIFallback(65);
      expect(result65).toBe(true);
    });

    it('should NOT trigger AI fallback at HIGH confidence >= 80', () => {
      const calculator = new ConfidenceCalculator();

      const result = calculator.shouldTriggerAIFallback(85);

      expect(result).toBe(false);
    });
  });

  describe('isLowConfidence', () => {
    it('should return true when confidence is below 60', () => {
      const calculator = new ConfidenceCalculator();

      const result = calculator.isLowConfidence(59);

      expect(result).toBe(true);
    });

    it('should return false when confidence is at 60 (boundary)', () => {
      const calculator = new ConfidenceCalculator();

      const result = calculator.isLowConfidence(60);

      expect(result).toBe(false);
    });

    it('should return false when confidence is above 60', () => {
      const calculator = new ConfidenceCalculator();

      const result = calculator.isLowConfidence(61);

      expect(result).toBe(false);
    });

    it('should return true when confidence is 0', () => {
      const calculator = new ConfidenceCalculator();

      const result = calculator.isLowConfidence(0);

      expect(result).toBe(true);
    });

    it('should return false when confidence is 100', () => {
      const calculator = new ConfidenceCalculator();

      const result = calculator.isLowConfidence(100);

      expect(result).toBe(false);
    });

    it('should return true for negative confidence', () => {
      const calculator = new ConfidenceCalculator();

      const result = calculator.isLowConfidence(-10);

      expect(result).toBe(true);
    });

    it('should return false for confidence at 70', () => {
      const calculator = new ConfidenceCalculator();

      const result = calculator.isLowConfidence(70);

      expect(result).toBe(false);
    });
  });

  describe('isHighConfidence', () => {
    it('should return true when confidence >= 80', () => {
      const calculator = new ConfidenceCalculator();

      expect(calculator.isHighConfidence(80)).toBe(true);
      expect(calculator.isHighConfidence(90)).toBe(true);
      expect(calculator.isHighConfidence(100)).toBe(true);
    });

    it('should return false when confidence < 80', () => {
      const calculator = new ConfidenceCalculator();

      expect(calculator.isHighConfidence(79)).toBe(false);
      expect(calculator.isHighConfidence(60)).toBe(false);
      expect(calculator.isHighConfidence(0)).toBe(false);
    });
  });

  describe('isMediumConfidence', () => {
    it('should return true when confidence >= 60 and < 80', () => {
      const calculator = new ConfidenceCalculator();

      expect(calculator.isMediumConfidence(60)).toBe(true);
      expect(calculator.isMediumConfidence(70)).toBe(true);
      expect(calculator.isMediumConfidence(79)).toBe(true);
    });

    it('should return false when confidence < 60', () => {
      const calculator = new ConfidenceCalculator();

      expect(calculator.isMediumConfidence(59)).toBe(false);
      expect(calculator.isMediumConfidence(0)).toBe(false);
    });

    it('should return false when confidence >= 80', () => {
      const calculator = new ConfidenceCalculator();

      expect(calculator.isMediumConfidence(80)).toBe(false);
      expect(calculator.isMediumConfidence(100)).toBe(false);
    });
  });

  describe('createConfidenceCalculator factory', () => {
    it('should create a ConfidenceCalculator instance', () => {
      const calculator = createConfidenceCalculator();
      expect(calculator).toBeInstanceOf(ConfidenceCalculator);
    });

    it('should produce same results as direct construction', () => {
      const factoryCalc = createConfidenceCalculator();
      const directCalc = new ConfidenceCalculator();

      expect(factoryCalc.isHighConfidence(80)).toBe(directCalc.isHighConfidence(80));
      expect(factoryCalc.isLowConfidence(50)).toBe(directCalc.isLowConfidence(50));
      expect(factoryCalc.shouldTriggerAIFallback(70)).toBe(directCalc.shouldTriggerAIFallback(70));
    });
  });

  describe('calculateStorageConfidence - branch coverage', () => {
    it('should NOT add bonus when contentType is "any"', () => {
      const calculator = new ConfidenceCalculator();

      const storage: StorageRequirement = {
        contentType: 'any',
        triggerPattern: 'fileInput',
        confidence: 70,
      };

      const result = calculator.calculateStorageConfidence(storage);

      // contentType === 'any' → no bonus, just base confidence
      expect(result).toBe(70);
    });

    it('should NOT add bonus when contentType is undefined', () => {
      const calculator = new ConfidenceCalculator();

      const storage: StorageRequirement = {
        contentType: undefined as any,
        triggerPattern: 'fileInput',
        confidence: 70,
      };

      const result = calculator.calculateStorageConfidence(storage);

      // contentType === undefined → no bonus
      expect(result).toBe(70);
    });

    it('should add bonus when contentType is specific (not "any", not undefined)', () => {
      const calculator = new ConfidenceCalculator();

      const storage: StorageRequirement = {
        contentType: 'image',
        triggerPattern: 'fileInput',
        confidence: 70,
      };

      const result = calculator.calculateStorageConfidence(storage);

      // Specific contentType → +5 bonus
      expect(result).toBeGreaterThan(70);
    });
  });

  describe('calculateEntityConfidence - branch coverage', () => {
    it('should not add explicit interface bonus for matchType other than "pattern"', () => {
      const calculator = new ConfidenceCalculator();

      const entity: Entity = {
        name: 'User',
        typeName: 'User',
        fields: [{ name: 'id', type: 'string', isOptional: false }],
        confidence: 80,
        matchType: 'ai', // not 'pattern'
      };

      const result = calculator.calculateEntityConfidence(entity);

      // No explicit interface bonus since matchType !== 'pattern'
      expect(result).toBe(80);
    });

    it('should add explicit interface bonus for pattern match with explicit name', () => {
      const calculator = new ConfidenceCalculator();

      const entity: Entity = {
        name: 'User',
        typeName: 'User',
        fields: [{ name: 'id', type: 'string', isOptional: false }],
        confidence: 80,
        matchType: 'pattern',
      };

      const result = calculator.calculateEntityConfidence(entity);

      // Pattern + explicit interface → +5
      expect(result).toBeGreaterThan(80);
    });

    it('should NOT add explicit interface bonus for generic typeName "Data"', () => {
      const calculator = new ConfidenceCalculator();

      const entity: Entity = {
        name: 'Data',
        typeName: 'Data',
        fields: [{ name: 'id', type: 'string', isOptional: false }],
        confidence: 80,
        matchType: 'pattern',
      };

      const result = calculator.calculateEntityConfidence(entity);

      // Generic name "Data" → -10 penalty + no explicit bonus
      expect(result).toBeLessThan(80);
    });

    it('should not penalize or bonus for entity with exactly 1 field', () => {
      const calculator = new ConfidenceCalculator();

      const entity: Entity = {
        name: 'Item',
        typeName: 'Item',
        fields: [{ name: 'id', type: 'string', isOptional: false }],
        confidence: 80,
        matchType: 'ai',
      };

      const result = calculator.calculateEntityConfidence(entity);

      // 1 field → neither MULTIPLE_FIELDS bonus nor empty penalty, but generic name "Item" → -10
      expect(result).toBeLessThan(80);
    });

    it('should add MULTIPLE_FIELDS bonus for entity with >=2 fields', () => {
      const calculator = new ConfidenceCalculator();

      const entity: Entity = {
        name: 'Product',
        typeName: 'Product',
        fields: [
          { name: 'id', type: 'string', isOptional: false },
          { name: 'name', type: 'string', isOptional: false },
        ],
        confidence: 80,
        matchType: 'ai',
      };

      const result = calculator.calculateEntityConfidence(entity);

      // >=2 fields → +5
      expect(result).toBe(85);
    });

    it('should subtract penalty for entity with 0 fields', () => {
      const calculator = new ConfidenceCalculator();

      const entity: Entity = {
        name: 'Product',
        typeName: 'Product',
        fields: [],
        confidence: 80,
        matchType: 'ai',
      };

      const result = calculator.calculateEntityConfidence(entity);

      // 0 fields → -10
      expect(result).toBe(70);
    });
  });

  describe('calculateAggregate - empty arrays branch coverage', () => {
    it('should handle empty entities array (avgEntity = 0)', () => {
      const calculator = new ConfidenceCalculator();

      const requirements: BackendRequirements = {
        entities: [],
        hasAuth: true,
        authRequirements: [{ type: 'login', triggerPattern: 'useAuth', confidence: 95 }],
        hasStorage: true,
        storageRequirements: [
          { contentType: 'image', triggerPattern: 'fileInput', confidence: 85 },
        ],
        crudOperations: [],
        overallConfidence: 50,
        analysisMethod: 'pattern',
        analyzedAt: new Date().toISOString(),
      };

      const result = calculator.calculateAggregate(requirements);

      // Should not throw, should produce a valid score
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should handle all empty arrays (returns 0)', () => {
      const calculator = new ConfidenceCalculator();

      const requirements: BackendRequirements = {
        entities: [],
        hasAuth: false,
        authRequirements: [],
        hasStorage: false,
        storageRequirements: [],
        crudOperations: [],
        overallConfidence: 0,
        analysisMethod: 'pattern',
        analyzedAt: new Date().toISOString(),
      };

      const result = calculator.calculateAggregate(requirements);

      expect(result).toBe(0);
    });
  });

  describe('calculateAuthConfidence - userFields branch', () => {
    it('should add bonus when auth has userFields', () => {
      const calculator = new ConfidenceCalculator();

      const auth: AuthRequirement = {
        type: 'login',
        triggerPattern: 'LoginForm',
        confidence: 70,
        userFields: ['email', 'password'],
      };

      const result = calculator.calculateAuthConfidence(auth);

      // userFields present and non-empty → +5
      expect(result).toBeGreaterThan(70);
    });

    it('should NOT add bonus when auth has empty userFields', () => {
      const calculator = new ConfidenceCalculator();

      const auth: AuthRequirement = {
        type: 'login',
        triggerPattern: 'LoginForm',
        confidence: 70,
        userFields: [],
      };

      const result = calculator.calculateAuthConfidence(auth);

      // Empty userFields → no bonus
      expect(result).toBe(70);
    });
  });

  describe('calculateCRUDConfidence - formSubmit branch', () => {
    it('should subtract 5 for formSubmit trigger pattern', () => {
      const calculator = new ConfidenceCalculator();

      const crud: CRUDSOperation = {
        entity: 'User',
        operation: 'create',
        triggerPattern: 'formSubmit',
        confidence: 80,
      };

      const result = calculator.calculateCRUDConfidence(crud);

      expect(result).toBe(75);
    });

    it('should not subtract for non-formSubmit trigger pattern', () => {
      const calculator = new ConfidenceCalculator();

      const crud: CRUDSOperation = {
        entity: 'User',
        operation: 'create',
        triggerPattern: 'handleCreate',
        confidence: 80,
      };

      const result = calculator.calculateCRUDConfidence(crud);

      expect(result).toBe(80);
    });
  });
});
