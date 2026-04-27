import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIOrchestrator } from '../services/ai/AIOrchestrator';
import { quotaManager } from '../services/ai/AIQuotaManager';

// Create mock functions first
const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn().mockReturnValue({
  generateContent: mockGenerateContent,
});

// Mock REFINE_PROMPT so we can verify it's called (ITR-004)
const mockRefinePrompt = vi.fn().mockReturnValue('MOCK_REFINE_PROMPT_OUTPUT');
vi.mock('../services/ai/prompts', () => ({
  SYSTEM_PROMPT: 'MOCK_SYSTEM_PROMPT',
  REFINE_PROMPT: (...args: any[]) => mockRefinePrompt(...args),
}));

// Mock the entire module at import time
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

// Helper to create mock responses
const createMockResponse = (text: string) => ({
  response: {
    text: () => text,
  },
});

describe('AIOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set test API key using vi.stubEnv
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-api-key');

    // Reset singleton instance
    (AIOrchestrator as any).instance = null;

    // Reset quota manager
    quotaManager.resetErrors();
    quotaManager.setConfig({ maxRequestsPerMinute: 15 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    (AIOrchestrator as any).instance = null;
  });

  describe('getInstance', () => {
    it('returns singleton instance', () => {
      // When
      const instance1 = AIOrchestrator.getInstance();
      const instance2 = AIOrchestrator.getInstance();

      // Then
      expect(instance1).toBe(instance2);
    });
  });

  describe('generateApp', () => {
    it('generates app from valid prompt and returns parsed files', async () => {
      // Given
      mockGenerateContent.mockResolvedValueOnce(
        createMockResponse(`# Creating a Todo App

Here is your todo application:

File: src/App.tsx
\`\`\`tsx
function App() {
  return <div>Todo App</div>;
}
export default App;
\`\`\``)
      );

      const orchestrator = AIOrchestrator.getInstance();

      // When
      const result = await orchestrator.generateApp('Create a todo app');

      // Then
      expect(result).toBeDefined();
      expect(result.files).toBeDefined();
      expect(result.message).toBeDefined();
    });

    it('calls Gemini API with system prompt and user prompt', async () => {
      // Given
      mockGenerateContent.mockResolvedValueOnce(
        createMockResponse(`File: src/App.tsx
\`\`\`tsx
function App() {}
\`\`\``)
      );

      const orchestrator = AIOrchestrator.getInstance();

      // When
      await orchestrator.generateApp('Create a simple app');

      // Then
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      const [contents] = mockGenerateContent.mock.calls[0];
      // SYSTEM_PROMPT is mocked, just verify it's present
      expect(contents[0]).toBe('MOCK_SYSTEM_PROMPT');
      expect(contents[1]).toContain('Create a simple app');
    });

    it('throws error when no API key is configured', async () => {
      // Given - simulate no API key by making genAI null on a fresh instance
      // We test the behavior: when genAI is null, should throw specific error
      const instanceWithoutKey = Object.create(AIOrchestrator.prototype);
      (instanceWithoutKey as any).genAI = null;
      (instanceWithoutKey as any).modelId = 'gemini-2.5-flash';

      // When/Then
      await expect(instanceWithoutKey.generateApp('Create app')).rejects.toThrow(
        'Gemini API Key not found'
      );
    });

    it('throws error when quota is exceeded', async () => {
      // Given
      quotaManager.setConfig({ maxRequestsPerMinute: 0 });

      const orchestrator = AIOrchestrator.getInstance();

      // When/Then
      await expect(orchestrator.generateApp('Create app')).rejects.toThrow(/Quota Guard/);
    });

    it('throws error when API call fails', async () => {
      // Given
      mockGenerateContent.mockRejectedValueOnce(new Error('API Error'));
      quotaManager.setConfig({ maxRequestsPerMinute: 15 });

      const orchestrator = AIOrchestrator.getInstance();

      // When/Then
      await expect(orchestrator.generateApp('Create app')).rejects.toThrow('API Error');
    });
  });

  describe('refineApp', () => {
    it('refines existing files with modification request', async () => {
      // Given
      mockGenerateContent.mockResolvedValueOnce(
        createMockResponse(`Updated the button text:

File: src/App.tsx
\`\`\`tsx
function App() {
  return <button>Updated</button>;
}
export default App;
\`\`\``)
      );

      const orchestrator = AIOrchestrator.getInstance();
      const existingFiles = [
        { path: 'src/App.tsx', content: 'function App() { return <div>Old</div>; }' },
      ];

      // When
      const result = await orchestrator.refineApp(existingFiles, 'Change button text');

      // Then
      expect(result).toBeDefined();
      expect(result.files).toBeDefined();
    });

    it('throws error when no API key is configured', async () => {
      // Given - create instance with null genAI
      const instanceWithoutKey = Object.create(AIOrchestrator.prototype);
      (instanceWithoutKey as any).genAI = null;
      (instanceWithoutKey as any).modelId = 'gemini-2.5-flash';
      const existingFiles = [{ path: 'src/App.tsx', content: 'test' }];

      // When/Then
      await expect(instanceWithoutKey.refineApp(existingFiles, 'Change something')).rejects.toThrow(
        'Gemini API Key not found'
      );
    });

    it('throws error when quota is exceeded', async () => {
      // Given
      quotaManager.setConfig({ maxRequestsPerMinute: 0 });

      const orchestrator = AIOrchestrator.getInstance();
      const existingFiles = [{ path: 'src/App.tsx', content: 'test' }];

      // When/Then
      await expect(orchestrator.refineApp(existingFiles, 'Change')).rejects.toThrow(/Quota Guard/);
    });

    // ITR-004: refineApp() MUST use REFINE_PROMPT (not inline context)
    it('calls REFINE_PROMPT with serialized current files and request (ITR-004)', async () => {
      // Given
      mockGenerateContent.mockResolvedValueOnce(
        createMockResponse(`File: src/App.tsx\n\`\`\`tsx\nupdated\n\`\`\``)
      );
      const orchestrator = AIOrchestrator.getInstance();
      const files = [
        { path: 'src/App.tsx', content: 'function App() {}' },
        { path: 'src/index.css', content: 'body { margin: 0; }' },
      ];

      // When
      await orchestrator.refineApp(files, 'Add a header');

      // Then — REFINE_PROMPT is called with serialized files string + request
      expect(mockRefinePrompt).toHaveBeenCalledTimes(1);
      const [contextArg, requestArg] = mockRefinePrompt.mock.calls[0];
      expect(contextArg).toContain('src/App.tsx');
      expect(contextArg).toContain('function App() {}');
      expect(contextArg).toContain('src/index.css');
      expect(requestArg).toBe('Add a header');
    });

    it('uses REFINE_PROMPT output as the content sent to Gemini (ITR-004)', async () => {
      // Given
      mockGenerateContent.mockResolvedValueOnce(
        createMockResponse(`File: src/App.tsx\n\`\`\`tsx\nupdated\n\`\`\``)
      );
      const orchestrator = AIOrchestrator.getInstance();
      const files = [{ path: 'src/App.tsx', content: 'old code' }];

      // When
      await orchestrator.refineApp(files, 'Change something');

      // Then — the content array passed to generateContent should contain
      // SYSTEM_PROMPT + REFINE_PROMPT output (NOT inline "Current Project Files:")
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      const [contents] = mockGenerateContent.mock.calls[0];
      // First element is system prompt
      expect(contents[0]).toBe('MOCK_SYSTEM_PROMPT');
      // Second element is REFINE_PROMPT output
      expect(contents[1]).toBe('MOCK_REFINE_PROMPT_OUTPUT');
      // Verify NO inline "Current Project Files:" text in any content part
      for (const part of contents) {
        expect(part).not.toContain('Current Project Files:');
      }
    });
  });

  describe('testConnection', () => {
    it('returns connection test result', async () => {
      // Given
      mockGenerateContent.mockResolvedValueOnce(createMockResponse('Connection Successful'));

      const orchestrator = AIOrchestrator.getInstance();

      // When
      const result = await orchestrator.testConnection();

      // Then
      expect(result).toContain('Connection Successful');
    });

    it('throws error when no API key is configured', async () => {
      // Given - create instance with null genAI
      const instanceWithoutKey = Object.create(AIOrchestrator.prototype);
      (instanceWithoutKey as any).genAI = null;
      (instanceWithoutKey as any).modelId = 'gemini-2.5-flash';

      // When/Then
      await expect(instanceWithoutKey.testConnection()).rejects.toThrow('No API Key configured');
    });

    it('throws error when API call fails', async () => {
      // Given
      mockGenerateContent.mockRejectedValueOnce(new Error('Network Error'));

      const orchestrator = AIOrchestrator.getInstance();

      // When/Then
      await expect(orchestrator.testConnection()).rejects.toThrow('Network Error');
    });
  });

  describe('updateConfig', () => {
    it('updates model and API key without throwing', () => {
      // Given
      const orchestrator = AIOrchestrator.getInstance();

      // When/Then
      expect(() => {
        orchestrator.updateConfig('new-api-key', 'gemini-2.0-flash');
      }).not.toThrow();
    });

    it('falls back to env key when no user key provided', () => {
      // Given
      import.meta.env.VITE_GEMINI_API_KEY = 'env-key';
      (AIOrchestrator as any).instance = null;

      const orchestrator = AIOrchestrator.getInstance();

      // When/Then
      expect(() => {
        orchestrator.updateConfig('', 'gemini-2.0-flash');
      }).not.toThrow();
    });

    // SEC-AKS-002: updateConfig log SHALL NOT contain hasApiKey
    it('log output SHALL NOT contain hasApiKey (SEC-AKS-002)', () => {
      // Given
      const logSpy = vi.spyOn(console, 'log');
      const orchestrator = AIOrchestrator.getInstance();

      // When
      orchestrator.updateConfig('any-key', 'gemini-2.5-flash');

      // Then — no log call should contain "hasApiKey"
      const logCalls = logSpy.mock.calls.map((call: any[]) => call.join(' '));
      for (const logMsg of logCalls) {
        expect(logMsg).not.toContain('hasApiKey');
      }

      logSpy.mockRestore();
    });

    // SEC-AKS-002: updateConfig log SHALL contain modelId
    it('log output SHALL contain modelId (SEC-AKS-002)', () => {
      // Given
      const logSpy = vi.spyOn(console, 'log');
      const orchestrator = AIOrchestrator.getInstance();

      // When
      orchestrator.updateConfig('any-key', 'gemini-2.5-flash');

      // Then — log should contain modelId=gemini-2.5-flash
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('modelId=gemini-2.5-flash'));

      logSpy.mockRestore();
    });
  });

  describe('sanitizeInput', () => {
    it('trims and limits prompt content to ~10000 chars (plus User Prompt prefix)', async () => {
      // Given - prompt will be prefixed with "User Prompt: " (13 chars)
      // So the total will be 13 + 10000 = 10013 after sanitization
      const longPrompt = '  ' + 'a'.repeat(10050) + '  ';

      mockGenerateContent.mockResolvedValueOnce(
        createMockResponse(`File: src/App.tsx
\`\`\`tsx
export default App;
\`\`\``)
      );

      const orchestrator = AIOrchestrator.getInstance();

      // When
      await orchestrator.generateApp(longPrompt);

      // Then - the prompt is prefixed, so total length is 13 + 10000 = 10013
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      const [, secondContent] = mockGenerateContent.mock.calls[0][0];
      // Verify it was trimmed (no leading/trailing whitespace)
      expect(secondContent).not.toMatch(/^ +| +$/);
      // The sanitized input is 10000 chars, plus prefix makes it 10013
      expect(secondContent.length).toBeLessThanOrEqual(10013);
    });

    it('handles very short input', async () => {
      // Given
      const shortPrompt = 'hi';

      mockGenerateContent.mockResolvedValueOnce(
        createMockResponse(`File: src/App.tsx
\`\`\`tsx
function App() {}
\`\`\``)
      );

      const orchestrator = AIOrchestrator.getInstance();

      // When
      await orchestrator.generateApp(shortPrompt);

      // Then
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('handles empty file list in refineApp', async () => {
      // Given
      mockGenerateContent.mockResolvedValueOnce(createMockResponse('No changes needed'));

      const orchestrator = AIOrchestrator.getInstance();

      // When
      const result = await orchestrator.refineApp([], 'Add something');

      // Then
      expect(result).toBeDefined();
    });

    it('handles API response with no files', async () => {
      // Given
      mockGenerateContent.mockResolvedValueOnce(
        createMockResponse('Some explanation but no files')
      );

      const orchestrator = AIOrchestrator.getInstance();

      // When
      const result = await orchestrator.generateApp('Create app');

      // Then
      expect(result).toBeDefined();
    });

    it('handles API response with multiple files', async () => {
      // Given
      mockGenerateContent.mockResolvedValueOnce(
        createMockResponse(`Here are the files:

File: src/App.tsx
\`\`\`tsx
export default function App() { return <div>App</div>; }
\`\`\`

File: src/index.css
\`\`\`css
body { margin: 0; }
\`\`\`

File: src/main.tsx
\`\`\`tsx
import App from './App';
\`\`\``)
      );

      const orchestrator = AIOrchestrator.getInstance();

      // When
      const result = await orchestrator.generateApp('Create full app');

      // Then
      expect(result.files?.length).toBeGreaterThanOrEqual(3);
    });
  });
});
