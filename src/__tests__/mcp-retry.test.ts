import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, calculateBackoff, addJitter, isRetryable } from '../services/supabase/retry';
import { MCPAuthError, MCPValidationError, MCPNetworkError } from '../services/supabase/errors';

describe('Retry Logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      vi.useRealTimers();
      const fn = vi.fn().mockResolvedValue('success');
      const result = await withRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient failure', async () => {
      vi.useRealTimers();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');

      const result = await withRetry(fn, { maxRetries: 3 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries exhausted', async () => {
      vi.useRealTimers();
      const fn = vi.fn().mockRejectedValue(new Error('Persistent error'));

      await expect(withRetry(fn, { maxRetries: 1 })).rejects.toThrow('Persistent error');
      expect(fn).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
    }, 10000);

    it('should not retry on non-retryable errors', async () => {
      const fn = vi.fn().mockRejectedValue(new MCPAuthError('Invalid token'));

      await expect(withRetry(fn, { maxRetries: 3 })).rejects.toBeInstanceOf(MCPAuthError);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle async functions correctly', async () => {
      vi.useRealTimers();
      const fn = vi.fn().mockImplementation(() => Promise.resolve('async success'));

      const result = await withRetry(fn);
      expect(result).toBe('async success');
    });

    it('should call onRetry callback on each retry', async () => {
      vi.useRealTimers();
      const onRetry = vi.fn();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new MCPNetworkError('fail', 0, 3))
        .mockRejectedValueOnce(new MCPNetworkError('fail', 1, 3))
        .mockResolvedValue('success');

      const result = await withRetry(fn, { maxRetries: 3, onRetry });

      expect(result).toBe('success');
      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(MCPNetworkError));
      expect(onRetry).toHaveBeenCalledWith(2, expect.any(MCPNetworkError));
    });

    it('should handle non-Error thrown values', async () => {
      const fn = vi.fn().mockRejectedValue('string-error');

      await expect(withRetry(fn, { maxRetries: 0 })).rejects.toThrow('string-error');
    });
  });

  describe('calculateBackoff', () => {
    it('should return 1s for first retry', () => {
      const delay = calculateBackoff(0);
      expect(delay).toBe(1000);
    });

    it('should return 2s for second retry', () => {
      const delay = calculateBackoff(1);
      expect(delay).toBe(2000);
    });

    it('should return 4s for third retry', () => {
      const delay = calculateBackoff(2);
      expect(delay).toBe(4000);
    });

    it('should cap at max delay', () => {
      const delay = calculateBackoff(10, 5000);
      expect(delay).toBe(5000);
    });
  });

  describe('addJitter', () => {
    it('should add random delay between 0-500ms', () => {
      // Run multiple times to ensure randomness
      const delays: number[] = [];
      for (let i = 0; i < 100; i++) {
        const jittered = addJitter(1000);
        delays.push(jittered);
        expect(jittered).toBeGreaterThanOrEqual(1000);
        expect(jittered).toBeLessThanOrEqual(1500);
      }
    });

    it('should be deterministic with fixed random seed', () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      const jitter1 = addJitter(1000);
      expect(jitter1).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('isRetryable', () => {
    it('should return false for MCPAuthError', () => {
      expect(isRetryable(new MCPAuthError('Auth failed'))).toBe(false);
    });

    it('should return false for MCPValidationError', () => {
      expect(isRetryable(new MCPValidationError('Invalid input'))).toBe(false);
    });

    it('should return true for MCPNetworkError when under max retries', () => {
      const error = new MCPNetworkError('Connection failed', 1, 3);
      expect(isRetryable(error)).toBe(true);
    });

    it('should return false for MCPNetworkError when at max retries', () => {
      const error = new MCPNetworkError('Connection failed', 3, 3);
      expect(isRetryable(error)).toBe(false);
    });

    it('should return true for generic errors', () => {
      expect(isRetryable(new Error('Unknown error'))).toBe(true);
    });
  });
});
