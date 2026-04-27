// src/services/ai/AIQuotaManager.ts

export interface QuotaConfig {
  maxRequestsPerMinute: number;
  maxRetries: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
}

export class AIQuotaManager {
  private requestCount: number = 0;
  private errorCount: number = 0;
  private lastReset: number = Date.now();
  private circuitOpen: boolean = false;
  private circuitOpenedAt: number = 0;

  private config: QuotaConfig = {
    maxRequestsPerMinute: 15,
    maxRetries: 3,
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 60000,
  };

  canMakeRequest(): { allowed: boolean; reason?: string } {
    if (this.circuitOpen) {
      const elapsed = Date.now() - this.circuitOpenedAt;
      if (elapsed < this.config.circuitBreakerTimeout) {
        return { allowed: false, reason: 'Circuit breaker open - too many errors' };
      }
      this.circuitOpen = false;
      this.errorCount = 0;
    }

    this.resetIfNeeded();
    if (this.requestCount >= this.config.maxRequestsPerMinute) {
      return { allowed: false, reason: 'Rate limit exceeded - max 15 requests/minute' };
    }

    return { allowed: true };
  }

  recordRequest() {
    this.requestCount++;
  }

  recordError() {
    this.errorCount++;
    if (this.errorCount >= this.config.circuitBreakerThreshold) {
      this.circuitOpen = true;
      this.circuitOpenedAt = Date.now();
    }
  }

  resetErrors() {
    this.errorCount = 0;
    this.circuitOpen = false;
  }

  private resetIfNeeded() {
    const elapsed = Date.now() - this.lastReset;
    if (elapsed >= 60000) {
      this.requestCount = 0;
      this.lastReset = Date.now();
    }
  }

  getStats() {
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      circuitOpen: this.circuitOpen,
      requestsRemaining: this.config.maxRequestsPerMinute - this.requestCount,
      timeUntilReset: Math.max(0, 60000 - (Date.now() - this.lastReset)),
    };
  }

  setConfig(config: Partial<QuotaConfig>) {
    this.config = { ...this.config, ...config };
  }
}

export const quotaManager = new AIQuotaManager();
