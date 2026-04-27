import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      // Only use text and json reporters - html/lcov fail on Windows with paths containing ':'
      // These are sufficient for CI/CD and terminal viewing
      reporter: ['text', 'json'],
      exclude: [
        'node_modules/',
        'src/main.tsx',
        'src/vite-env.d.ts',
        '**/*.d.ts',
        'test/',
        '**/index.ts',
        '**/types.ts',
        // Exclude files that cause Windows path issues with special characters
        '**/__mocks__/**',
        '**/__fixtures__/**',
        'src/vite-env.d.ts',
        // Non-app files that contaminate coverage denominator
        'eslint.config.js',
        'vite.config.ts',
        'vitest.config.ts',
        'scripts/**',
        'public/mockServiceWorker.js',
        'getModels.js',
        'dist/**',
        // Test infrastructure — not app code
        'src/__tests__/utils/**',
        'src/__tests__/e2e/**',
        // Step definitions are test infrastructure, not app code
        '**/step_definitions/**',
        // App entry point — just mounts React, not testable logic
        'src/App.tsx',
      ],
      // Clean coverage output directory before each run
      clean: true,
      // Coverage thresholds — CI fails when any metric drops below minimum
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
