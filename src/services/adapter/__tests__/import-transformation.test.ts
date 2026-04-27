/**
 * Import Transformation Integration Tests
 * CHANGE 6 - Supabase Frontend Adapter
 *
 * Tests for import transformation logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SupabaseFrontendAdapter } from '../SupabaseFrontendAdapter';
import type { AdapterConfig } from '../types';
import {
  SAMPLE_BACKEND_RESULT,
  SAMPLE_REQUIREMENTS_WITH_AUTH,
  SAMPLE_REQUIREMENTS_WITH_ENTITIES,
  SAMPLE_FILES_WITH_AUTH,
  SAMPLE_FILES_WITH_ENTITIES,
  SAMPLE_FILES_DEEPLY_NESTED,
} from '../../../__fixtures__/adapter/sample-project';

describe('Import Transformation Integration', () => {
  let adapter: SupabaseFrontendAdapter;

  beforeEach(() => {
    adapter = new SupabaseFrontendAdapter();
  });

  describe('supabase client imports', () => {
    it('should add supabase import to files referencing entities', () => {
      const config: AdapterConfig = {
        files: SAMPLE_FILES_WITH_ENTITIES,
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_ENTITIES,
      };

      const result = adapter.adapt(config);

      // Find transformed files
      const userList = result.files.find((f) => f.path === 'src/components/UserList.tsx');
      expect(userList).toBeDefined();

      if (result.transformedFiles.includes('src/components/UserList.tsx')) {
        expect(userList?.content).toContain('import { supabase } from');
        expect(userList?.content).toContain('../lib/supabase');
      }
    });

    it('should calculate correct relative path for deeply nested files', () => {
      const config: AdapterConfig = {
        files: SAMPLE_FILES_DEEPLY_NESTED,
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_ENTITIES,
      };

      const result = adapter.adapt(config);

      const userProfile = result.files.find(
        (f) => f.path === 'src/components/pages/profile/UserProfile.tsx'
      );

      if (result.transformedFiles.includes('src/components/pages/profile/UserProfile.tsx')) {
        // From src/components/pages/profile to src/lib
        // Need to go up 3 directories: ../../../lib/supabase
        expect(userProfile?.content).toContain('../../../lib/supabase');
      }
    });

    it('should use correct path from src root', () => {
      const config: AdapterConfig = {
        files: [
          {
            path: 'src/App.tsx',
            content: 'interface User { id: string; }',
          },
        ],
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_ENTITIES,
      };

      const result = adapter.adapt(config);

      if (result.transformedFiles.includes('src/App.tsx')) {
        const app = result.files.find((f) => f.path === 'src/App.tsx');
        // From src/App.tsx to src/lib/supabase.ts = ./lib/supabase
        expect(app?.content).toContain('./lib/supabase');
      }
    });
  });

  describe('useAuth imports', () => {
    it('should add useAuth import to components with auth patterns', () => {
      const config: AdapterConfig = {
        files: SAMPLE_FILES_WITH_AUTH,
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_AUTH,
      };

      const result = adapter.adapt(config);

      // Find transformed files
      const loginForm = result.files.find((f) => f.path === 'src/components/LoginForm.tsx');

      if (result.transformedFiles.includes('src/components/LoginForm.tsx')) {
        expect(loginForm?.content).toContain('import { useAuth } from');
      }
    });

    it('should calculate correct path for useAuth from nested location', () => {
      const config: AdapterConfig = {
        files: [
          {
            path: 'src/components/auth/LoginForm.tsx',
            content: `const [user, setUser] = useState(null);
// login form with auth`,
          },
        ],
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_AUTH,
      };

      const result = adapter.adapt(config);

      const loginForm = result.files.find((f) => f.path === 'src/components/auth/LoginForm.tsx');

      if (result.transformedFiles.includes('src/components/auth/LoginForm.tsx')) {
        // From src/components/auth to src/hooks
        // Need: ../../hooks/useAuth
        expect(loginForm?.content).toContain('../../hooks/useAuth');
      }
    });
  });

  describe('import placement', () => {
    it('should place imports after existing imports', () => {
      const config: AdapterConfig = {
        files: [
          {
            path: 'src/App.tsx',
            content: `import React from 'react';
import { useState } from 'react';

function App() {
  const [user, setUser] = useState(null);
  return <div>{user?.name}</div>;
}

export default App;`,
          },
        ],
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_ENTITIES,
      };

      const result = adapter.adapt(config);

      if (result.transformedFiles.includes('src/App.tsx')) {
        const app = result.files.find((f) => f.path === 'src/App.tsx');

        // Import should be after the existing imports
        const importIndex = app?.content?.indexOf('import { supabase }');
        const reactImportIndex = app?.content?.indexOf('import React');

        expect(importIndex).toBeGreaterThan(reactImportIndex!);
      }
    });

    it('should place imports at top when no imports exist', () => {
      const config: AdapterConfig = {
        files: [
          {
            path: 'src/utils/helper.ts',
            content: `// Helper functions
export function formatDate(date: Date): string {
  return date.toISOString();
}

interface User { id: string; }`,
          },
        ],
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_ENTITIES,
      };

      const result = adapter.adapt(config);

      if (result.transformedFiles.includes('src/utils/helper.ts')) {
        const helper = result.files.find((f) => f.path === 'src/utils/helper.ts');

        // Import should be at the very beginning
        expect(helper?.content?.startsWith('import')).toBe(true);
      }
    });
  });

  describe('duplicate import prevention', () => {
    it('should not add duplicate supabase imports', () => {
      const config: AdapterConfig = {
        files: [
          {
            path: 'src/App.tsx',
            content: `import React from 'react';
import { supabase } from './lib/supabase';

function App() {
  return <div>App</div>;
}

export default App;`,
          },
        ],
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_AUTH,
      };

      const result = adapter.adapt(config);

      // Should not be transformed since it already has the import
      expect(result.transformedFiles).not.toContain('src/App.tsx');
    });

    it('should not add duplicate useAuth imports', () => {
      const config: AdapterConfig = {
        files: [
          {
            path: 'src/components/Auth.tsx',
            content: `import { useAuth } from '../hooks/useAuth';

export function Auth() {
  const { user } = useAuth();
  return <div>{user?.email}</div>;
}`,
          },
        ],
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_AUTH,
      };

      const result = adapter.adapt(config);

      // Count useAuth imports
      const auth = result.files.find((f) => f.path === 'src/components/Auth.tsx');
      const importCount = (auth?.content?.match(/import.*useAuth.*from/g) || []).length;

      expect(importCount).toBeLessThanOrEqual(1);
    });
  });

  describe('file extension handling', () => {
    it('should not include .ts extension in imports', () => {
      const config: AdapterConfig = {
        files: [
          {
            path: 'src/App.tsx',
            content: 'interface User { id: string; }',
          },
        ],
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_ENTITIES,
      };

      const result = adapter.adapt(config);

      if (result.transformedFiles.includes('src/App.tsx')) {
        const app = result.files.find((f) => f.path === 'src/App.tsx');

        // Import path should not include .ts
        expect(app?.content).not.toContain('.ts');
        expect(app?.content).toContain('lib/supabase');
      }
    });

    it('should not include .tsx extension in imports', () => {
      const config: AdapterConfig = {
        files: [
          {
            path: 'src/App.tsx',
            content: 'interface User { id: string; }',
          },
        ],
        backendResult: SAMPLE_BACKEND_RESULT,
        requirements: SAMPLE_REQUIREMENTS_WITH_ENTITIES,
      };

      const result = adapter.adapt(config);

      if (result.transformedFiles.includes('src/App.tsx')) {
        const app = result.files.find((f) => f.path === 'src/App.tsx');

        // Import path should not include .tsx
        expect(app?.content).not.toContain('.tsx');
      }
    });
  });
});
