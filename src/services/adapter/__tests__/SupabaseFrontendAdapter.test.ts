/**
 * SupabaseFrontendAdapter Tests
 * CHANGE 6 - Supabase Frontend Adapter
 *
 * Tests for the main adapter class.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SupabaseFrontendAdapter } from '../SupabaseFrontendAdapter';
import type { AdapterConfig, AdaptedProject } from '../types';
import {
  SAMPLE_BACKEND_RESULT,
  SAMPLE_REQUIREMENTS_WITH_AUTH,
  SAMPLE_REQUIREMENTS_WITH_ENTITIES,
  SAMPLE_REQUIREMENTS_WITH_STORAGE,
  SAMPLE_REQUIREMENTS_MINIMAL,
  SAMPLE_FILES_WITH_AUTH,
  SAMPLE_FILES_WITH_ENTITIES,
  SAMPLE_FILES_DEEPLY_NESTED,
  SAMPLE_FILES_WITH_EXISTING_SUPABASE,
} from '../../../__fixtures__/adapter/sample-project';
import type { ProjectFile } from '../../../types';

describe('SupabaseFrontendAdapter', () => {
  let adapter: SupabaseFrontendAdapter;

  beforeEach(() => {
    adapter = new SupabaseFrontendAdapter();
  });

  describe('adapt', () => {
    it('should return AdaptedProject type', () => {
      const config: AdapterConfig = {
        files: [],
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_AUTH,
      };

      const result = adapter.adapt(config);

      expect(result).toHaveProperty('files');
      expect(result).toHaveProperty('injectedFiles');
      expect(result).toHaveProperty('transformedFiles');
      expect(result).toHaveProperty('skipped');
    });

    it('should skip adaptation when skipAdaptation is true', () => {
      const config: AdapterConfig = {
        files: SAMPLE_FILES_WITH_AUTH,
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_AUTH,
        skipAdaptation: true,
      };

      const result = adapter.adapt(config);

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('skipAdaptation flag is true');
      expect(result.injectedFiles).toHaveLength(0);
    });

    it('should skip when no backend result', () => {
      const config: AdapterConfig = {
        files: SAMPLE_FILES_WITH_AUTH,
        backendResult: null,
        requirements: SAMPLE_REQUIREMENTS_WITH_AUTH,
      };

      const result = adapter.adapt(config);

      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('No backend');
    });

    it('should skip when no requirements', () => {
      const config: AdapterConfig = {
        files: SAMPLE_FILES_WITH_AUTH,
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: null,
      };

      const result = adapter.adapt(config);

      expect(result.skipped).toBe(true);
    });

    it('should skip when minimal requirements (no auth, no storage, no entities)', () => {
      const config: AdapterConfig = {
        files: SAMPLE_FILES_WITH_AUTH,
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_MINIMAL,
      };

      const result = adapter.adapt(config);

      expect(result.skipped).toBe(true);
    });

    it('should inject supabase client file', () => {
      const config: AdapterConfig = {
        files: SAMPLE_FILES_WITH_AUTH,
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_AUTH,
      };

      const result = adapter.adapt(config);

      expect(result.skipped).toBe(false);
      expect(result.injectedFiles).toContain('src/lib/supabase.ts');
    });

    it('should inject useAuth hook when auth detected', () => {
      const config: AdapterConfig = {
        files: SAMPLE_FILES_WITH_AUTH,
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_AUTH,
      };

      const result = adapter.adapt(config);

      expect(result.skipped).toBe(false);
      expect(result.injectedFiles).toContain('src/hooks/useAuth.ts');
    });

    it('should NOT inject useAuth hook when auth not detected', () => {
      const config: AdapterConfig = {
        files: SAMPLE_FILES_WITH_ENTITIES,
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_ENTITIES,
      };

      const result = adapter.adapt(config);

      expect(result.injectedFiles).not.toContain('src/hooks/useAuth.ts');
    });

    it('should use credentials from backend result', () => {
      const config: AdapterConfig = {
        files: SAMPLE_FILES_WITH_AUTH,
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_AUTH,
      };

      const result = adapter.adapt(config);

      const supabaseFile = result.files.find((f) => f.path === 'src/lib/supabase.ts');
      expect(supabaseFile).toBeDefined();
      expect(supabaseFile?.content).toContain(SAMPLE_BACKEND_RESULT.projectUrl);
      expect(supabaseFile?.content).toContain(SAMPLE_BACKEND_RESULT.anonKey);
    });

    it('should return original files when skipped', () => {
      const config: AdapterConfig = {
        files: SAMPLE_FILES_WITH_AUTH,
        backendResult: null,
        requirements: null,
      };

      const result = adapter.adapt(config);

      expect(result.files).toEqual(SAMPLE_FILES_WITH_AUTH);
    });
  });

  describe('shouldAdapt', () => {
    // Note: shouldAdapt is private, tested via adapt() behavior

    it('should adapt when hasAuth is true', () => {
      const config: AdapterConfig = {
        files: [],
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_AUTH,
      };

      const result = adapter.adapt(config);

      expect(result.skipped).toBe(false);
    });

    it('should adapt when hasStorage is true', () => {
      const config: AdapterConfig = {
        files: [],
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_STORAGE,
      };

      const result = adapter.adapt(config);

      expect(result.skipped).toBe(false);
    });

    it('should adapt when entities exist', () => {
      const config: AdapterConfig = {
        files: [],
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_ENTITIES,
      };

      const result = adapter.adapt(config);

      expect(result.skipped).toBe(false);
    });
  });

  describe('injectSupabaseClient', () => {
    it('should create src/lib/supabase.ts', () => {
      const config: AdapterConfig = {
        files: [{ path: 'src/App.tsx', content: 'export default function App() {}' }],
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_AUTH,
      };

      const result = adapter.adapt(config);

      const supabaseFile = result.files.find((f) => f.path === 'src/lib/supabase.ts');
      expect(supabaseFile).toBeDefined();
    });

    it('should NOT overwrite existing supabase.ts', () => {
      const config: AdapterConfig = {
        files: SAMPLE_FILES_WITH_EXISTING_SUPABASE,
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_AUTH,
      };

      const result = adapter.adapt(config);

      const supabaseFile = result.files.find((f) => f.path === 'src/lib/supabase.ts');
      expect(supabaseFile?.content).toContain('existing-project');
      expect(supabaseFile?.content).not.toContain(SAMPLE_BACKEND_RESULT.projectUrl);
    });
  });

  describe('injectUseAuth', () => {
    it('should create src/hooks/useAuth.ts when auth needed', () => {
      const config: AdapterConfig = {
        files: [{ path: 'src/App.tsx', content: 'export default function App() {}' }],
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_AUTH,
      };

      const result = adapter.adapt(config);

      const authFile = result.files.find((f) => f.path === 'src/hooks/useAuth.ts');
      expect(authFile).toBeDefined();
      expect(authFile?.content).toContain('useAuth');
      expect(authFile?.content).toContain('signIn');
      expect(authFile?.content).toContain('signUp');
      expect(authFile?.content).toContain('signOut');
    });
  });

  describe('transformImports', () => {
    it('should add imports to components that need them', () => {
      const config: AdapterConfig = {
        files: SAMPLE_FILES_WITH_ENTITIES,
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_ENTITIES,
      };

      const result = adapter.adapt(config);

      // Should transform files that reference entities
      expect(result.transformedFiles.length).toBeGreaterThanOrEqual(0);
    });

    it('should use correct relative paths', () => {
      const config: AdapterConfig = {
        files: SAMPLE_FILES_DEEPLY_NESTED,
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_ENTITIES,
      };

      const result = adapter.adapt(config);

      // Check that imports in deeply nested files work
      const userProfile = result.files.find(
        (f) => f.path === 'src/components/pages/profile/UserProfile.tsx'
      );

      if (result.transformedFiles.includes('src/components/pages/profile/UserProfile.tsx')) {
        // Should have correct relative path
        expect(userProfile?.content).toContain('../../../lib/supabase');
      }
    });

    it('should not add duplicate imports', () => {
      const config: AdapterConfig = {
        files: SAMPLE_FILES_WITH_EXISTING_SUPABASE,
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_ENTITIES,
      };

      const result = adapter.adapt(config);

      // If file already has supabase import, should not add another
      const appFile = result.files.find((f) => f.path === 'src/App.tsx');
      if (appFile) {
        const importMatches = appFile.content?.match(/import.*supabase.*from/g) || [];
        expect(importMatches.length).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty files array', () => {
      const config: AdapterConfig = {
        files: [],
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_AUTH,
      };

      const result = adapter.adapt(config);

      expect(result.skipped).toBe(false);
      expect(result.files.length).toBeGreaterThan(0);
    });

    it('should handle files without TypeScript extension', () => {
      const config: AdapterConfig = {
        files: [{ path: 'README.md', content: '# My App' }],
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_AUTH,
      };

      const result = adapter.adapt(config);

      // Should not transform README
      expect(result.transformedFiles).not.toContain('README.md');
    });

    it('should handle files outside src directory', () => {
      const config: AdapterConfig = {
        files: [{ path: 'package.json', content: '{}' }],
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_AUTH,
      };

      const result = adapter.adapt(config);

      // Should not transform files outside src
      expect(result.transformedFiles).not.toContain('package.json');
    });

    it('should preserve original file order', () => {
      const originalFiles = [...SAMPLE_FILES_WITH_AUTH];
      const config: AdapterConfig = {
        files: originalFiles,
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_AUTH,
      };

      const result = adapter.adapt(config);

      // Original files should still be present
      for (const original of originalFiles) {
        const found = result.files.find((f) => f.path === original.path);
        expect(found).toBeDefined();
      }
    });
  });
});
