/**
 * Consent Storage Branch Tests
 * Covers:
 * - getConsent returns null for missing/invalid/corrupt data
 * - setConsent writes valid state
 * - setConsent catches localStorage failure (line 72-73)
 * - clearConsent removes item
 * - clearConsent catches localStorage failure (line 83-84)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getConsent, setConsent, clearConsent } from '../consentStorage';

describe('consentStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getConsent', () => {
    it('should return null when no consent is stored', () => {
      expect(getConsent()).toBeNull();
    });

    it('should return valid consent state when properly stored', () => {
      const state = {
        analytics: true,
        essential: true as const,
        timestamp: Date.now(),
        version: 1 as const,
      };
      localStorage.setItem('app-consent-state', JSON.stringify(state));

      const result = getConsent();
      expect(result).not.toBeNull();
      expect(result!.analytics).toBe(true);
      expect(result!.essential).toBe(true);
      expect(result!.version).toBe(1);
    });

    it('should return null when analytics is not boolean', () => {
      const state = { analytics: 'yes', essential: true, timestamp: Date.now(), version: 1 };
      localStorage.setItem('app-consent-state', JSON.stringify(state));

      expect(getConsent()).toBeNull();
    });

    it('should return null when essential is not true', () => {
      const state = { analytics: true, essential: false, timestamp: Date.now(), version: 1 };
      localStorage.setItem('app-consent-state', JSON.stringify(state));

      expect(getConsent()).toBeNull();
    });

    it('should return null when timestamp is not a number', () => {
      const state = { analytics: true, essential: true, timestamp: 'not-a-number', version: 1 };
      localStorage.setItem('app-consent-state', JSON.stringify(state));

      expect(getConsent()).toBeNull();
    });

    it('should return null when version is not 1', () => {
      const state = { analytics: true, essential: true, timestamp: Date.now(), version: 2 };
      localStorage.setItem('app-consent-state', JSON.stringify(state));

      expect(getConsent()).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      localStorage.setItem('app-consent-state', 'not-json');

      expect(getConsent()).toBeNull();
    });
  });

  describe('setConsent', () => {
    it('should save consent state to localStorage', () => {
      setConsent({ analytics: true, timestamp: 1234567890 });

      const stored = JSON.parse(localStorage.getItem('app-consent-state')!);
      expect(stored.analytics).toBe(true);
      expect(stored.essential).toBe(true);
      expect(stored.timestamp).toBe(1234567890);
      expect(stored.version).toBe(1);
    });

    it('should handle localStorage failure gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // Make setItem throw
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      // Should not throw
      expect(() => setConsent({ analytics: false, timestamp: 123 })).not.toThrow();

      consoleWarnSpy.mockRestore();
      vi.restoreAllMocks();
    });
  });

  describe('clearConsent', () => {
    it('should remove consent from localStorage', () => {
      localStorage.setItem(
        'app-consent-state',
        JSON.stringify({
          analytics: true,
          essential: true,
          timestamp: Date.now(),
          version: 1,
        })
      );

      clearConsent();

      expect(localStorage.getItem('app-consent-state')).toBeNull();
    });

    it('should handle localStorage failure gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      // Should not throw
      expect(() => clearConsent()).not.toThrow();

      consoleWarnSpy.mockRestore();
      vi.restoreAllMocks();
    });
  });
});
