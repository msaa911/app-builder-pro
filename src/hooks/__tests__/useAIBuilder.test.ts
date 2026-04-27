import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAIBuilder } from '../useAIBuilder';

// Create mock orchestrator
const createMockOrchestrator = () => ({
  updateConfig: vi.fn(),
  generateApp: vi.fn(),
  refineApp: vi.fn(),
  testConnection: vi.fn(),
});

// Mock module with factory to avoid hoisting issues
let mockOrchestrator: ReturnType<typeof createMockOrchestrator>;

vi.mock('../../services/ai/AIOrchestrator', () => ({
  AIOrchestrator: {
    getInstance: () => mockOrchestrator,
  },
}));

// Import type for reference
import type { AIResponse } from '../../types';

describe('useAIBuilder', () => {
  beforeEach(() => {
    mockOrchestrator = createMockOrchestrator();
    vi.clearAllMocks();
  });

  // ============ RED - Test: Hook initializes with default state ============
  it('initializes with default state', () => {
    // Given
    // When
    const { result } = renderHook(() => useAIBuilder());

    // Then
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.lastPrompt).toBe('');
    expect(typeof result.current.generate).toBe('function');
  });

  // ============ RED - Test: generate function exists and is callable ============
  it('provides generate function', () => {
    // Given
    // When
    const { result } = renderHook(() => useAIBuilder());

    // Then - generate should be a function
    expect(typeof result.current.generate).toBe('function');
  });

  // ============ RED - Test: generate calls orchestrator with correct params ============
  it('calls orchestrator with prompt, apiKey, and modelId', async () => {
    // Given
    const mockResponse: AIResponse = {
      message: 'App generated successfully',
      files: [{ path: 'src/App.tsx', content: 'export default function App() {}' }],
      explanation: 'Generated via Gemini SDK',
    };

    mockOrchestrator.generateApp.mockResolvedValue(mockResponse);

    // When
    const { result } = renderHook(() => useAIBuilder());

    await act(async () => {
      await result.current.generate('Create a React app', 'api-key', 'gemini-2.5-flash');
    });

    // Then
    expect(mockOrchestrator.updateConfig).toHaveBeenCalledWith('api-key', 'gemini-2.5-flash');
    expect(mockOrchestrator.generateApp).toHaveBeenCalledWith('Create a React app');
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.lastPrompt).toBe('Create a React app');
  });

  // ============ RED - Test: generate handles errors and sets error state ============
  it('handles errors and sets error state', async () => {
    // Given
    const errorMessage = 'AI generation failed';
    const generationError = new Error(errorMessage);
    mockOrchestrator.generateApp.mockRejectedValue(generationError);

    // When
    const { result } = renderHook(() => useAIBuilder());

    let caughtError: Error | undefined;
    await act(async () => {
      try {
        await result.current.generate('Create app', 'api-key', 'model-id');
      } catch (e) {
        caughtError = e as Error;
      }
    });

    // Then
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.error).toEqual(generationError);
    expect(caughtError).toEqual(generationError);
  });

  // ============ RED - Test: generate resets isGenerating after completion ============
  it('resets isGenerating to false after completion', async () => {
    // Given
    const mockResponse: AIResponse = { message: 'Success' };
    mockOrchestrator.generateApp.mockResolvedValue(mockResponse);

    // When
    const { result } = renderHook(() => useAIBuilder());

    await act(async () => {
      await result.current.generate('prompt', 'key', 'model');
    });

    // Then - should be false after completion
    expect(result.current.isGenerating).toBe(false);
  });

  // ============ RED - Test: Multiple consecutive generates track prompts correctly ============
  it('handles multiple consecutive generate calls', async () => {
    // Given
    const mockResponse1: AIResponse = { message: 'First response' };
    const mockResponse2: AIResponse = { message: 'Second response' };

    let callCount = 0;
    mockOrchestrator.generateApp.mockImplementation(() => {
      const response = callCount === 0 ? mockResponse1 : mockResponse2;
      callCount++;
      return Promise.resolve(response);
    });

    // When
    const { result } = renderHook(() => useAIBuilder());

    await act(async () => {
      await result.current.generate('First prompt', 'key', 'model');
    });

    await act(async () => {
      await result.current.generate('Second prompt', 'key', 'model');
    });

    // Then
    expect(result.current.lastPrompt).toBe('Second prompt');
    expect(mockOrchestrator.generateApp).toHaveBeenCalledTimes(2);
  });

  // ============ RED - Test: generate handles non-Error thrown values ============
  it('handles non-Error thrown values in catch block', async () => {
    // Given - generateApp throws a string instead of an Error
    mockOrchestrator.generateApp.mockRejectedValue('string error');

    // When
    const { result } = renderHook(() => useAIBuilder());

    let caughtError: unknown;
    await act(async () => {
      try {
        await result.current.generate('Create app', 'api-key', 'model-id');
      } catch (e) {
        caughtError = e;
      }
    });

    // Then - error should be set as-is (catch block at line 28-30)
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.error).toBe('string error');
    expect(caughtError).toBe('string error');
  });
});
