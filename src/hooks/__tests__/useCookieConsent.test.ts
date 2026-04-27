import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCookieConsent } from '../useCookieConsent';
import type { ConsentState } from '../../utils/consentStorage';

// Mock consentStorage module
vi.mock('../../utils/consentStorage', () => ({
  getConsent: vi.fn(),
  setConsent: vi.fn(),
  clearConsent: vi.fn(),
}));

import { getConsent, setConsent, clearConsent } from '../../utils/consentStorage';

const mockGetConsent = vi.mocked(getConsent);
const mockSetConsent = vi.mocked(setConsent);
const mockClearConsent = vi.mocked(clearConsent);

describe('useCookieConsent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConsent.mockReturnValue(null);
  });

  describe('initial state — no consent stored', () => {
    it('returns hasConsented=false when no consent in storage', () => {
      mockGetConsent.mockReturnValue(null);
      const { result } = renderHook(() => useCookieConsent());

      expect(result.current.hasConsented).toBe(false);
    });

    it('returns consentType=null when no consent in storage', () => {
      mockGetConsent.mockReturnValue(null);
      const { result } = renderHook(() => useCookieConsent());

      expect(result.current.consentType).toBeNull();
    });

    it('returns analyticsEnabled=false when no consent in storage', () => {
      mockGetConsent.mockReturnValue(null);
      const { result } = renderHook(() => useCookieConsent());

      expect(result.current.analyticsEnabled).toBe(false);
    });

    it('calls getConsent on mount to load stored state', () => {
      mockGetConsent.mockReturnValue(null);
      renderHook(() => useCookieConsent());

      expect(mockGetConsent).toHaveBeenCalledTimes(1);
    });
  });

  describe('initial state — consent previously accepted', () => {
    it('returns hasConsented=true when consent exists in storage', () => {
      const storedConsent: ConsentState = {
        analytics: true,
        essential: true,
        timestamp: Date.now(),
        version: 1,
      };
      mockGetConsent.mockReturnValue(storedConsent);
      const { result } = renderHook(() => useCookieConsent());

      expect(result.current.hasConsented).toBe(true);
    });

    it('returns consentType="accepted" when analytics is true', () => {
      const storedConsent: ConsentState = {
        analytics: true,
        essential: true,
        timestamp: Date.now(),
        version: 1,
      };
      mockGetConsent.mockReturnValue(storedConsent);
      const { result } = renderHook(() => useCookieConsent());

      expect(result.current.consentType).toBe('accepted');
    });

    it('returns analyticsEnabled=true when analytics is true', () => {
      const storedConsent: ConsentState = {
        analytics: true,
        essential: true,
        timestamp: Date.now(),
        version: 1,
      };
      mockGetConsent.mockReturnValue(storedConsent);
      const { result } = renderHook(() => useCookieConsent());

      expect(result.current.analyticsEnabled).toBe(true);
    });
  });

  describe('initial state — consent previously rejected', () => {
    it('returns hasConsented=true when consent exists (even if rejected)', () => {
      const storedConsent: ConsentState = {
        analytics: false,
        essential: true,
        timestamp: Date.now(),
        version: 1,
      };
      mockGetConsent.mockReturnValue(storedConsent);
      const { result } = renderHook(() => useCookieConsent());

      expect(result.current.hasConsented).toBe(true);
    });

    it('returns consentType="rejected" when analytics is false', () => {
      const storedConsent: ConsentState = {
        analytics: false,
        essential: true,
        timestamp: Date.now(),
        version: 1,
      };
      mockGetConsent.mockReturnValue(storedConsent);
      const { result } = renderHook(() => useCookieConsent());

      expect(result.current.consentType).toBe('rejected');
    });

    it('returns analyticsEnabled=false when analytics is false', () => {
      const storedConsent: ConsentState = {
        analytics: false,
        essential: true,
        timestamp: Date.now(),
        version: 1,
      };
      mockGetConsent.mockReturnValue(storedConsent);
      const { result } = renderHook(() => useCookieConsent());

      expect(result.current.analyticsEnabled).toBe(false);
    });
  });

  describe('acceptAll', () => {
    it('sets analytics to true via setConsent', () => {
      mockGetConsent.mockReturnValue(null);
      const { result } = renderHook(() => useCookieConsent());

      act(() => {
        result.current.acceptAll();
      });

      expect(mockSetConsent).toHaveBeenCalledWith({
        analytics: true,
        timestamp: expect.any(Number),
      });
    });

    it('updates hasConsented to true after accepting', () => {
      mockGetConsent.mockReturnValue(null);
      const { result } = renderHook(() => useCookieConsent());

      expect(result.current.hasConsented).toBe(false);

      act(() => {
        result.current.acceptAll();
      });

      expect(result.current.hasConsented).toBe(true);
    });

    it('updates consentType to "accepted" after accepting', () => {
      mockGetConsent.mockReturnValue(null);
      const { result } = renderHook(() => useCookieConsent());

      expect(result.current.consentType).toBeNull();

      act(() => {
        result.current.acceptAll();
      });

      expect(result.current.consentType).toBe('accepted');
    });

    it('updates analyticsEnabled to true after accepting', () => {
      mockGetConsent.mockReturnValue(null);
      const { result } = renderHook(() => useCookieConsent());

      expect(result.current.analyticsEnabled).toBe(false);

      act(() => {
        result.current.acceptAll();
      });

      expect(result.current.analyticsEnabled).toBe(true);
    });
  });

  describe('rejectNonEssential', () => {
    it('sets analytics to false via setConsent', () => {
      mockGetConsent.mockReturnValue(null);
      const { result } = renderHook(() => useCookieConsent());

      act(() => {
        result.current.rejectNonEssential();
      });

      expect(mockSetConsent).toHaveBeenCalledWith({
        analytics: false,
        timestamp: expect.any(Number),
      });
    });

    it('updates hasConsented to true after rejecting (user made a choice)', () => {
      mockGetConsent.mockReturnValue(null);
      const { result } = renderHook(() => useCookieConsent());

      expect(result.current.hasConsented).toBe(false);

      act(() => {
        result.current.rejectNonEssential();
      });

      expect(result.current.hasConsented).toBe(true);
    });

    it('updates consentType to "rejected" after rejecting', () => {
      mockGetConsent.mockReturnValue(null);
      const { result } = renderHook(() => useCookieConsent());

      expect(result.current.consentType).toBeNull();

      act(() => {
        result.current.rejectNonEssential();
      });

      expect(result.current.consentType).toBe('rejected');
    });

    it('keeps analyticsEnabled=false after rejecting', () => {
      mockGetConsent.mockReturnValue(null);
      const { result } = renderHook(() => useCookieConsent());

      act(() => {
        result.current.rejectNonEssential();
      });

      expect(result.current.analyticsEnabled).toBe(false);
    });
  });

  describe('clearConsentChoice', () => {
    it('calls clearConsent from storage utility', () => {
      const storedConsent: ConsentState = {
        analytics: true,
        essential: true,
        timestamp: Date.now(),
        version: 1,
      };
      mockGetConsent.mockReturnValue(storedConsent);
      const { result } = renderHook(() => useCookieConsent());

      act(() => {
        result.current.clearConsentChoice();
      });

      expect(mockClearConsent).toHaveBeenCalledTimes(1);
    });

    it('resets hasConsented to false after clearing', () => {
      const storedConsent: ConsentState = {
        analytics: true,
        essential: true,
        timestamp: Date.now(),
        version: 1,
      };
      mockGetConsent.mockReturnValue(storedConsent);
      const { result } = renderHook(() => useCookieConsent());

      expect(result.current.hasConsented).toBe(true);

      act(() => {
        result.current.clearConsentChoice();
      });

      expect(result.current.hasConsented).toBe(false);
    });

    it('resets consentType to null after clearing', () => {
      const storedConsent: ConsentState = {
        analytics: true,
        essential: true,
        timestamp: Date.now(),
        version: 1,
      };
      mockGetConsent.mockReturnValue(storedConsent);
      const { result } = renderHook(() => useCookieConsent());

      expect(result.current.consentType).toBe('accepted');

      act(() => {
        result.current.clearConsentChoice();
      });

      expect(result.current.consentType).toBeNull();
    });

    it('resets analyticsEnabled to false after clearing', () => {
      const storedConsent: ConsentState = {
        analytics: true,
        essential: true,
        timestamp: Date.now(),
        version: 1,
      };
      mockGetConsent.mockReturnValue(storedConsent);
      const { result } = renderHook(() => useCookieConsent());

      expect(result.current.analyticsEnabled).toBe(true);

      act(() => {
        result.current.clearConsentChoice();
      });

      expect(result.current.analyticsEnabled).toBe(false);
    });
  });

  describe('external consent (dependency injection)', () => {
    it('uses externalConsent when provided as null', () => {
      const { result } = renderHook(() => useCookieConsent(null));

      expect(result.current.hasConsented).toBe(false);
      expect(result.current.consentType).toBeNull();
      // Should NOT call getConsent when external is provided
      expect(mockGetConsent).not.toHaveBeenCalled();
    });

    it('uses externalConsent when provided as accepted', () => {
      const externalConsent: ConsentState = {
        analytics: true,
        essential: true,
        timestamp: Date.now(),
        version: 1,
      };
      const { result } = renderHook(() => useCookieConsent(externalConsent));

      expect(result.current.hasConsented).toBe(true);
      expect(result.current.consentType).toBe('accepted');
      expect(result.current.analyticsEnabled).toBe(true);
    });

    it('uses externalConsent when provided as rejected', () => {
      const externalConsent: ConsentState = {
        analytics: false,
        essential: true,
        timestamp: Date.now(),
        version: 1,
      };
      const { result } = renderHook(() => useCookieConsent(externalConsent));

      expect(result.current.hasConsented).toBe(true);
      expect(result.current.consentType).toBe('rejected');
      expect(result.current.analyticsEnabled).toBe(false);
    });

    it('updates state when externalConsent changes (rerender)', () => {
      const noConsent: ConsentState | null = null;
      const acceptedConsent: ConsentState = {
        analytics: true,
        essential: true,
        timestamp: Date.now(),
        version: 1,
      };

      const { result, rerender } = renderHook(
        ({ consent }: { consent: ConsentState | null }) => useCookieConsent(consent),
        {
          initialProps: { consent: noConsent as ConsentState | null },
        }
      );

      expect(result.current.hasConsented).toBe(false);

      rerender({ consent: acceptedConsent });

      expect(result.current.hasConsented).toBe(true);
      expect(result.current.consentType).toBe('accepted');
    });

    // CB-UCC-001: undefined vs null branch coverage
    it('calls getConsent when called with no argument (undefined)', () => {
      mockGetConsent.mockReturnValue(null);
      renderHook(() => useCookieConsent());

      // When no argument is passed, externalConsent is undefined
      // so the hook should call getConsent() instead of using external value
      expect(mockGetConsent).toHaveBeenCalledTimes(1);
    });

    it('calls getConsent when called with explicit undefined', () => {
      mockGetConsent.mockReturnValue(null);
      renderHook(() => useCookieConsent(undefined));

      // Explicit undefined should behave the same as no argument
      // → falls through to getConsent() branch
      expect(mockGetConsent).toHaveBeenCalledTimes(1);
    });

    it('does NOT call getConsent when called with explicit null', () => {
      renderHook(() => useCookieConsent(null));

      // null !== undefined, so the external consent branch is taken
      // → getConsent should NOT be called
      expect(mockGetConsent).not.toHaveBeenCalled();
    });

    it('distinguishes between undefined (no arg) and null (explicit) in initial state', () => {
      // With no argument → undefined → getConsent is called
      mockGetConsent.mockReturnValue(null);
      const { result: undefinedResult } = renderHook(() => useCookieConsent());
      expect(undefinedResult.current.hasConsented).toBe(false);

      // With null → external consent used directly
      const { result: nullResult } = renderHook(() => useCookieConsent(null));
      expect(nullResult.current.hasConsented).toBe(false);

      // Both have same output values but took different code paths
      // The key difference: getConsent was called for undefined, not for null
      expect(mockGetConsent).toHaveBeenCalledTimes(1); // Only called once (for the undefined call)
    });
  });

  describe('transition scenarios', () => {
    it('can go from accepted to rejected via rejectNonEssential', () => {
      const acceptedConsent: ConsentState = {
        analytics: true,
        essential: true,
        timestamp: Date.now(),
        version: 1,
      };
      mockGetConsent.mockReturnValue(acceptedConsent);
      const { result } = renderHook(() => useCookieConsent());

      expect(result.current.consentType).toBe('accepted');

      act(() => {
        result.current.rejectNonEssential();
      });

      expect(result.current.consentType).toBe('rejected');
      expect(result.current.analyticsEnabled).toBe(false);
    });

    it('can go from rejected to accepted via acceptAll', () => {
      const rejectedConsent: ConsentState = {
        analytics: false,
        essential: true,
        timestamp: Date.now(),
        version: 1,
      };
      mockGetConsent.mockReturnValue(rejectedConsent);
      const { result } = renderHook(() => useCookieConsent());

      expect(result.current.consentType).toBe('rejected');

      act(() => {
        result.current.acceptAll();
      });

      expect(result.current.consentType).toBe('accepted');
      expect(result.current.analyticsEnabled).toBe(true);
    });
  });
});
