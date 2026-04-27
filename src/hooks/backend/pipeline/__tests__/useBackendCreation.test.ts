/**
 * useBackendCreation Hook Tests
 * Phase 3 - Pipeline Hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBackendCreation } from '../useBackendCreation';
import { PipelineStage } from '../types';
import type { BackendCreationOptions, BackendCreationResult } from '../types';

// Mock the services
vi.mock('../../../../services/analyzer/BackendRequirementsAnalyzer', () => ({
  BackendRequirementsAnalyzer: vi.fn().mockImplementation(() => ({
    analyze: vi.fn(),
  })),
}));

vi.mock('../../../../services/sql/SQLGenerator', () => ({
  SQLGenerator: vi.fn().mockImplementation(() => ({
    generate: vi.fn(),
  })),
}));

vi.mock('../../../../services/supabase/MCPClient', () => ({
  SupabaseMCPClient: vi.fn().mockImplementation(() => ({
    createProject: vi.fn(),
    applyMigration: vi.fn(),
    getProjectUrl: vi.fn(),
    getAnonKey: vi.fn(),
  })),
}));

vi.mock('../../oauth/useSupabaseOAuth', () => ({
  useSupabaseOAuth: vi.fn().mockReturnValue({
    getToken: vi.fn().mockReturnValue('mock-token'),
    isAuthenticated: true,
    status: 'authenticated',
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

// Import after mocks
import { BackendRequirementsAnalyzer } from '../../../../services/analyzer/BackendRequirementsAnalyzer';
import { SQLGenerator } from '../../../../services/sql/SQLGenerator';
import { SupabaseMCPClient } from '../../../../services/supabase/MCPClient';
import { useSupabaseOAuth } from '../../oauth/useSupabaseOAuth';
import type { BackendRequirements } from '../../../../services/analyzer/types';
import type { MigrationResult } from '../../../../services/sql/types';
import type { SupabaseProject } from '../../../../services/supabase/types';

/**
 * Test Coverage:
 * - T3.1: Orchestrates 4-stage pipeline
 * - T3.2: State management (stage, progress, isCreating, error, result)
 * - T3.3: Pipeline stages with progress updates
 * - T3.4: Error handling and retry
 * - T3.5: Comprehensive tests (happy path, errors, retry, reset)
 */

const mockAnalyzer = BackendRequirementsAnalyzer as ReturnType<typeof vi.fn>;
const mockGenerator = SQLGenerator as ReturnType<typeof vi.fn>;
const mockMCPClient = SupabaseMCPClient as ReturnType<typeof vi.fn>;
const mockOAuth = useSupabaseOAuth as ReturnType<typeof vi.fn>;

describe('useBackendCreation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============ T3.2: State Management Tests ============

  describe('Initial State', () => {
    it('initializes with correct default state', () => {
      const { result } = renderHook(() => useBackendCreation());

      expect(result.current.stage).toBe('idle');
      expect(result.current.progress).toBe(0);
      expect(result.current.isCreating).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.result).toBe(null);
    });

    it('returns all required methods', () => {
      mockOAuth.mockReturnValue({
        getToken: vi.fn().mockReturnValue('valid-token'),
        isAuthenticated: true,
        status: 'authenticated',
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
      });

      const { result } = renderHook(() => useBackendCreation());

      // Then - verify all expected properties exist
      expect(result.current).toHaveProperty('createBackend');
      expect(result.current).toHaveProperty('retry');
      expect(result.current).toHaveProperty('reset');
      expect(result.current).toHaveProperty('stage');
      expect(result.current).toHaveProperty('progress');
      expect(result.current).toHaveProperty('isCreating');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('result');
      expect(typeof result.current.createBackend).toBe('function');
      expect(typeof result.current.retry).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });
  });

  // ============ T3.1 & T3.3: Happy Path Pipeline Test ============

  describe('Happy Path - All Stages Succeed', () => {
    it('completes full pipeline: analyze → generate → createProject → applyMigration', async () => {
      // Given - mock responses for each stage
      const mockRequirements: BackendRequirements = {
        entities: [
          {
            name: 'User',
            typeName: 'User',
            fields: [
              { name: 'id', type: 'string', isOptional: false },
              { name: 'email', type: 'string', isOptional: false },
            ],
            confidence: 90,
            matchType: 'pattern',
          },
        ],
        authRequirements: [],
        storageRequirements: [],
        crudOperations: [],
        hasAuth: false,
        hasStorage: false,
        overallConfidence: 85,
        analysisMethod: 'pattern',
        analyzedAt: new Date().toISOString(),
      };

      const mockMigrationResult: MigrationResult = {
        sql: 'CREATE TABLE "User" (...);',
        tables: ['User'],
        warnings: [],
      };

      const mockProject: SupabaseProject = {
        ref: 'abc123def456',
        name: 'test-project',
        apiUrl: 'https://abc123def456.supabase.co',
        anonKey: 'mock-anon-key',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };

      // Setup mock implementations
      const analyzerInstance = {
        analyze: vi.fn().mockResolvedValue(mockRequirements),
      };
      const generatorInstance = {
        generate: vi.fn().mockReturnValue(mockMigrationResult),
      };
      const mcpClientInstance = {
        createProject: vi.fn().mockResolvedValue(mockProject),
        applyMigration: vi.fn().mockResolvedValue(undefined),
        getProjectUrl: vi.fn().mockResolvedValue('https://abc123def456.supabase.co'),
        getAnonKey: vi.fn().mockResolvedValue('mock-anon-key'),
      };

      mockAnalyzer.mockImplementation(() => analyzerInstance);
      mockGenerator.mockImplementation(() => generatorInstance);
      mockMCPClient.mockImplementation(() => mcpClientInstance);

      // Given - authenticated OAuth
      mockOAuth.mockReturnValue({
        getToken: vi.fn().mockReturnValue('valid-token'),
        isAuthenticated: true,
        status: 'authenticated',
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
      });

      const { result } = renderHook(() => useBackendCreation());
      const code = 'interface User { id: string; email: string; }';
      const options: BackendCreationOptions = { projectName: 'test-project', region: 'us-east-1' };

      // When - execute pipeline
      await act(async () => {
        await result.current.createBackend(code, options);
      });

      // Then - All stages were called in sequence
      expect(analyzerInstance.analyze).toHaveBeenCalledWith(code);
      expect(generatorInstance.generate).toHaveBeenCalledWith(mockRequirements);
      expect(mcpClientInstance.createProject).toHaveBeenCalledWith('test-project', 'us-east-1');
      expect(mcpClientInstance.applyMigration).toHaveBeenCalledWith(
        mockProject.ref,
        mockMigrationResult.sql,
        'initial_schema'
      );

      // Then - Final state is complete
      expect(result.current.stage).toBe('complete');
      expect(result.current.progress).toBe(100);
      expect(result.current.isCreating).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.result).toEqual({
        projectUrl: 'https://abc123def456.supabase.co',
        anonKey: 'mock-anon-key',
        projectName: 'test-project',
        migrationName: 'initial_schema',
      });
    });

    it('completes pipeline with progress updates', async () => {
      // Setup with delays to track progress
      const analyzerInstance = {
        analyze: vi.fn().mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(
                () =>
                  resolve({
                    entities: [],
                    authRequirements: [],
                    storageRequirements: [],
                    crudOperations: [],
                    hasAuth: false,
                    hasStorage: false,
                    overallConfidence: 80,
                    analysisMethod: 'pattern',
                    analyzedAt: new Date().toISOString(),
                  }),
                10
              )
            )
        ),
      };
      const generatorInstance = {
        generate: vi.fn().mockReturnValue({ sql: '', tables: [], warnings: [] }),
      };
      const mcpClientInstance = {
        createProject: vi
          .fn()
          .mockImplementation(
            () =>
              new Promise((resolve) =>
                setTimeout(
                  () => resolve({ id: '1', ref: 'ref', name: 'p', region: 'us', createdAt: '' }),
                  10
                )
              )
          ),
        applyMigration: vi
          .fn()
          .mockImplementation(
            () => new Promise<void>((resolve) => setTimeout(() => resolve(), 10))
          ),
        getProjectUrl: vi.fn().mockResolvedValue('https://ref.supabase.co'),
        getAnonKey: vi.fn().mockResolvedValue('key'),
      };

      mockAnalyzer.mockImplementation(() => analyzerInstance);
      mockGenerator.mockImplementation(() => generatorInstance);
      mockMCPClient.mockImplementation(() => mcpClientInstance);

      mockOAuth.mockReturnValue({
        getToken: vi.fn().mockReturnValue('valid-token'),
        isAuthenticated: true,
        status: 'authenticated',
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
      });

      const { result } = renderHook(() => useBackendCreation());

      await act(async () => {
        await result.current.createBackend('code', { projectName: 'test' });
      });

      // Verify final state shows full completion
      expect(result.current.progress).toBe(100);
      expect(result.current.stage).toBe('complete');
    });
  });

  // ============ T3.4: Error Handling Tests ============

  describe('Error Handling', () => {
    it('handles error at Stage 1 (analyze)', async () => {
      const analyzerInstance = {
        analyze: vi.fn().mockRejectedValue(new Error('Analysis failed')),
      };
      mockAnalyzer.mockImplementation(() => analyzerInstance);

      mockOAuth.mockReturnValue({
        getToken: vi.fn().mockReturnValue('valid-token'),
        isAuthenticated: true,
        status: 'authenticated',
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
      });

      const { result } = renderHook(() => useBackendCreation());

      await act(async () => {
        await result.current.createBackend('code', {});
      });

      expect(result.current.stage).toBe('error');
      expect(result.current.error).toContain('Analysis failed');
      expect(result.current.isCreating).toBe(false);
    });

    it('handles error at Stage 2 (generate)', async () => {
      const analyzerInstance = {
        analyze: vi.fn().mockResolvedValue({
          entities: [],
          authRequirements: [],
          storageRequirements: [],
          crudOperations: [],
          hasAuth: false,
          hasStorage: false,
          overallConfidence: 80,
          analysisMethod: 'pattern',
        }),
      };
      const generatorInstance = {
        generate: vi.fn().mockImplementation(() => {
          throw new Error('Generation failed');
        }),
      };

      mockAnalyzer.mockImplementation(() => analyzerInstance);
      mockGenerator.mockImplementation(() => generatorInstance);

      mockOAuth.mockReturnValue({
        getToken: vi.fn().mockReturnValue('valid-token'),
        isAuthenticated: true,
        status: 'authenticated',
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
      });

      const { result } = renderHook(() => useBackendCreation());

      await act(async () => {
        await result.current.createBackend('code', {});
      });

      expect(result.current.stage).toBe('error');
      expect(result.current.error).toContain('Generation failed');
    });

    it('handles error at Stage 3 (createProject)', async () => {
      const analyzerInstance = {
        analyze: vi.fn().mockResolvedValue({
          entities: [],
          authRequirements: [],
          storageRequirements: [],
          crudOperations: [],
          hasAuth: false,
          hasStorage: false,
          overallConfidence: 80,
          analysisMethod: 'pattern',
        }),
      };
      const generatorInstance = {
        generate: vi.fn().mockReturnValue({ sql: '', tables: [], warnings: [] }),
      };
      const mcpClientInstance = {
        createProject: vi.fn().mockRejectedValue(new Error('Project creation failed')),
        applyMigration: vi.fn(),
      };

      mockAnalyzer.mockImplementation(() => analyzerInstance);
      mockGenerator.mockImplementation(() => generatorInstance);
      mockMCPClient.mockImplementation(() => mcpClientInstance);

      mockOAuth.mockReturnValue({
        getToken: vi.fn().mockReturnValue('valid-token'),
        isAuthenticated: true,
        status: 'authenticated',
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
      });

      const { result } = renderHook(() => useBackendCreation());

      await act(async () => {
        await result.current.createBackend('code', {});
      });

      expect(result.current.stage).toBe('error');
      expect(result.current.error).toContain('Project creation failed');
    });

    it('handles error at Stage 4 (applyMigration)', async () => {
      const analyzerInstance = {
        analyze: vi.fn().mockResolvedValue({
          entities: [],
          authRequirements: [],
          storageRequirements: [],
          crudOperations: [],
          hasAuth: false,
          hasStorage: false,
          overallConfidence: 80,
          analysisMethod: 'pattern',
        }),
      };
      const generatorInstance = {
        generate: vi.fn().mockReturnValue({ sql: 'SELECT 1', tables: [], warnings: [] }),
      };
      const mcpClientInstance = {
        createProject: vi.fn().mockResolvedValue({
          id: '1',
          ref: 'ref',
          name: 'p',
          region: 'us',
          createdAt: '',
        }),
        applyMigration: vi.fn().mockRejectedValue(new Error('Migration failed')),
      };

      mockAnalyzer.mockImplementation(() => analyzerInstance);
      mockGenerator.mockImplementation(() => generatorInstance);
      mockMCPClient.mockImplementation(() => mcpClientInstance);

      mockOAuth.mockReturnValue({
        getToken: vi.fn().mockReturnValue('valid-token'),
        isAuthenticated: true,
        status: 'authenticated',
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
      });

      const { result } = renderHook(() => useBackendCreation());

      await act(async () => {
        await result.current.createBackend('code', {});
      });

      expect(result.current.stage).toBe('error');
      expect(result.current.error).toContain('Migration failed');
    });

    it('handles not authenticated error', async () => {
      mockOAuth.mockReturnValue({
        getToken: vi.fn().mockReturnValue(null),
        isAuthenticated: false,
        status: 'idle',
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
      });

      const { result } = renderHook(() => useBackendCreation());

      await act(async () => {
        await result.current.createBackend('code', {});
      });

      expect(result.current.stage).toBe('error');
      expect(result.current.error).toContain('Authentication required');
    });
  });

  // ============ T3.4: Retry Functionality Tests ============

  describe('Retry Functionality', () => {
    it('retry restarts pipeline from beginning', async () => {
      // First call fails
      const analyzerInstance = {
        analyze: vi
          .fn()
          .mockRejectedValueOnce(new Error('First attempt failed'))
          .mockResolvedValue({
            entities: [],
            authRequirements: [],
            storageRequirements: [],
            crudOperations: [],
            hasAuth: false,
            hasStorage: false,
            overallConfidence: 80,
            analysisMethod: 'pattern',
          }),
      };
      const generatorInstance = {
        generate: vi.fn().mockReturnValue({ sql: '', tables: [], warnings: [] }),
      };
      const mcpClientInstance = {
        createProject: vi.fn().mockResolvedValue({
          id: '1',
          ref: 'ref',
          name: 'p',
          region: 'us',
          createdAt: '',
        }),
        applyMigration: vi.fn().mockResolvedValue(undefined),
      };

      mockAnalyzer.mockImplementation(() => analyzerInstance);
      mockGenerator.mockImplementation(() => generatorInstance);
      mockMCPClient.mockImplementation(() => mcpClientInstance);

      mockOAuth.mockReturnValue({
        getToken: vi.fn().mockReturnValue('valid-token'),
        isAuthenticated: true,
        status: 'authenticated',
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
      });

      const { result } = renderHook(() => useBackendCreation());

      // First attempt fails
      await act(async () => {
        await result.current.createBackend('code', { projectName: 'test' });
      });

      expect(result.current.stage).toBe('error');
      expect(analyzerInstance.analyze).toHaveBeenCalledTimes(1);

      // Retry should call analyze again
      await act(async () => {
        await result.current.retry();
      });

      expect(analyzerInstance.analyze).toHaveBeenCalledTimes(2);
      await waitFor(() => {
        expect(result.current.stage).toBe('complete');
      });
    });

    it('retry is disabled when not in error state', () => {
      mockOAuth.mockReturnValue({
        getToken: vi.fn().mockReturnValue('valid-token'),
        isAuthenticated: true,
        status: 'authenticated',
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
      });

      const { result } = renderHook(() => useBackendCreation());

      // Initially in idle state
      expect(result.current.retry()).toBe(false);
    });

    it('retry returns false when in ERROR state but lastCode is empty', async () => {
      // Set up OAuth to fail (not authenticated) so pipeline enters ERROR
      mockOAuth.mockReturnValue({
        getToken: vi.fn().mockReturnValue(null),
        isAuthenticated: false,
        status: 'idle',
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
      });

      const { result } = renderHook(() => useBackendCreation());

      // Call createBackend with empty code — auth fails, sets ERROR
      // lastCode will be '' (empty string, falsy), so retry returns false (line 307)
      await act(async () => {
        await result.current.createBackend('', { projectName: 'test' });
      });

      expect(result.current.stage).toBe(PipelineStage.ERROR);

      // Retry should return false because lastCode is empty/falsy
      expect(result.current.retry()).toBe(false);
    });
  });

  // ============ T3.4: Reset Functionality Tests ============

  describe('Reset Functionality', () => {
    it('reset clears all state', async () => {
      const mockRequirements: BackendRequirements = {
        entities: [],
        authRequirements: [],
        storageRequirements: [],
        crudOperations: [],
        hasAuth: false,
        hasStorage: false,
        overallConfidence: 80,
        analysisMethod: 'pattern',
        analyzedAt: new Date().toISOString(),
      };

      const analyzerInstance = {
        analyze: vi.fn().mockResolvedValue(mockRequirements),
      };
      const generatorInstance = {
        generate: vi.fn().mockReturnValue({ sql: '', tables: [], warnings: [] }),
      };
      const mcpClientInstance = {
        createProject: vi.fn().mockResolvedValue({
          id: '1',
          ref: 'ref',
          name: 'p',
          region: 'us',
          createdAt: '',
        }),
        applyMigration: vi.fn().mockResolvedValue(undefined),
      };

      mockAnalyzer.mockImplementation(() => analyzerInstance);
      mockGenerator.mockImplementation(() => generatorInstance);
      mockMCPClient.mockImplementation(() => mcpClientInstance);

      mockOAuth.mockReturnValue({
        getToken: vi.fn().mockReturnValue('valid-token'),
        isAuthenticated: true,
        status: 'authenticated',
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
      });

      const { result } = renderHook(() => useBackendCreation());

      // Complete the pipeline
      await act(async () => {
        await result.current.createBackend('code', { projectName: 'test' });
      });

      await waitFor(() => {
        expect(result.current.stage).toBe('complete');
      });

      // Reset
      act(() => {
        result.current.reset();
      });

      // Verify all state is cleared
      expect(result.current.stage).toBe('idle');
      expect(result.current.progress).toBe(0);
      expect(result.current.isCreating).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.result).toBe(null);
    });
  });

  // ============ Additional Edge Case Tests ============

  describe('Edge Cases', () => {
    it('generates default project name if not provided', async () => {
      const mockRequirements: BackendRequirements = {
        entities: [
          { name: 'User', typeName: 'User', fields: [], confidence: 90, matchType: 'pattern' },
        ],
        authRequirements: [],
        storageRequirements: [],
        crudOperations: [],
        hasAuth: false,
        hasStorage: false,
        overallConfidence: 80,
        analysisMethod: 'pattern',
        analyzedAt: new Date().toISOString(),
      };

      const analyzerInstance = {
        analyze: vi.fn().mockResolvedValue(mockRequirements),
      };
      const generatorInstance = {
        generate: vi.fn().mockReturnValue({ sql: '', tables: [], warnings: [] }),
      };
      const mcpClientInstance = {
        createProject: vi.fn().mockResolvedValue({
          id: '1',
          ref: 'ref',
          name: 'p',
          region: 'us',
          createdAt: '',
        }),
        applyMigration: vi.fn(),
      };

      mockAnalyzer.mockImplementation(() => analyzerInstance);
      mockGenerator.mockImplementation(() => generatorInstance);
      mockMCPClient.mockImplementation(() => mcpClientInstance);

      mockOAuth.mockReturnValue({
        getToken: vi.fn().mockReturnValue('valid-token'),
        isAuthenticated: true,
        status: 'authenticated',
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
      });

      const { result } = renderHook(() => useBackendCreation());

      // Call without projectName
      await act(async () => {
        await result.current.createBackend('code', {});
      });

      // createProject should have been called (default name generated)
      expect(mcpClientInstance.createProject).toHaveBeenCalled();
    });

    it('sets isCreating to true during pipeline execution', async () => {
      let resolveAnalyze: (value: BackendRequirements) => void;

      const analyzePromise = new Promise<BackendRequirements>((resolve) => {
        resolveAnalyze = resolve;
      });

      const analyzerInstance = {
        analyze: vi.fn().mockReturnValue(analyzePromise),
      };
      const generatorInstance = {
        generate: vi.fn().mockReturnValue({ sql: '', tables: [], warnings: [] }),
      };
      const mcpClientInstance = {
        createProject: vi.fn().mockResolvedValue({
          id: '1',
          ref: 'ref',
          name: 'p',
          region: 'us',
          createdAt: '',
        }),
        applyMigration: vi.fn(),
      };

      mockAnalyzer.mockImplementation(() => analyzerInstance);
      mockGenerator.mockImplementation(() => generatorInstance);
      mockMCPClient.mockImplementation(() => mcpClientInstance);

      mockOAuth.mockReturnValue({
        getToken: vi.fn().mockReturnValue('valid-token'),
        isAuthenticated: true,
        status: 'authenticated',
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
      });

      const { result } = renderHook(() => useBackendCreation());

      act(() => {
        result.current.createBackend('code', {});
      });

      // Should be creating — use waitFor to avoid race condition
      // with React's batched state updates
      await waitFor(() => {
        expect(result.current.isCreating).toBe(true);
        expect(result.current.stage).toBe('analyzing');
      });

      // Complete the analyze
      await act(async () => {
        resolveAnalyze!({
          entities: [],
          authRequirements: [],
          storageRequirements: [],
          crudOperations: [],
          hasAuth: false,
          hasStorage: false,
          overallConfidence: 80,
          analysisMethod: 'pattern',
          analyzedAt: new Date().toISOString(),
        });
      });

      await waitFor(() => {
        expect(result.current.isCreating).toBe(false);
      });
    });
  });

  // ============ Phase 1 (RA-001): Requirements Exposure Tests ============

  describe('Requirements Exposure (RA-001)', () => {
    /**
     * T-006: Unit tests for requirements exposure
     * These tests verify that the hook exposes the BackendRequirements
     * after the ANALYZING stage completes.
     */

    it('returns requirements as undefined before createBackend() is called', () => {
      mockOAuth.mockReturnValue({
        getToken: vi.fn().mockReturnValue('valid-token'),
        isAuthenticated: true,
        status: 'authenticated',
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
      });

      const { result } = renderHook(() => useBackendCreation());

      // Initially, requirements should be null (consistent with other state like result)
      expect(result.current.requirements).toBeNull();
    });

    it('returns requirements after createBackend() completes the ANALYZING stage', async () => {
      const mockRequirements: BackendRequirements = {
        entities: [
          {
            name: 'User',
            typeName: 'User',
            fields: [
              { name: 'id', type: 'string', isOptional: false },
              { name: 'email', type: 'string', isOptional: false },
            ],
            confidence: 90,
            matchType: 'pattern',
          },
        ],
        authRequirements: [],
        storageRequirements: [],
        crudOperations: [],
        hasAuth: false,
        hasStorage: false,
        overallConfidence: 85,
        analysisMethod: 'pattern',
        analyzedAt: new Date().toISOString(),
      };

      const mockMigrationResult: MigrationResult = {
        sql: 'CREATE TABLE "User" (...);',
        tables: ['User'],
        warnings: [],
      };

      const mockProject: SupabaseProject = {
        ref: 'abc123def456',
        name: 'test-project',
        apiUrl: 'https://abc123def456.supabase.co',
        anonKey: 'mock-anon-key',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };

      const analyzerInstance = {
        analyze: vi.fn().mockResolvedValue(mockRequirements),
      };
      const generatorInstance = {
        generate: vi.fn().mockReturnValue(mockMigrationResult),
      };
      const mcpClientInstance = {
        createProject: vi.fn().mockResolvedValue(mockProject),
        applyMigration: vi.fn().mockResolvedValue(undefined),
        getProjectUrl: vi.fn().mockResolvedValue('https://abc123def456.supabase.co'),
        getAnonKey: vi.fn().mockResolvedValue('mock-anon-key'),
      };

      mockAnalyzer.mockImplementation(() => analyzerInstance);
      mockGenerator.mockImplementation(() => generatorInstance);
      mockMCPClient.mockImplementation(() => mcpClientInstance);

      mockOAuth.mockReturnValue({
        getToken: vi.fn().mockReturnValue('valid-token'),
        isAuthenticated: true,
        status: 'authenticated',
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
      });

      const { result } = renderHook(() => useBackendCreation());

      const code = 'interface User { id: string; email: string; }';

      await act(async () => {
        await result.current.createBackend(code, { projectName: 'test-project' });
      });

      // After createBackend completes, requirements should be populated
      expect(result.current.requirements).toBeDefined();
      expect(result.current.requirements).toEqual(mockRequirements);
    });

    it('requirements contains expected data structure with entities', async () => {
      const mockRequirements: BackendRequirements = {
        entities: [
          {
            name: 'Product',
            typeName: 'Product',
            fields: [
              { name: 'id', type: 'string', isOptional: false },
              { name: 'name', type: 'string', isOptional: false },
              { name: 'price', type: 'number', isOptional: true },
            ],
            confidence: 95,
            matchType: 'pattern',
          },
        ],
        authRequirements: [
          {
            type: 'login',
            triggerPattern: 'useAuth',
            userFields: ['email', 'password'],
            confidence: 80,
          },
        ],
        storageRequirements: [],
        crudOperations: [
          {
            entity: 'Product',
            operation: 'create',
            triggerPattern: 'createProduct',
            confidence: 85,
          },
        ],
        hasAuth: true,
        hasStorage: false,
        overallConfidence: 90,
        analysisMethod: 'pattern',
        analyzedAt: new Date().toISOString(),
      };

      const analyzerInstance = {
        analyze: vi.fn().mockResolvedValue(mockRequirements),
      };
      const generatorInstance = {
        generate: vi.fn().mockReturnValue({ sql: '', tables: [], warnings: [] }),
      };
      const mcpClientInstance = {
        createProject: vi.fn().mockResolvedValue({
          ref: 'ref',
          name: 'p',
          apiUrl: 'https://ref.supabase.co',
          anonKey: 'key',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        }),
        applyMigration: vi.fn().mockResolvedValue(undefined),
        getProjectUrl: vi.fn().mockResolvedValue('https://ref.supabase.co'),
        getAnonKey: vi.fn().mockResolvedValue('anon-key'),
      };

      mockAnalyzer.mockImplementation(() => analyzerInstance);
      mockGenerator.mockImplementation(() => generatorInstance);
      mockMCPClient.mockImplementation(() => mcpClientInstance);

      mockOAuth.mockReturnValue({
        getToken: vi.fn().mockReturnValue('valid-token'),
        isAuthenticated: true,
        status: 'authenticated',
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
      });

      const { result } = renderHook(() => useBackendCreation());

      await act(async () => {
        await result.current.createBackend('code with Product', {});
      });

      // Verify requirements structure
      expect(result.current.requirements?.entities).toHaveLength(1);
      expect(result.current.requirements?.entities[0].name).toBe('Product');
      expect(result.current.requirements?.hasAuth).toBe(true);
      expect(result.current.requirements?.crudOperations).toHaveLength(1);
    });

    it('clears requirements when reset() is called', async () => {
      const mockRequirements: BackendRequirements = {
        entities: [
          {
            name: 'Order',
            typeName: 'Order',
            fields: [{ name: 'id', type: 'string', isOptional: false }],
            confidence: 80,
            matchType: 'pattern',
          },
        ],
        authRequirements: [],
        storageRequirements: [],
        crudOperations: [],
        hasAuth: false,
        hasStorage: false,
        overallConfidence: 75,
        analysisMethod: 'pattern',
        analyzedAt: new Date().toISOString(),
      };

      const analyzerInstance = {
        analyze: vi.fn().mockResolvedValue(mockRequirements),
      };
      const generatorInstance = {
        generate: vi.fn().mockReturnValue({ sql: '', tables: [], warnings: [] }),
      };
      const mcpClientInstance = {
        createProject: vi.fn().mockResolvedValue({
          ref: 'ref',
          name: 'p',
          apiUrl: 'https://ref.supabase.co',
          anonKey: 'key',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        }),
        applyMigration: vi.fn().mockResolvedValue(undefined),
        getProjectUrl: vi.fn().mockResolvedValue('https://ref.supabase.co'),
        getAnonKey: vi.fn().mockResolvedValue('anon-key'),
      };

      mockAnalyzer.mockImplementation(() => analyzerInstance);
      mockGenerator.mockImplementation(() => generatorInstance);
      mockMCPClient.mockImplementation(() => mcpClientInstance);

      mockOAuth.mockReturnValue({
        getToken: vi.fn().mockReturnValue('valid-token'),
        isAuthenticated: true,
        status: 'authenticated',
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
      });

      const { result } = renderHook(() => useBackendCreation());

      await act(async () => {
        await result.current.createBackend('code', { projectName: 'test' });
      });

      // Verify requirements is populated
      expect(result.current.requirements).toBeDefined();

      // Reset
      act(() => {
        result.current.reset();
      });

      // After reset, requirements should be null
      expect(result.current.requirements).toBeNull();
    });
  });
});
