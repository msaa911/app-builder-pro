# Tasks: Coverage Boost

## Phase 1: Coverage Config (Exclusions)

- [ ] 1.1 **[RED|CB-001]** Add test: `npx vitest run --coverage` confirms eslint.config.js, vite.config.ts, vitest.config.ts, getModels.js, scripts/**, mockServiceWorker.js appear in exclude list — `vitest.config.ts` coverage.exclude. Spec: CB-TCG-001, CB-TCG-003. File: `vitest.config.ts`. Effort: S.
- [ ] 1.2 **[GREEN|CB-002]** Add 6 exclude patterns to `vitest.config.ts` coverage.exclude: `eslint.config.js`, `vite.config.ts`, `vitest.config.ts`, `getModels.js`, `scripts/**`, `public/mockServiceWorker.js`. Preserve existing entries. Spec: CB-TCG-001, CB-TCG-003. File: `vitest.config.ts`. Deps: 1.1. Effort: S.
- [ ] 1.3 **[REFACTOR|CB-003]** Verify `npm run test:run` passes + coverage lift. Run `npx vitest run --coverage` — confirm excluded files gone from report. Spec: CB-TCG-001. Deps: 1.2. Effort: S.

## Phase 2: Anomaly Investigation

- [ ] 2.1 **[INVESTIGATE|CB-004]** Run `npx vitest run --coverage` with `--reporter=verbose` for SettingsModal. Verify dynamic import hypothesis. If SettingsModal.tsx still 0%, add `coverage.include: ['src/**/*.tsx']` to vitest.config.ts. Spec: CB-CAF-001. Files: `vitest.config.ts`, `src/components/settings/__tests__/SettingsModal.test.tsx`. Effort: M.
- [ ] 2.2 **[INVESTIGATE|CB-005]** Run coverage for AIQuotaManager. If coverage tracks correctly → no-op. If not, check export/imports. Spec: CB-CAF-002. Files: `src/__tests__/AIQuotaManager.test.ts`, `src/services/ai/AIQuotaManager.ts`. Deps: 1.3. Effort: S.

## Phase 3: Low-Hanging Fruit Tests

- [ ] 3.1 **[RED|CB-006]** Add failing tests in `src/__tests__/sanitize.test.ts`: validateInputLength (6 cases — valid, exceeds default, custom limit, custom exceeds, non-string, empty) + sanitizeInput edges (3 — empty string, non-string falsy, null bytes). Spec: CB-SAN-001, CB-SAN-002. File: `src/__tests__/sanitize.test.ts`. Effort: S.
- [ ] 3.2 **[GREEN|CB-007]** Run tests — validateInputLength already exported, just needs tests. If uncovered branches in sanitize.ts, add minimal implementation. Spec: CB-SAN-001, CB-SAN-002. File: `src/utils/sanitize.ts`. Deps: 3.1. Effort: S.
- [ ] 3.3 **[RED|CB-008]** Add failing tests in `src/hooks/__tests__/useCookieConsent.test.ts`: undefined branch (3 cases — no arg, explicit undefined, explicit null). Spec: CB-UCC-001. File: `src/hooks/__tests__/useCookieConsent.test.ts`. Effort: S.
- [ ] 3.4 **[GREEN|CB-009]** Run tests — confirm new branches covered. No implementation change expected. Spec: CB-UCC-001. File: `src/hooks/useCookieConsent.ts`. Deps: 3.3. Effort: S.

## Phase 4: Component Tests

- [ ] 4.1 **[RED|CB-010]** Create `src/components/preview/__tests__/PreviewPanel.test.tsx` with 3 failing tests: error view renders on hasError, retry button resets error, normal iframe renders without error. Spec: CB-PP-001. Effort: M.
- [ ] 4.2 **[GREEN|CB-011]** Run tests — may need to trigger iframe onError to set hasError. Spec: CB-PP-001. File: `src/components/preview/PreviewPanel.tsx`. Deps: 4.1. Effort: M.
- [ ] 4.3 **[RED|CB-012]** Add failing tests to `src/__tests__/LandingPage.test.tsx`: PrivacyPolicyModal open/close (2) + whitespace handleSubmit (1). Spec: CB-LP-001, CB-LP-002. Effort: S.
- [ ] 4.4 **[GREEN|CB-013]** Run tests — confirm modal + branch coverage. Spec: CB-LP-001, CB-LP-002. File: `src/pages/LandingPage.tsx`. Deps: 4.3. Effort: S.
- [ ] 4.5 **[RED|CB-014]** Add failing tests to `src/components/common/__tests__/TopBar.test.tsx`: status badge variants (idle/generating/installing/running/error) + settings button click (6 cases). Spec: CB-TB-001. Effort: M.
- [ ] 4.6 **[GREEN|CB-015]** Run tests — confirm TopBar branches covered. Spec: CB-TB-001. File: `src/components/common/TopBar.tsx`. Deps: 4.5. Effort: M.
- [ ] 4.7 **[RED|CB-016]** Add failing tests to `src/__tests__/appErrorBoundary.test.tsx`: custom fallback render (1), handleReset click (1), non-PROD console.error log (1). Spec: CB-AEB-001. Effort: S.
- [ ] 4.8 **[GREEN|CB-017]** Run tests — trigger error boundary via thrown child. Spec: CB-AEB-001. File: `src/components/common/AppErrorBoundary.tsx`. Deps: 4.7. Effort: S.

## Phase 5: Config Module Tests

- [ ] 5.1 **[RED|CB-018]** Create `src/__tests__/supabaseConfig.test.ts` with 5 failing tests: all vars set, missing SUPABASE_URL, missing SUPABASE_ANON_KEY, both missing, empty string vars. Use `vi.resetModules()` + dynamic import pattern. Spec: CB-CFG-001. Effort: M.
- [ ] 5.2 **[GREEN|CB-019]** Run tests — no implementation change; config reads env at load time. Spec: CB-CFG-001. File: `src/config/supabase.ts`. Deps: 5.1. Effort: S.
- [ ] 5.3 **[RED|CB-020]** Create `src/__tests__/vercelConfig.test.ts` with 4 failing tests: all vars set, missing VERCEL_TOKEN, empty string token, non-string coercion. Use `vi.resetModules()` + dynamic import. Spec: CB-CFG-002. Effort: M.
- [ ] 5.4 **[GREEN|CB-021]** Run tests — confirm fallback branches covered. Spec: CB-CFG-002. File: `src/config/vercel.ts`. Deps: 5.3. Effort: S.

## Phase 6: Hook/Service Branch Tests

- [ ] 6.1 **[RED|CB-022]** Add failing tests to `src/hooks/deploy/__tests__/useVercelDeploy.test.ts`: retry with empty deployments (1), abort returns false (1), non-Error catch wraps message (1). Spec: CB-VD-001. Effort: M.
- [ ] 6.2 **[GREEN|CB-023]** Run tests — confirm branch coverage. Spec: CB-VD-001. File: `src/hooks/deploy/useVercelDeploy.ts`. Deps: 6.1. Effort: S.
- [ ] 6.3 **[RED|CB-024]** Add failing tests to `src/hooks/backend/oauth/__tests__/useSupabaseOAuth.test.ts`: INITIAL_SESSION with null session (1), default case for unknown event (1), non-INITIAL_SESSION default (1). Spec: CB-SOA-001. Effort: M.
- [ ] 6.4 **[GREEN|CB-025]** Run tests — confirm handleAuthEvent branches. Spec: CB-SOA-001. File: `src/hooks/backend/oauth/useSupabaseOAuth.ts`. Deps: 6.3. Effort: S.
- [ ] 6.5 **[RED|CB-026]** Add failing tests to `src/services/deploy/__tests__/vercelApi.test.ts`: CANCELED status handling (1), poll non-ok response (1), json parse failure (1). Spec: CB-VA-001. Effort: M.
- [ ] 6.6 **[GREEN|CB-027]** Run tests — confirm branch coverage. Spec: CB-VA-001. File: `src/services/deploy/vercelApi.ts`. Deps: 6.5. Effort: S.

## Phase 7: Threshold Enforcement

- [ ] 7.1 **[CONFIG|CB-028]** Raise vitest.config.ts thresholds to 90/90/90 (statements/branches/functions). Run `npx vitest run --coverage` — all metrics must PASS. Spec: CB-TCG-002. File: `vitest.config.ts`. Deps: all above. Effort: S.
