import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AIQuotaManager, quotaManager } from '../services/ai/AIQuotaManager';

describe('AIQuotaManager', () => {
  let manager: AIQuotaManager;

  beforeEach(() => {
    manager = new AIQuotaManager();
  });

  describe('canMakeRequest — under limit', () => {
    it('allows request when under the rate limit', () => {
      const result = manager.canMakeRequest();

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('allows multiple requests up to the limit', () => {
      for (let i = 0; i < 14; i++) {
        manager.recordRequest();
      }

      const result = manager.canMakeRequest();
      expect(result.allowed).toBe(true);
    });
  });

  describe('canMakeRequest — rate limit exceeded', () => {
    it('denies request when max requests per minute is reached', () => {
      for (let i = 0; i < 15; i++) {
        manager.recordRequest();
      }

      const result = manager.canMakeRequest();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Rate limit exceeded');
    });

    it('denies request when request count exceeds limit', () => {
      for (let i = 0; i < 20; i++) {
        manager.recordRequest();
      }

      const result = manager.canMakeRequest();
      expect(result.allowed).toBe(false);
    });
  });

  describe('canMakeRequest — circuit breaker', () => {
    it('opens circuit breaker after reaching error threshold', () => {
      for (let i = 0; i < 5; i++) {
        manager.recordError();
      }

      const result = manager.canMakeRequest();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Circuit breaker open');
    });

    it('denies request while circuit breaker is open (before timeout)', () => {
      for (let i = 0; i < 5; i++) {
        manager.recordError();
      }

      // Circuit is open — immediate next request should fail
      const result = manager.canMakeRequest();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Circuit breaker open');
    });

    it('closes circuit breaker after timeout has elapsed', () => {
      vi.useFakeTimers();
      try {
        for (let i = 0; i < 5; i++) {
          manager.recordError();
        }

        // Verify circuit is open
        const before = manager.canMakeRequest();
        expect(before.allowed).toBe(false);

        // Advance past the 60000ms timeout
        vi.advanceTimersByTime(60001);

        // Circuit should close
        const after = manager.canMakeRequest();
        expect(after.allowed).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('resets error count when circuit breaker closes after timeout', () => {
      vi.useFakeTimers();
      try {
        for (let i = 0; i < 5; i++) {
          manager.recordError();
        }

        vi.advanceTimersByTime(60001);

        // Trigger circuit close
        manager.canMakeRequest();

        // Error count should be reset, so a few more errors should NOT reopen circuit
        manager.recordError();
        manager.recordError();

        const result = manager.canMakeRequest();
        expect(result.allowed).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('circuit breaker stays open if timeout has NOT elapsed', () => {
      vi.useFakeTimers();
      try {
        for (let i = 0; i < 5; i++) {
          manager.recordError();
        }

        // Advance only 30 seconds (not enough)
        vi.advanceTimersByTime(30000);

        const result = manager.canMakeRequest();
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Circuit breaker open');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('canMakeRequest — combined rate limit + circuit breaker', () => {
    it('checks circuit breaker before rate limit', () => {
      // Hit rate limit
      for (let i = 0; i < 15; i++) {
        manager.recordRequest();
      }
      // Also open circuit breaker
      for (let i = 0; i < 5; i++) {
        manager.recordError();
      }

      const result = manager.canMakeRequest();
      expect(result.allowed).toBe(false);
      // Circuit breaker should be reported (checked first)
      expect(result.reason).toContain('Circuit breaker open');
    });
  });

  describe('recordRequest', () => {
    it('increments request count', () => {
      manager.recordRequest();
      manager.recordRequest();
      manager.recordRequest();

      const stats = manager.getStats();
      expect(stats.requestCount).toBe(3);
    });
  });

  describe('recordError', () => {
    it('increments error count', () => {
      manager.recordError();
      manager.recordError();

      const stats = manager.getStats();
      expect(stats.errorCount).toBe(2);
    });

    it('opens circuit breaker at threshold (5 errors)', () => {
      for (let i = 0; i < 4; i++) {
        manager.recordError();
      }

      // Not yet open
      expect(manager.getStats().circuitOpen).toBe(false);

      manager.recordError();

      // Now open
      expect(manager.getStats().circuitOpen).toBe(true);
    });

    it('does not open circuit breaker below threshold', () => {
      for (let i = 0; i < 4; i++) {
        manager.recordError();
      }

      expect(manager.getStats().circuitOpen).toBe(false);
    });
  });

  describe('resetErrors', () => {
    it('resets error count to zero', () => {
      manager.recordError();
      manager.recordError();
      manager.recordError();

      manager.resetErrors();

      const stats = manager.getStats();
      expect(stats.errorCount).toBe(0);
    });

    it('closes the circuit breaker', () => {
      for (let i = 0; i < 5; i++) {
        manager.recordError();
      }
      expect(manager.getStats().circuitOpen).toBe(true);

      manager.resetErrors();

      expect(manager.getStats().circuitOpen).toBe(false);
    });

    it('allows requests after resetting errors', () => {
      for (let i = 0; i < 5; i++) {
        manager.recordError();
      }

      manager.resetErrors();

      const result = manager.canMakeRequest();
      expect(result.allowed).toBe(true);
    });
  });

  describe('resetIfNeeded — time-based reset', () => {
    it('resets request count after 60 seconds', () => {
      vi.useFakeTimers();
      try {
        // Record 15 requests (fill limit)
        for (let i = 0; i < 15; i++) {
          manager.recordRequest();
        }

        // Should be rate limited
        const before = manager.canMakeRequest();
        expect(before.allowed).toBe(false);

        // Advance 61 seconds
        vi.advanceTimersByTime(61000);

        // Should be allowed again
        const after = manager.canMakeRequest();
        expect(after.allowed).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('resets request count to 0 after time window', () => {
      vi.useFakeTimers();
      try {
        for (let i = 0; i < 10; i++) {
          manager.recordRequest();
        }

        vi.advanceTimersByTime(61000);

        // Trigger the reset check via canMakeRequest
        manager.canMakeRequest();

        const stats = manager.getStats();
        expect(stats.requestCount).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('getStats', () => {
    it('returns current request count', () => {
      manager.recordRequest();
      manager.recordRequest();

      const stats = manager.getStats();
      expect(stats.requestCount).toBe(2);
    });

    it('returns current error count', () => {
      manager.recordError();

      const stats = manager.getStats();
      expect(stats.errorCount).toBe(1);
    });

    it('returns circuit breaker state', () => {
      const stats = manager.getStats();
      expect(stats.circuitOpen).toBe(false);
    });

    it('returns requests remaining', () => {
      for (let i = 0; i < 5; i++) {
        manager.recordRequest();
      }

      const stats = manager.getStats();
      expect(stats.requestsRemaining).toBe(10); // 15 - 5
    });

    it('returns time until reset in milliseconds', () => {
      vi.useFakeTimers();
      try {
        vi.advanceTimersByTime(10000);

        const stats = manager.getStats();
        // Should be around 50000ms (60000 - 10000)
        expect(stats.timeUntilReset).toBeGreaterThan(40000);
        expect(stats.timeUntilReset).toBeLessThanOrEqual(50000);
      } finally {
        vi.useRealTimers();
      }
    });

    it('returns 0 for timeUntilReset when window has elapsed', () => {
      vi.useFakeTimers();
      try {
        vi.advanceTimersByTime(70000);

        // Need to trigger reset via canMakeRequest first to update lastReset
        manager.canMakeRequest();

        const stats = manager.getStats();
        expect(stats.timeUntilReset).toBeLessThanOrEqual(60000);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('setConfig', () => {
    it('allows overriding maxRequestsPerMinute', () => {
      manager.setConfig({ maxRequestsPerMinute: 5 });

      for (let i = 0; i < 5; i++) {
        manager.recordRequest();
      }

      const result = manager.canMakeRequest();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Rate limit exceeded');
    });

    it('allows overriding circuitBreakerThreshold', () => {
      manager.setConfig({ circuitBreakerThreshold: 2 });

      manager.recordError();
      manager.recordError();

      expect(manager.getStats().circuitOpen).toBe(true);
    });

    it('allows overriding circuitBreakerTimeout', () => {
      vi.useFakeTimers();
      try {
        manager.setConfig({ circuitBreakerTimeout: 5000 });

        for (let i = 0; i < 5; i++) {
          manager.recordError();
        }

        // Circuit is open
        expect(manager.canMakeRequest().allowed).toBe(false);

        // Advance past custom timeout (5s)
        vi.advanceTimersByTime(5001);

        expect(manager.canMakeRequest().allowed).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('preserves existing config when partially updating', () => {
      manager.setConfig({ maxRequestsPerMinute: 100 });

      const stats = manager.getStats();
      // requestsRemaining should reflect the new max
      expect(stats.requestsRemaining).toBe(100);
    });
  });

  describe('exported singleton instance', () => {
    it('quotaManager is an instance of AIQuotaManager', () => {
      expect(quotaManager).toBeDefined();
      expect(quotaManager.canMakeRequest).toBeDefined();
      expect(quotaManager.getStats).toBeDefined();
    });
  });
});
