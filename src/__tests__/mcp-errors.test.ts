import { describe, it, expect } from 'vitest';
import {
  MCPError,
  MCPNetworkError,
  MCPAuthError,
  MCPRateLimitError,
  MCPNotFoundError,
  MCPValidationError,
  MCPTimeoutError,
  mapHttpError,
} from '../services/supabase/errors';

describe('MCPError', () => {
  it('should create error with code and message', () => {
    const error = new MCPAuthError('Authentication failed');
    expect(error.code).toBe('AUTH');
    expect(error.message).toBe('Authentication failed');
  });

  it('should include context in error', () => {
    const context = { timestamp: '2024-01-01', requestId: '123' };
    const error = new MCPNetworkError('Network error', 0, 3, context);
    expect(error.context).toEqual(context);
  });

  it('should be instance of Error', () => {
    const error = new MCPAuthError('Test error');
    expect(error).toBeInstanceOf(Error);
  });

  it('should have name set to class name', () => {
    const error = new MCPAuthError('Test');
    expect(error.name).toBe('MCPAuthError');
  });
});

describe('MCPNetworkError', () => {
  it('should track retry count', () => {
    const error = new MCPNetworkError('Connection failed', 2, 3);
    expect(error.retryCount).toBe(2);
    expect(error.maxRetries).toBe(3);
  });

  it('should be retryable when under max', () => {
    const error = new MCPNetworkError('Connection failed', 1, 3);
    expect(error.isRetryable()).toBe(true);
  });

  it('should not be retryable when at max', () => {
    const error = new MCPNetworkError('Connection failed', 3, 3);
    expect(error.isRetryable()).toBe(false);
  });
});

describe('MCPAuthError', () => {
  it('should have AUTH code', () => {
    const error = new MCPAuthError('Invalid token');
    expect(error.code).toBe('AUTH');
  });

  it('should not be retryable', () => {
    const error = new MCPAuthError('Invalid token');
    expect(error.isRetryable()).toBe(false);
  });
});

describe('MCPRateLimitError', () => {
  it('should have RATE_LIMIT code', () => {
    const error = new MCPRateLimitError(60);
    expect(error.code).toBe('RATE_LIMIT');
    expect(error.retryAfter).toBe(60);
  });

  it('should return retryAfter value', () => {
    const error = new MCPRateLimitError(30);
    expect(error.getRetryAfter()).toBe(30);
  });
});

describe('MCPNotFoundError', () => {
  it('should have NOT_FOUND code', () => {
    const error = new MCPNotFoundError('project');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toContain('project');
  });
});

describe('MCPValidationError', () => {
  it('should have VALIDATION code and field', () => {
    const error = new MCPValidationError('Invalid email', 'email');
    expect(error.code).toBe('VALIDATION');
    expect(error.field).toBe('email');
  });
});

describe('MCPTimeoutError', () => {
  it('should create error with TIMEOUT code', () => {
    const error = new MCPTimeoutError(30000);
    expect(error.code).toBe('TIMEOUT');
    expect(error.message).toBe('Request timed out after 30000ms');
  });

  it('should include timeout value in message', () => {
    const error = new MCPTimeoutError(5000);
    expect(error.message).toContain('5000');
  });

  it('should not be retryable', () => {
    const error = new MCPTimeoutError(30000);
    expect(error.isRetryable()).toBe(false);
  });
});

describe('mapHttpError', () => {
  describe('default case for unknown status codes', () => {
    it('should return MCPNetworkError with maxRetries: 0 for status 418', () => {
      const error = mapHttpError(418, "I'm a teapot");
      expect(error).toBeInstanceOf(MCPNetworkError);
      expect(error.code).toBe('NETWORK');
      expect(error.message).toBe("I'm a teapot");
      // Default case sets maxRetries to 0
      expect((error as MCPNetworkError).maxRetries).toBe(0);
    });

    it('should return MCPNetworkError with maxRetries: 0 for status 501', () => {
      const error = mapHttpError(501, 'Not Implemented');
      expect(error).toBeInstanceOf(MCPNetworkError);
      expect((error as MCPNetworkError).maxRetries).toBe(0);
    });

    it('should return MCPNetworkError with maxRetries: 0 for status 509', () => {
      const error = mapHttpError(509, 'Bandwidth Limit Exceeded');
      expect(error).toBeInstanceOf(MCPNetworkError);
      expect((error as MCPNetworkError).maxRetries).toBe(0);
    });

    it('should handle unknown status code 999', () => {
      const error = mapHttpError(999, 'Unknown error');
      expect(error).toBeInstanceOf(MCPNetworkError);
      expect((error as MCPNetworkError).maxRetries).toBe(0);
    });

    it('should handle unknown status code 600', () => {
      const error = mapHttpError(600, 'Invalid response');
      expect(error).toBeInstanceOf(MCPNetworkError);
      expect((error as MCPNetworkError).maxRetries).toBe(0);
    });
  });

  describe('specific status code mappings', () => {
    it('should map 401 to MCPAuthError', () => {
      const error = mapHttpError(401, 'Unauthorized');
      expect(error).toBeInstanceOf(MCPAuthError);
      expect(error.code).toBe('AUTH');
      expect(error.message).toBe('Unauthorized');
    });

    it('should map 403 to MCPAuthError', () => {
      const error = mapHttpError(403, 'Forbidden');
      expect(error).toBeInstanceOf(MCPAuthError);
      expect(error.code).toBe('AUTH');
    });

    it('should map 404 to MCPNotFoundError', () => {
      const error = mapHttpError(404, 'Project not found');
      expect(error).toBeInstanceOf(MCPNotFoundError);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toContain('Project not found');
    });

    it('should map 409 to MCPValidationError with field=name', () => {
      const error = mapHttpError(409, 'Name already exists');
      expect(error).toBeInstanceOf(MCPValidationError);
      expect(error.code).toBe('VALIDATION');
      expect((error as MCPValidationError).field).toBe('name');
    });

    it('should map 429 to MCPRateLimitError with context retryAfter', () => {
      const error = mapHttpError(429, 'Too many requests', { retryAfter: 120 });
      expect(error).toBeInstanceOf(MCPRateLimitError);
      expect(error.code).toBe('RATE_LIMIT');
      expect((error as MCPRateLimitError).retryAfter).toBe(120);
    });

    it('should map 429 to MCPRateLimitError with default 60 when no context', () => {
      const error = mapHttpError(429, 'Too many requests');
      expect(error).toBeInstanceOf(MCPRateLimitError);
      expect((error as MCPRateLimitError).retryAfter).toBe(60);
    });

    it('should map 400 to MCPValidationError without field', () => {
      const error = mapHttpError(400, 'Bad request');
      expect(error).toBeInstanceOf(MCPValidationError);
      expect(error.code).toBe('VALIDATION');
      expect((error as MCPValidationError).field).toBeUndefined();
    });

    it('should map 500 to MCPNetworkError with maxRetries=3', () => {
      const error = mapHttpError(500, 'Internal Server Error');
      expect(error).toBeInstanceOf(MCPNetworkError);
      expect((error as MCPNetworkError).maxRetries).toBe(3);
    });

    it('should map 502 to MCPNetworkError with maxRetries=3', () => {
      const error = mapHttpError(502, 'Bad Gateway');
      expect(error).toBeInstanceOf(MCPNetworkError);
      expect((error as MCPNetworkError).maxRetries).toBe(3);
    });

    it('should map 503 to MCPNetworkError with maxRetries=3', () => {
      const error = mapHttpError(503, 'Service Unavailable');
      expect(error).toBeInstanceOf(MCPNetworkError);
      expect((error as MCPNetworkError).maxRetries).toBe(3);
    });
  });
});

describe('MCPNetworkError defaults', () => {
  it('should default retryCount to 0 and maxRetries to 3', () => {
    const error = new MCPNetworkError('Connection failed');
    expect(error.retryCount).toBe(0);
    expect(error.maxRetries).toBe(3);
  });
});

describe('MCPValidationError', () => {
  it('should have undefined field when not provided', () => {
    const error = new MCPValidationError('Invalid input');
    expect(error.field).toBeUndefined();
  });
});

describe('MCPError.getRetryAfter', () => {
  it('should return undefined when context has no retryAfter', () => {
    const error = new MCPNetworkError('fail', 0, 3);
    expect(error.getRetryAfter()).toBeUndefined();
  });

  it('should return retryAfter from context when present', () => {
    const error = new MCPNetworkError('fail', 0, 3, { retryAfter: 30 });
    expect(error.getRetryAfter()).toBe(30);
  });
});
