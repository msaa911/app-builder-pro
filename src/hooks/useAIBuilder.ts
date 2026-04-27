import { useState, useCallback } from 'react';
import { AIOrchestrator } from '../services/ai/AIOrchestrator';
import type { AIResponse, ProjectFile } from '../types';

interface UseAIBuilderReturn {
  generate: (prompt: string, apiKey: string, modelId: string) => Promise<AIResponse>;
  refine: (
    currentFiles: ProjectFile[],
    prompt: string,
    apiKey: string,
    modelId: string
  ) => Promise<AIResponse>;
  isGenerating: boolean;
  error: Error | null;
  lastPrompt: string;
}

export function useAIBuilder(): UseAIBuilderReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastPrompt, setLastPrompt] = useState('');

  const generate = useCallback(async (prompt: string, apiKey: string, modelId: string) => {
    setIsGenerating(true);
    setError(null);
    setLastPrompt(prompt);

    try {
      const ai = AIOrchestrator.getInstance();
      ai.updateConfig(apiKey, modelId);
      const response = await ai.generateApp(prompt);
      return response;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const refine = useCallback(
    async (currentFiles: ProjectFile[], prompt: string, apiKey: string, modelId: string) => {
      setIsGenerating(true);
      setError(null);
      setLastPrompt(prompt);

      try {
        const ai = AIOrchestrator.getInstance();
        ai.updateConfig(apiKey, modelId);
        const response = await ai.refineApp(currentFiles, prompt);
        return response;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  return { generate, refine, isGenerating, error, lastPrompt };
}
