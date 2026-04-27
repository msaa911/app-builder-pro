import { GoogleGenerativeAI } from '@google/generative-ai';
import { type ProjectFile, type AIResponse } from '../../types';
import { SYSTEM_PROMPT } from './prompts';
import { parseAIResponse } from './codeParser';
import { quotaManager } from './AIQuotaManager';
import { logErrorSafe, logInfoSafe } from '../../utils/logger';

export class AIOrchestrator {
  private static instance: AIOrchestrator;
  private genAI: GoogleGenerativeAI | null = null;
  private modelId: string = 'gemini-2.5-flash';
  private currentApiKey: string = '';

  private constructor() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (apiKey) {
      this.currentApiKey = apiKey;
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  private sanitizeInput(input: string): string {
    return input.trim().slice(0, 10000);
  }

  public updateConfig(apiKey: string, modelId: string) {
    // SEC-02: Only log non-sensitive configuration
    // SEC-AKS-002: Only log modelId — hasApiKey is an info leak
    logInfoSafe('AIOrchestrator', `Updating config: modelId=${modelId}`);
    this.modelId = modelId;
    if (apiKey && apiKey !== this.currentApiKey) {
      this.currentApiKey = apiKey;
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else if (!apiKey && import.meta.env.VITE_GEMINI_API_KEY !== this.currentApiKey) {
      const envKey = import.meta.env.VITE_GEMINI_API_KEY || '';
      this.currentApiKey = envKey;
      this.genAI = envKey ? new GoogleGenerativeAI(envKey) : null;
    }
  }

  public static getInstance(): AIOrchestrator {
    if (!AIOrchestrator.instance) {
      AIOrchestrator.instance = new AIOrchestrator();
    }
    return AIOrchestrator.instance;
  }

  public async generateApp(prompt: string): Promise<AIResponse> {
    const { allowed, reason } = quotaManager.canMakeRequest();
    if (!allowed) {
      throw new Error(`[Quota Guard] Request blocked: ${reason}`);
    }
    quotaManager.recordRequest();

    if (!this.genAI) {
      throw new Error(
        'Gemini API Key not found. Please set VITE_GEMINI_API_KEY in your .env file.'
      );
    }

    // SEC-02: Log only prompt length, not content (security best practice)
    logInfoSafe('AIOrchestrator', `Generating app via Gemini SDK. Prompt length: ${prompt.length}`);

    const sanitizedPrompt = this.sanitizeInput(prompt);

    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelId });

      const result = await model.generateContent([
        SYSTEM_PROMPT,
        `User Prompt: ${sanitizedPrompt}`,
      ]);

      const response = await result.response;
      const text = response.text();

      const { message, files, warnings } = parseAIResponse(text);
      return {
        message,
        files,
        warnings,
        explanation: 'App structure generated via Gemini SDK.',
      };
    } catch (error) {
      quotaManager.recordError();
      // SEC-02/SEC-04: Log redacted message — credentials stripped
      logErrorSafe('Gemini API Error', error);
      throw error;
    }
  }

  public async refineApp(currentFiles: ProjectFile[], request: string): Promise<AIResponse> {
    const { allowed, reason } = quotaManager.canMakeRequest();
    if (!allowed) {
      throw new Error(`[Quota Guard] Request blocked: ${reason}`);
    }
    quotaManager.recordRequest();

    if (!this.genAI) {
      throw new Error('Gemini API Key not found.');
    }

    const model = this.genAI.getGenerativeModel({ model: this.modelId });

    const sanitizedRequest = this.sanitizeInput(request);
    const sanitizedContext = currentFiles
      .slice(0, 10)
      .map((f) => `File: ${f.path}\n\n${(f.content ?? '').slice(0, 5000)}`)
      .join('\n\n---\n\n')
      .slice(0, 50000);
    const sanitizedContextLimited = this.sanitizeInput(sanitizedContext);

    try {
      const result = await model.generateContent([
        SYSTEM_PROMPT,
        `Current Project Files:\n${sanitizedContextLimited}`,
        `User Request for Modification: ${sanitizedRequest}`,
      ]);

      const response = await result.response;
      const text = response.text();

      const { message, files, warnings } = parseAIResponse(text);
      return {
        message,
        files,
        warnings,
      };
    } catch (error) {
      quotaManager.recordError();
      // SEC-02/SEC-04: Log redacted message — credentials stripped
      logErrorSafe('Gemini Refine Error', error);
      throw error;
    }
  }

  public async testConnection(): Promise<string[]> {
    if (!this.genAI) throw new Error('No API Key configured');
    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelId });
      const result = await model.generateContent("Say 'Connection Successful'");
      return [result.response.text()];
    } catch (error: any) {
      // SEC-02/SEC-04: Log redacted message — credentials stripped
      logErrorSafe('Test Connection Error', error);
      throw error;
    }
  }
}
