# Design: Coverage Boost

## Technical Approach

Two-phase strategy: (1) **Config fix** — exclude non-app files from vitest coverage for instant ~15% global lift, (2) **Targeted tests** — add branch/function gap tests for 11 source files. Anomaly fixes for SettingsModal (0% despite 263-line test suite) and AIQuotaManager (export verified working) require investigation, not new tests. Thresholds raised to 90/90/90 **last**, after all tests pass.

## Architecture Decisions

### Decision: Coverage Exclusion Strategy

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Exclude non-app files | Hides 0% files, instant lift vs. loses visibility | **Chosen** |
| Keep non-app files in coverage | Full visibility vs. drags global ~15% | Rejected |

**Rationale**: Non-app files (eslint.config.js, vite.config.ts, vitest.config.ts, getModels.js, scripts/**, public/mockServiceWorker.js) inflate the denominator with 0% files containing no testable app behavior. Standard practice per Vitest docs.

### Decision: SettingsModal 0% Anomaly

| Hypothesis | Evidence | Verdict |
|------------|----------|---------|
| CSS import breaks V8 | SettingsModal imports `./SettingsModal.css` | Unlikely — other components import CSS fine |
| Dynamic import prevents instrumentation | `await import('../../services/ai/AIOrchestrator')` line 28 | **Most likely** |
| Test file path mismatch | Test matches include pattern | Ruled out |

**Fix approach**: Verify V8 coverage.include glob covers SettingsModal.tsx. If dynamic import is root cause, the module may not appear in V8's instrumented set. Workaround: ensure coverage.include explicitly lists `src/components/**/*.tsx` or add `coverage.include` pattern. The test already mocks AIOrchestrator — the issue is V8 not instrumenting the *source*.

### Decision: AIQuotaManager — Verified Working

Code review confirms `export class AIQuotaManager` (line 10) and `export const quotaManager` (line 82). Test imports both successfully. **No code change needed** — the spec's anomaly may have been based on stale analysis. Verify coverage tracking at implementation time.

### Decision: Config File Testing Pattern

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `vi.resetModules()` + dynamic import | True module isolation per test | **Chosen** |
| Top-level mock + single import | Simpler but can't test fallbacks | Rejected |

**Rationale**: supabase.ts and vercel.ts execute `import.meta.env` reads at module load time. To test missing env vars, we must: (1) mock `import.meta.env`, (2) call `vi.resetModules()`, (3) `await import()` the config module fresh per scenario. This is the established Vitest pattern for ESM config testing.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `vitest.config.ts` | Modify | Add 6 exclude patterns, raise thresholds to 90/90/90 |
| `src/__tests__/sanitize.test.ts` | Modify | Add validateInputLength (6) + sanitizeInput edge cases (3) |
| `src/hooks/__tests__/useCookieConsent.test.ts` | Modify | Add undefined/null branch tests (3) |
| `src/components/preview/__tests__/PreviewPanel.test.tsx` | Create | hasError state tests (3) |
| `src/__tests__/LandingPage.test.tsx` | Modify | Add PrivacyPolicyModal (2) + whitespace handleSubmit (1) |
| `src/__tests__/supabaseConfig.test.ts` | Create | Env var fallback tests (5) |
| `src/__tests__/vercelConfig.test.ts` | Create | Env var fallback tests (4) |
| `src/hooks/deploy/__tests__/useVercelDeploy.test.ts` | Modify | Add retry-empty + abort-false + non-Error wrap (3) |
| `src/hooks/backend/oauth/__tests__/useSupabaseOAuth.test.ts` | Modify | Add INITIAL_SESSION null + default cases (3) |
| `src/components/common/__tests__/TopBar.test.tsx` | Modify | Add status badge variants + settings button (6) |
| `src/__tests__/appErrorBoundary.test.tsx` | Modify | Add custom fallback + handleReset + non-PROD log (3) |
| `src/services/deploy/__tests__/vercelApi.test.ts` | Modify | Add CANCELED + poll non-ok + json parse failure (3) |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | sanitize.validateInputLength | Pure function tests, no mocks |
| Unit | config fallbacks | vi.resetModules + dynamic import per scenario |
| Hook | useCookieConsent undefined branch | renderHook with explicit undefined/null args |
| Component | PreviewPanel hasError | render + iframe onError simulation |
| Component | LandingPage PrivacyPolicyModal | render + click handler + modal visibility |
| Component | TopBar status badges | render with state variants, query DOM |
| Component | AppErrorBoundary fallback/reset | Class component error trigger + click |
| Hook | useVercelDeploy retry/abort | renderHook + mock service returns |
| Hook | useSupabaseOAuth default cases | Fire mockAuthStateCallback with events |
| Unit | vercelApi CANCELED/poll error | Mock fetch responses per scenario |

## Coverage Impact Estimate

| Phase | After Change | Stmts | Branches | Functions |
|-------|-------------|-------|----------|-----------|
| Baseline | — | 73% | 68% | 68% |
| Phase 1 | Exclude non-app files | ~88% | ~82% | ~82% |
| Phase 2 | SettingsModal fix | ~89% | ~83% | ~83% |
| Phase 3 | All new tests added | ~93% | ~92% | ~91% |
| Phase 4 | Thresholds 90/90/90 | PASS | PASS | PASS |

## Implementation Order

1. **vitest.config.ts** — Add exclude patterns (CB-TCG-001, CB-TCG-003). Instant global lift.
2. **SettingsModal investigation** — Verify dynamic import hypothesis, add coverage.include if needed (CB-CAF-001).
3. **AIQuotaManager verification** — Confirm coverage tracks correctly (CB-CAF-002). May be no-op.
4. **sanitize.test.ts** — Add validateInputLength + edge cases (CB-SAN-001, CB-SAN-002). High impact, zero mocks.
5. **useCookieConsent.test.ts** — Add undefined branch (CB-UCC-001). Small, fast.
6. **PreviewPanel.test.tsx** — Create new, test hasError (CB-PP-001).
7. **LandingPage.test.tsx** — Add PrivacyPolicyModal + whitespace (CB-LP-001, CB-LP-002).
8. **supabaseConfig.test.ts** — Create new, vi.resetModules pattern (CB-CFG-001).
9. **vercelConfig.test.ts** — Create new, same pattern (CB-CFG-002).
10. **useVercelDeploy.test.ts** — Add retry/abort/non-Error (CB-VD-001).
11. **useSupabaseOAuth.test.ts** — Add INITIAL_SESSION null + default cases (CB-SOA-001).
12. **TopBar.test.tsx** — Add status badge + settings (CB-TB-001).
13. **appErrorBoundary.test.tsx** — Add custom fallback + reset + non-PROD (CB-AEB-001).
14. **vercelApi.test.ts** — Add CANCELED + poll error + json failure (CB-VA-001).
15. **vitest.config.ts** — Raise thresholds to 90/90/90 (CB-TCG-002). LAST step.

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| SettingsModal dynamic import is NOT the root cause | Medium | Fallback: add `coverage.include: ['src/**/*.tsx']` to force V8 instrumentation |
| vi.resetModules leaks state between tests | Low | Use `beforeEach` + `afterEach` with `vi.resetModules()`, isolate each scenario |
| Config tests flaky due to import.meta.env timing | Medium | Set env vars BEFORE `vi.resetModules()`, import AFTER; use `await` for dynamic import |
| TopBar status badge coverage gaps remain | Low | Existing test already renders with state='idle'; add explicit 'generating'/'installing'/'running'/'error' renders |
| BuilderPage stays below 90% | High | Accepted out of scope — separate change needed |
| Global still below 90% after all tests | Low | Run `npx vitest run --coverage` after phase 3; identify remaining gaps; add targeted tests |

## Open Questions

- [ ] Confirm SettingsModal dynamic import is root cause (implementation-time investigation)
- [ ] Verify AIQuotaManager coverage tracks correctly (may be no-op)
