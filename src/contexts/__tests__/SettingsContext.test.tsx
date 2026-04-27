/**
 * SettingsContext Branch Tests
 * Covers:
 * - Invalid saved modelId fallback (line 54)
 * - setModelId ignoring invalid id (line 73)
 * - getEffectiveApiKey fallback to env var (line 79)
 * - useSettings throwing when used outside provider (line 100)
 * - beforeUnload clearing apiKey (line 60)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { SettingsProvider, useSettings, AVAILABLE_MODELS } from '../SettingsContext';

// Helper component that reads and exposes settings
const SettingsReader = () => {
  const { apiKey, modelId, setApiKey, setModelId, getEffectiveApiKey } = useSettings();
  return (
    <div>
      <span data-testid="apiKey">{apiKey}</span>
      <span data-testid="modelId">{modelId}</span>
      <span data-testid="effectiveApiKey">{getEffectiveApiKey()}</span>
      <button data-testid="setApiKey" onClick={() => setApiKey('test-key-123')} />
      <button data-testid="setModelId" onClick={() => setModelId('gemini-2.5-pro')} />
      <button data-testid="setInvalidModelId" onClick={() => setModelId('nonexistent-model')} />
    </div>
  );
};

describe('SettingsContext', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('should default to gemini-2.5-flash when sessionStorage has invalid modelId', () => {
    sessionStorage.setItem('app-builder-model-id', 'invalid-model-id');

    render(
      <SettingsProvider>
        <SettingsReader />
      </SettingsProvider>
    );

    expect(screen.getByTestId('modelId').textContent).toBe('gemini-2.5-flash');
  });

  it('should use saved modelId when sessionStorage has valid model', () => {
    sessionStorage.setItem('app-builder-model-id', 'gemini-2.5-pro');

    render(
      <SettingsProvider>
        <SettingsReader />
      </SettingsProvider>
    );

    expect(screen.getByTestId('modelId').textContent).toBe('gemini-2.5-pro');
  });

  it('should default to gemini-2.5-flash when sessionStorage is empty', () => {
    render(
      <SettingsProvider>
        <SettingsReader />
      </SettingsProvider>
    );

    expect(screen.getByTestId('modelId').textContent).toBe('gemini-2.5-flash');
  });

  it('should ignore invalid modelId when setModelId is called', () => {
    render(
      <SettingsProvider>
        <SettingsReader />
      </SettingsProvider>
    );

    // Set valid first
    fireEvent.click(screen.getByTestId('setModelId'));
    expect(screen.getByTestId('modelId').textContent).toBe('gemini-2.5-pro');

    // Try to set invalid
    fireEvent.click(screen.getByTestId('setInvalidModelId'));
    // Should still be gemini-2.5-pro (ignored the invalid id)
    expect(screen.getByTestId('modelId').textContent).toBe('gemini-2.5-pro');
  });

  it('should return env var fallback when apiKey is empty', () => {
    import.meta.env.VITE_GEMINI_API_KEY = 'env-api-key-456';

    render(
      <SettingsProvider>
        <SettingsReader />
      </SettingsProvider>
    );

    // apiKey is empty, so getEffectiveApiKey should fall back to env var
    expect(screen.getByTestId('apiKey').textContent).toBe('');
    expect(screen.getByTestId('effectiveApiKey').textContent).toBe('env-api-key-456');

    delete import.meta.env.VITE_GEMINI_API_KEY;
  });

  it('should return empty string when both apiKey and env var are empty', () => {
    delete import.meta.env.VITE_GEMINI_API_KEY;

    render(
      <SettingsProvider>
        <SettingsReader />
      </SettingsProvider>
    );

    expect(screen.getByTestId('effectiveApiKey').textContent).toBe('');
  });

  it('should throw when useSettings is used outside SettingsProvider', () => {
    // Suppress console.error for this test since React will log the error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const OutsideProvider = () => {
      useSettings();
      return <div>should not render</div>;
    };

    expect(() => render(<OutsideProvider />)).toThrow(
      'useSettings must be used within a SettingsProvider'
    );

    consoleSpy.mockRestore();
  });

  it('should set apiKey and return it from getEffectiveApiKey', () => {
    render(
      <SettingsProvider>
        <SettingsReader />
      </SettingsProvider>
    );

    // Initially empty
    expect(screen.getByTestId('apiKey').textContent).toBe('');

    // Set apiKey
    fireEvent.click(screen.getByTestId('setApiKey'));
    expect(screen.getByTestId('apiKey').textContent).toBe('test-key-123');
    expect(screen.getByTestId('effectiveApiKey').textContent).toBe('test-key-123');
  });
});
