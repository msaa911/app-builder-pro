# Proposal: Coverage Boost

## Intent
Global test coverage sits at 73.32% statements (FAILING the 80% threshold). Two root causes: (1) non-app files contaminating coverage at 0%, and (2) source files with branch/function gaps. We need >90% across all metrics to enforce a reliable quality gate.

## Scope

### In Scope
- Exclude non-app files from coverage (build configs, scripts, MSW worker, dist/)
- Fix SettingsModal.tsx 0% anomaly (coverage tracking issue, not missing tests)
- Fix AIQuotaManager.ts export inconsistency blocking test execution
- Add missing tests: `sanitize.ts` (validateInputLength), `useCookieConsent.ts` (branch gaps), `PreviewPanel.tsx` (hasError), `LandingPage.tsx` (handleSubmit, PrivacyPolicyModal)
- Close branch gaps: `supabase.ts` (env fallbacks), `vercel.ts` (env fallbacks), `useVercelDeploy.ts`, `useSupabaseOAuth.ts`, `stackAnalyzer.ts`, `vercelApi.ts`, `AppErrorBoundary.tsx`, `TopBar.tsx`

### Out of Scope
- BuilderPage.tsx refactoring (high complexity, separate change)
- Adding new features or changing existing behavior
- Coverage for third-party dependencies
- E2E/Cucumber step_definitions coverage

## Capabilities

### New Capabilities
- `test-coverage-gating`: Coverage exclusion rules, configuration, and enforcement for non-app files

### Modified Capabilities
- `test-infrastructure`: Coverage config changes (exclude patterns, threshold adjustments)

## Approach
1. **Biggest win first**: Exclude non-app files from `vitest.config.ts` coverage — single config change lifts global ~15%
2. **Fix anomalies**: Resolve SettingsModal coverage tracking + AIQuotaManager export — zero new tests needed
3. **Low-hanging fruit**: Add missing tests for 4 simple files (sanitize, useCookieConsent, PreviewPanel, LandingPage)
4. **Branch gaps**: Test env-var fallback branches in config files + remaining hooks/services
5. **Verify**: Run `npx vitest run --coverage` — all metrics must exceed 90%

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `vitest.config.ts` | Modified | Add coverage.exclude patterns for non-app files |
| `src/services/ai/AIQuotaManager.ts` | Modified | Fix export inconsistency |
| `src/utils/sanitize.ts` | Modified | Add validateInputLength tests |
| `src/hooks/useCookieConsent.ts` | Modified | Cover missing branches |
| `src/components/preview/PreviewPanel.tsx` | Modified | Test hasError state |
| `src/pages/LandingPage.tsx` | Modified | Test handleSubmit + PrivacyPolicyModal |
| `src/config/supabase.ts` | Modified | Test env var fallbacks |
| `src/config/vercel.ts` | Modified | Test env var fallbacks |
| 6 more files (hooks/services) | Modified | Close branch gaps |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Excluding files hides real gaps | Low | Only exclude non-app files (configs, scripts, dist) |
| SettingsModal fix reveals deeper issue | Med | Investigate import chain before assuming config fix |
| BuilderPage remains under 90% | High | Accept as known gap; plan separate refactoring change |

## Rollback Plan
Revert `vitest.config.ts` exclude patterns and remove added test files. All changes are additive — no production code behavior changes.

## Dependencies
- None — this is purely test/config work

## Success Criteria
- [ ] Global statements ≥ 90%
- [ ] Global branches ≥ 90%
- [ ] Global functions ≥ 90%
- [ ] SettingsModal.tsx coverage matches existing test suite
- [ ] AIQuotaManager.ts tests execute correctly
- [ ] No production code behavior changes
