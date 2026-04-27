import { describe, it, expect, vi } from 'vitest';
import {
  sanitizeStackTrace,
  logWarnSafe,
  logInfoSafe,
  logErrorSafe,
  logError,
  getGenericErrorMessage,
  redactCredentials,
  ERROR_MESSAGES,
} from '../utils/logger';

describe('sanitizeStackTrace', () => {
  it('should strip URL query parameters from stack traces', () => {
    const input = 'Error at http://api.example.com?token=secret123 (line 5)';
    const result = sanitizeStackTrace(input);
    expect(result).not.toContain('?token=secret123');
    expect(result).not.toContain('secret123');
  });

  it('should truncate long file paths to last 3 segments', () => {
    const longPath =
      '/very/long/nested/directory/structure/that/goes/on/and/on/and/on/src/components/App.tsx';
    const input = `Error at (${longPath}:1:1)`;
    const result = sanitizeStackTrace(input);
    // Should contain only last 3 segments (without leading slash)
    expect(result).toContain('src/components/App.tsx');
    // Should NOT contain the early segments
    expect(result).not.toContain('/very/long/nested/directory/structure');
  });

  it('should leave short paths unchanged', () => {
    const shortPath = '/src/App.tsx';
    const input = `Error at (${shortPath}:1:1)`;
    const result = sanitizeStackTrace(input);
    expect(result).toContain(shortPath);
  });
});

describe('logWarnSafe', () => {
  it('should redact credentials and include context prefix', () => {
    const consoleWarnMock = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logWarnSafe('TestContext', 'API key AIzaSyB1234567890abcdefghijklmnopqrstuv leaked');

    const logContent = consoleWarnMock.mock.calls.map((c: any) => c.join(' ')).join(' ');
    expect(logContent).toContain('[REDACTED_API_KEY]');
    expect(logContent).toContain('[TestContext]');
    expect(logContent).not.toContain('AIzaSyB1234567890abcdefghijklmnopqrstuv');

    consoleWarnMock.mockRestore();
  });
});

describe('logInfoSafe', () => {
  it('should log info messages in dev mode with context prefix', () => {
    const consoleLogMock = vi.spyOn(console, 'log').mockImplementation(() => {});

    // In test environment, import.meta.env.PROD is false (dev mode)
    logInfoSafe('TestContext', 'Some debug info');

    const logContent = consoleLogMock.mock.calls.map((c: any) => c.join(' ')).join(' ');
    expect(logContent).toContain('[TestContext]');
    expect(logContent).toContain('Some debug info');

    consoleLogMock.mockRestore();
  });

  it('should redact credentials in info messages', () => {
    const consoleLogMock = vi.spyOn(console, 'log').mockImplementation(() => {});

    logInfoSafe('TestContext', 'API key AIzaSyB1234567890abcdefghijklmnopqrstuv in debug');

    const logContent = consoleLogMock.mock.calls.map((c: any) => c.join(' ')).join(' ');
    expect(logContent).toContain('[REDACTED_API_KEY]');
    expect(logContent).not.toContain('AIzaSyB1234567890abcdefghijklmnopqrstuv');

    consoleLogMock.mockRestore();
  });
});

describe('logErrorSafe', () => {
  it('should log redacted error message for Error instances', () => {
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('API key AIzaSyB1234567890abcdefghijklmnopqrstuv is invalid');

    logErrorSafe('TestContext', error);

    const logContent = consoleErrorMock.mock.calls.map((c: any) => c.join(' ')).join(' ');
    expect(logContent).toContain('[TestContext]');
    expect(logContent).toContain('[REDACTED_API_KEY]');
    expect(logContent).not.toContain('AIzaSyB1234567890abcdefghijklmnopqrstuv');

    consoleErrorMock.mockRestore();
  });

  it('should log "Unknown error" for non-Error values', () => {
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});

    logErrorSafe('TestContext', 'string error');

    const logContent = consoleErrorMock.mock.calls.map((c: any) => c.join(' ')).join(' ');
    expect(logContent).toContain('[TestContext]');
    expect(logContent).toContain('Unknown error');

    consoleErrorMock.mockRestore();
  });

  it('should log "Unknown error" for null', () => {
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});

    logErrorSafe('TestContext', null);

    const logContent = consoleErrorMock.mock.calls.map((c: any) => c.join(' ')).join(' ');
    expect(logContent).toContain('Unknown error');

    consoleErrorMock.mockRestore();
  });
});

describe('logError', () => {
  it('should log generic error message', () => {
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});

    logError('TestContext', new Error('fetch failed: network error'));

    const logContent = consoleErrorMock.mock.calls.map((c: any) => c.join(' ')).join(' ');
    expect(logContent).toContain('[TestContext]');
    expect(logContent).toContain(ERROR_MESSAGES.NETWORK_ERROR);

    consoleErrorMock.mockRestore();
  });
});

describe('getGenericErrorMessage', () => {
  it('should return NETWORK_ERROR for network errors', () => {
    expect(getGenericErrorMessage(new Error('network failure'))).toBe(ERROR_MESSAGES.NETWORK_ERROR);
  });

  it('should return NETWORK_ERROR for fetch errors', () => {
    expect(getGenericErrorMessage(new Error('Failed to fetch data'))).toBe(
      ERROR_MESSAGES.NETWORK_ERROR
    );
  });

  it('should return TIMEOUT_ERROR for timeout errors', () => {
    expect(getGenericErrorMessage(new Error('Request timed out'))).toBe(
      ERROR_MESSAGES.TIMEOUT_ERROR
    );
  });

  it('should return TIMEOUT_ERROR for "timed out" errors', () => {
    expect(getGenericErrorMessage(new Error('Operation timed out after 5000ms'))).toBe(
      ERROR_MESSAGES.TIMEOUT_ERROR
    );
  });

  it('should return AUTH_ERROR for auth errors', () => {
    expect(getGenericErrorMessage(new Error('auth token expired'))).toBe(ERROR_MESSAGES.AUTH_ERROR);
  });

  it('should return AUTH_ERROR for unauthorized errors', () => {
    expect(getGenericErrorMessage(new Error('unauthorized access'))).toBe(
      ERROR_MESSAGES.AUTH_ERROR
    );
  });

  it('should return AUTH_ERROR for 401 errors', () => {
    expect(getGenericErrorMessage(new Error('401 Unauthorized'))).toBe(ERROR_MESSAGES.AUTH_ERROR);
  });

  it('should return API_ERROR for 500 errors', () => {
    expect(getGenericErrorMessage(new Error('500 Internal Server Error'))).toBe(
      ERROR_MESSAGES.API_ERROR
    );
  });

  it('should return API_ERROR for server errors', () => {
    expect(getGenericErrorMessage(new Error('server error occurred'))).toBe(
      ERROR_MESSAGES.API_ERROR
    );
  });

  it('should return UNKNOWN_ERROR for non-Error values', () => {
    expect(getGenericErrorMessage('string error')).toBe(ERROR_MESSAGES.UNKNOWN_ERROR);
  });

  it('should return UNKNOWN_ERROR for unrecognized errors', () => {
    expect(getGenericErrorMessage(new Error('something completely random'))).toBe(
      ERROR_MESSAGES.UNKNOWN_ERROR
    );
  });
});

describe('redactCredentials', () => {
  it('should redact Bearer tokens', () => {
    const result = redactCredentials('Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456');
    expect(result).not.toContain('abcdefghijklmnopqrstuvwxyz123456');
    expect(result).toContain('[REDACTED_TOKEN]');
  });

  it('should redact Supabase project URLs', () => {
    const result = redactCredentials('Connecting to https://myproject.supabase.co');
    expect(result).not.toContain('myproject');
    expect(result).toContain('[REDACTED].supabase.co');
  });

  it('should redact JWT tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.abcdefghijklmnopqrstuvwxyz1234567890';
    const result = redactCredentials(`Token: ${jwt}`);
    expect(result).toContain('[REDACTED_JWT]');
  });

  it('should leave non-credential strings unchanged', () => {
    const result = redactCredentials('Normal log message without credentials');
    expect(result).toBe('Normal log message without credentials');
  });
});
