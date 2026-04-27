import { describe, it, expect } from 'vitest';
import { sanitizeInput, validateInputLength } from '../utils/sanitize';

describe('SEC-03: Input Sanitization', () => {
  // ============ RED - Test: XSS attempt should be sanitized ============
  it('should sanitize XSS attack attempts (<script>)', () => {
    const maliciousInput = '<script>alert("XSS")</script>Hello';
    const sanitized = sanitizeInput(maliciousInput);

    // Script tags should be removed
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('</script>');
    // But safe content should remain
    expect(sanitized).toContain('Hello');
  });

  // ============ RED - Test: HTML entities should be escaped ============
  it('should escape dangerous HTML entities', () => {
    const maliciousInput = '<img src=x onerror=alert(1)>';
    const sanitized = sanitizeInput(maliciousInput);

    // onerror handlers should be removed
    expect(sanitized).not.toContain('onerror');
    expect(sanitized).not.toContain('<img');
  });

  // ============ RED - Test: Normal text should pass through ============
  it('should allow normal text without modification', () => {
    const normalInput = 'Create a hello world app with React';
    const sanitized = sanitizeInput(normalInput);

    expect(sanitized).toBe(normalInput);
  });

  // ============ RED - Test: Limit input length ============
  it('should truncate excessively long input', () => {
    const longInput = 'A'.repeat(50000);
    const sanitized = sanitizeInput(longInput);

    // Should be limited to a reasonable max length
    expect(sanitized.length).toBeLessThanOrEqual(10000);
  });

  // ============ TRIANGULATION - Test: JavaScript handlers ============
  it('should remove javascript: URIs', () => {
    const maliciousInput = '<a href="javascript:alert(1)">Click</a>';
    const sanitized = sanitizeInput(maliciousInput);

    expect(sanitized).not.toContain('javascript:');
  });
});

describe('CB-SAN-002: sanitizeInput edge cases', () => {
  it('should return empty string when input is empty string', () => {
    const result = sanitizeInput('');
    expect(result).toBe('');
  });

  it('should return empty string when input is non-string falsy (0)', () => {
    const result = sanitizeInput(0 as unknown as string);
    expect(result).toBe('');
  });

  it('should return empty string when input is non-string falsy (false)', () => {
    const result = sanitizeInput(false as unknown as string);
    expect(result).toBe('');
  });

  it('should strip null bytes from string', () => {
    const inputWithNullBytes = 'hello\0world\0test';
    const result = sanitizeInput(inputWithNullBytes);
    expect(result).not.toContain('\0');
    expect(result).toBe('helloworldtest');
  });
});

describe('CB-SAN-001: validateInputLength', () => {
  it('should return true for valid input within default limit', () => {
    expect(validateInputLength('hello world')).toBe(true);
  });

  it('should return false when input exceeds default limit (10000)', () => {
    const longInput = 'A'.repeat(10001);
    expect(validateInputLength(longInput)).toBe(false);
  });

  it('should return true for input exactly at default limit', () => {
    const exactLimitInput = 'A'.repeat(10000);
    expect(validateInputLength(exactLimitInput)).toBe(true);
  });

  it('should return true for valid input with custom limit', () => {
    expect(validateInputLength('hello', 10)).toBe(true);
  });

  it('should return false when input exceeds custom limit', () => {
    expect(validateInputLength('hello world', 5)).toBe(false);
  });

  it('should return false for non-string input', () => {
    expect(validateInputLength(42 as unknown as string)).toBe(false);
  });

  it('should return false for null input', () => {
    expect(validateInputLength(null as unknown as string)).toBe(false);
  });

  it('should return true for empty string (0 < any limit)', () => {
    expect(validateInputLength('')).toBe(true);
  });

  it('should return true for empty string with custom limit', () => {
    expect(validateInputLength('', 1)).toBe(true);
  });
});
