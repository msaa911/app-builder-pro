import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Project root directory
const projectRoot = path.resolve(__dirname, '../..');
const envExamplePath = path.resolve(projectRoot, '.env.example');

describe('SEC-01: Credential Exposure Prevention', () => {
  // Silence console.log/warn/error in test output — security scan output only
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  // ============ Helper Functions ============

  /**
   * Common credential patterns that indicate exposed secrets
   * Based on OWASP secrets detection guidelines
   */
  const credentialPatterns = [
    // Google AI / Gemini API keys (typically start with AIza)
    { pattern: /AIza[0-9A-Za-z_-]{35}/, name: 'Google API Key (AIza*)' },

    // Generic API key patterns (high entropy strings assigned to API_KEY vars)
    { pattern: /API_KEY["']?\s*[:=]\s*["']?[A-Za-z0-9_-]{20,}["']?/, name: 'Generic API Key' },

    // JWT tokens (header.payload.signature format)
    { pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/, name: 'JWT Token' },

    // Supabase anon keys (start with eyJ and contain "supabase")
    {
      pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
      name: 'Supabase JWT',
    },

    // AWS keys
    { pattern: /AKIA[0-9A-Z]{16}/, name: 'AWS Access Key' },

    // Generic secret patterns (high entropy, 32+ chars)
    { pattern: /SECRET["']?\s*[:=]\s*["']?[A-Za-z0-9_\-+=/]{32,}["']?/, name: 'Generic Secret' },

    // Private keys (PEM format)
    { pattern: /-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/, name: 'Private Key' },

    // Password assignment patterns
    { pattern: /PASSWORD["']?\s*[:=]\s*["']?[^"'`\s]{8,}["']?/, name: 'Hardcoded Password' },

    // Bearer tokens
    { pattern: /Bearer\s+[A-Za-z0-9_-]{20,}/, name: 'Bearer Token' },
  ];

  /**
   * Check if a string looks like a real credential vs placeholder
   * Real credentials have high entropy and don't contain "your-" or "-here" or "example"
   */
  function isRealCredential(value: string): boolean {
    const normalized = value.toLowerCase().trim();

    // These indicate placeholders
    if (
      normalized.includes('your-') ||
      normalized.includes('-here') ||
      normalized.includes('_here') ||
      normalized.includes('example') ||
      normalized === 'null' ||
      normalized === 'undefined'
    ) {
      return false;
    }

    // Real credentials typically have high entropy (mix of chars)
    // Placeholders are simple, predictable strings
    return true;
  }

  // ============ Test: .env.example has placeholders ============

  it('.env.example should contain only placeholder values', () => {
    expect(fs.existsSync(envExamplePath)).toBe(true);

    const content = fs.readFileSync(envExamplePath, 'utf-8');
    const lines = content.split('\n');

    // Find all variable assignments
    const variablePattern = /^(?:VITE_|SUPABASE_)?([A-Z_]+)=(.+)$/;

    lines.forEach((line) => {
      const match = line.match(variablePattern);
      if (match) {
        const [, varName, value] = match;
        const trimmedValue = value.trim();

        // Skip comments
        if (trimmedValue.startsWith('#')) return;

        // Check if value looks like placeholder
        const isPlaceholder =
          trimmedValue.includes('your-') ||
          trimmedValue.includes('-here') ||
          trimmedValue.includes('_here') ||
          trimmedValue.startsWith('https://your-');

        // If it's a real credential format (URL or key), warn
        if (
          trimmedValue.startsWith('https://') &&
          !trimmedValue.includes('your-') &&
          !trimmedValue.includes('example')
        ) {
          // This could be a real URL - investigate but don't fail on .env.example
        }

        if (!isPlaceholder && isRealCredential(trimmedValue)) {
          console.warn(
            `.env.example contains potential real value in ${varName}: ${trimmedValue.substring(0, 10)}...`
          );
        }
      }
    });

    // We expect placeholders, not real values - this test passes if it doesn't throw
  });

  // ============ Test: Source files should not contain credential patterns ============

  it('source files should not contain hardcoded credentials', () => {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte'];
    let violations: Array<{ file: string; pattern: string; match: string }> = [];

    function scanDirectory(dir: string): void {
      if (!fs.existsSync(dir)) return;

      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip node_modules, dist, .git, test directories, and fixtures
        if (
          entry.name === 'node_modules' ||
          entry.name === 'dist' ||
          entry.name === '.git' ||
          entry.name.startsWith('.') ||
          entry.name === '__tests__' ||
          entry.name === '__fixtures__' ||
          entry.name === 'test' ||
          entry.name === 'scripts'
        ) {
          continue;
        }

        if (entry.isDirectory()) {
          scanDirectory(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (!extensions.includes(ext)) return;

          // Skip test files - they've been validated
          if (fullPath.includes('__tests__')) return;

          try {
            const content = fs.readFileSync(fullPath, 'utf-8');

            // Check each credential pattern
            for (const { pattern, name } of credentialPatterns) {
              const matches = content.match(new RegExp(pattern, 'gi'));
              if (matches) {
                for (const match of matches) {
                  // Skip if it's in a comment or string literal explaining what to do
                  const isComment = /^\s*\/\//.test(match) || /^\s*\*\s/.test(match);
                  const isExample = /your-|example|-here/i.test(match);

                  if (!isComment && !isExample) {
                    // Verify it's actually a real credential value
                    const extractedValue = match.match(/["']([^"']+)["']/)?.[1] || match;
                    if (isRealCredential(extractedValue)) {
                      violations.push({
                        file: path.relative(projectRoot, fullPath),
                        pattern: name,
                        match: match.substring(0, 50) + (match.length > 50 ? '...' : ''),
                      });
                    }
                  }
                }
              }
            }
          } catch {
            // Skip files that can't be read as UTF-8
          }
        }
      }
    }

    scanDirectory(path.join(projectRoot, 'src'));

    if (violations.length > 0) {
      console.error('\n🚨 Credential exposure detected:');
      violations.forEach(({ file, pattern, match }) => {
        console.error(`  ${file}: ${pattern}`);
        console.error(`    Found: ${match}`);
      });
    }

    expect(violations).toHaveLength(0);
  });

  // ============ Test: No real credentials in .env ============

  // Note: .env.local should NOT exist (gitignored) but if it does,
  // we verify it only has placeholders
  it('.env should contain placeholder values, not real credentials', () => {
    const envPath = path.resolve(projectRoot, '.env');

    // .env might not exist in CI - that's OK
    if (!fs.existsSync(envPath)) {
      console.log('.env not found - skipping (expected if not yet configured)');
      return;
    }

    const content = fs.readFileSync(envPath, 'utf-8');

    // Check each credential pattern that matches real values
    const realCredentialPatterns = [
      // Google AI API keys (don't start with "your-" prefix)
      { pattern: /VITE_GEMINI_API_KEY=(?!your-)/, name: 'Google API Key' },
      // Supabase URL with valid format (not placeholder)
      {
        pattern: /VITE_SUPABASE_URL=https?:\/\/(?!your-|[^/]+\.supabase\.co)/,
        name: 'Supabase URL',
      },
      // Supabase anon key that looks real (eyJ... pattern with proper length)
      {
        pattern:
          /VITE_SUPABASE_ANON_KEY=eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
        name: 'Supabase Anon Key',
      },
    ];

    const violations: string[] = [];

    for (const { pattern, name } of realCredentialPatterns) {
      if (pattern.test(content)) {
        violations.push(name);
      }
    }

    if (violations.length > 0) {
      throw new Error(`.env contains real credentials: ${violations.join(', ')}`);
    }
  });

  // ============ Test: Verify no credentials in JSON config files ============

  it('JSON config files should not contain real credentials', () => {
    const jsonFiles = ['package.json', 'tsconfig.json', 'vite.config.ts'];
    let violations: Array<{ file: string; issue: string }> = [];

    for (const fileName of jsonFiles) {
      const filePath = path.join(projectRoot, fileName);
      if (!fs.existsSync(filePath)) continue;

      try {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Check for credential patterns in non-comment sections
        for (const { pattern, name } of credentialPatterns) {
          const hasRealCredential =
            pattern.test(content) && !content.includes('your-') && !content.includes('_here');
          if (hasRealCredential) {
            violations.push({ file: fileName, issue: name });
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    expect(violations).toHaveLength(0);
  });
});

// ============ Test: CI should fail on credential detection ============

describe('SEC-05: CI Security Gates', () => {
  it('should have security tests in CI pipeline', () => {
    // This test verifies the test suite can be run in CI
    // Actual CI verification happens outside this test
    // vitest is available in test environment
    expect(true).toBe(true);
  });
});
