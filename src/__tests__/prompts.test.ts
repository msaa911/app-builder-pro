import { describe, it, expect } from 'vitest';
import { SYSTEM_PROMPT, REFINE_PROMPT, CRUD_APP_PROMPT } from '../services/ai/prompts';
import fs from 'fs';
import path from 'path';

describe('prompts', () => {
  it('should contain Tailwind in system prompt (since Tailwind is installed)', () => {
    expect(SYSTEM_PROMPT).toContain('Tailwind');
  });
});

describe('SEC-TW: Tailwind Support Verification', () => {
  it('SEC-TW-001: SYSTEM_PROMPT references Tailwind CSS for generated app styling', () => {
    expect(SYSTEM_PROMPT).toContain('Tailwind CSS');
  });

  it('SEC-TW-002: index.css imports tailwindcss', () => {
    const indexCssPath = path.resolve(__dirname, '../index.css');
    const indexCss = fs.readFileSync(indexCssPath, 'utf-8');
    expect(indexCss).toContain("@import 'tailwindcss'");
  });
});

describe('REFINE_PROMPT function', () => {
  it('should return a string when called', () => {
    const result = REFINE_PROMPT('current files code', 'add a dark mode toggle');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should contain modification instructions', () => {
    const result = REFINE_PROMPT('some code', 'change the button color');
    expect(result).toContain('updating an existing web application');
    expect(result).toContain('User Request for Modification');
  });

  // ITR-003: REFINE_PROMPT must interpolate actual values, not return literal ${currentFiles}
  it('interpolates currentFiles value into the prompt (ITR-003)', () => {
    const currentFiles = 'File: src/App.tsx\n\nfunction App() {}';
    const result = REFINE_PROMPT(currentFiles, 'make it red');
    expect(result).toContain('File: src/App.tsx');
    expect(result).toContain('function App()');
    expect(result).not.toContain('${currentFiles}');
  });

  it('interpolates request value into the prompt (ITR-003)', () => {
    const request = 'add a dark mode toggle to the header';
    const result = REFINE_PROMPT('some code', request);
    expect(result).toContain('add a dark mode toggle to the header');
    expect(result).not.toContain('${request}');
  });

  it('does NOT return template literal placeholders when called with real strings', () => {
    const result = REFINE_PROMPT('my-file-context', 'my-request-text');
    expect(result).not.toContain('${currentFiles}');
    expect(result).not.toContain('${request}');
    expect(result).toContain('my-file-context');
    expect(result).toContain('my-request-text');
  });
});

describe('CRUD_APP_PROMPT constant', () => {
  it('should be a non-empty string', () => {
    expect(typeof CRUD_APP_PROMPT).toBe('string');
    expect(CRUD_APP_PROMPT.length).toBeGreaterThan(0);
  });

  it('should contain CRUD-related instructions', () => {
    expect(CRUD_APP_PROMPT).toContain('CRUD');
  });
});
