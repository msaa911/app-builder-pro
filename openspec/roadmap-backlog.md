# App Builder Pro — Roadmap & Backlog

**Last Updated**: 2026-04-30
**Total Archived Changes**: 24
**Tests**: 1828 passing | **Coverage**: 96%+ stmts | **tsc**: clean

---

## Completed Changes (Archived)

| # | Change Name | Status | Key Deliverable |
|---|-------------|--------|-----------------|
| 1 | supabase-mcp | COMPLETE | Supabase MCP Client |
| 2 | backend-analyzer | COMPLETE | Backend Requirements Analyzer |
| 3 | sql-schema | COMPLETE | SQL Schema Generator |
| 4 | backend-pipeline | COMPLETE | Backend Pipeline Integration |
| 5 | security-audit | COMPLETE | Security Audit |
| 6 | error-handling | COMPLETE | Error Handling System |
| 7 | test-infrastructure | COMPLETE | Test Infrastructure (90/90/90/90 thresholds) |
| 8 | real-console | COMPLETE | Real Console Output |
| 9 | integrated-file-explorer | COMPLETE | Integrated File Explorer |
| 10 | fs-watch-integration | COMPLETE | FS Watch Integration |
| 11 | file-creation-ui | COMPLETE | File Creation UI |
| 12 | file-content-preview | COMPLETE | File Content Preview (bugfix) |
| 13 | deploy-vercel | COMPLETE | Vercel 1-click Deploy |
| 14 | pre-production-hardening | COMPLETE | 5 sub-changes (api-key-storage, chat-markdown, preview-sandbox, tailwind-support, code-parsing) |
| 15 | chat-iterative-refine | COMPLETE | Iterative refinement via refineApp (24 tasks, 3 commits) |
| 16 | editor-save-to-webcontainer | COMPLETE | Manual save with dirty tracking, Ctrl+S, WC write (46 tests, 3 commits) |
| 17 | editor-run-to-webcontainer | COMPLETE | Run button → restartDev, isRunning/hasCrashed states, dev exit toast (11 tests) |
| 18 | project-persistence | COMPLETE | IndexedDB persistence, 5 projects max, auto-save 2s debounce, restore on mount, ProjectDropdown UI (90 tests, commit 37d20f5) |
| 19 | landing-page-links | COMPLETE | react-router-dom, ShowcasePage, TemplatesPage (6 templates), SignInModal, BuilderPage route-aware (54 tests across 7 files) |
| 20 | topbar-share | COMPLETE | Share button with clipboard copy, copied feedback (2s), disabled guard, toast success/error (12 tests, commit 6ae30e8) |
| 21 | file-rename | COMPLETE | File/folder rename via context menu → inline input → WC fs.rename, protected path guard, activeFile path update (13 tests, commit 755a193) |
| 22 | auth-user-accounts | COMPLETE | Supabase Auth (email/password + Google/GitHub OAuth), AuthContext, SignInModal, TopBar auth-aware, BuilderPage guard, shared supabaseClient (16 files, +1224/-100, commit 8fe99db) |
| 23 | e2e-playwright | COMPLETE | Playwright Phase 1 smoke tests (25 E2E tests, 5 spec files), crypto→FNV-1a bugfix, Chromium only |
| 24 | version-history-undo | COMPLETE | Multi-level undo with IDB snapshots, FIFO eviction (MAX=20), restore with package.json detection, cascade delete, backward-compatible undo toast (1828 tests, commit 9daa754) |

---

## Pending Features — Ordered by Priority

### 🟡 HIGH (UX incompleta — ya no bloquea E2E)

#### 1. Privacy Policy Legal Review
- **Problem**: 9 TODO comments en el texto legal del PrivacyPolicyModal
- **Impact**: Legal compliance — requiere revisión legal real, no código
- **Complexity**: Baja (pero requiere humano legal)
- **SDD Change Name**: `privacy-policy-legal`
- **Status**: ⏸️ DEFERRED — mover al FINAL, requiere revisión legal humana

### 🔧 INTENTIONALLY DEFERRED

#### D1. WebContainer Auto-Boot on Restore
- **Problem**: Restore no hace boot automático del WebContainer
- **Impact**: Usuario debe hacer click en Run manualmente después de refresh
- **Complexity**: Media
- **Reason**: By-design — WC boot es pesado (~5-10s), solo bootear cuando el usuario lo pida
- **SDD Change Name**: `wc-auto-boot-restore`

#### D2. Performance Benchmark (Save < 100ms)
- **Problem**: No hay test de benchmark para persistencia
- **Impact**: No se verificó que save < 100ms para proyectos típicos
- **Complexity**: Baja
- **Reason**: Post-launch — idb es conocido por ser rápido (<10ms), pero no está medido
- **SDD Change Name**: `persistence-perf-benchmark`

---

## Implementation Order (Updated)

```
Phase 1 — Critical E2E Flow: ✅ COMPLETE
  1.1 chat-iterative-refine → ✅ DONE
  1.2 editor-save-to-webcontainer → ✅ DONE
  1.3 editor-run-to-webcontainer → ✅ DONE

Phase 2 — Stability & UX: ✅ COMPLETE
  2.1 project-persistence → ✅ DONE
  2.2 landing-page-links → ✅ DONE

Phase 3 — Sharing & Auth: ✅ COMPLETE
3.1 topbar-share → ✅ DONE
3.2 file-deletion-rename → ✅ DONE (file-rename commit 755a193)
3.3 auth-user-accounts → ✅ DONE (commit 8fe99db)

Phase 4 — Quality of Life: ✅ COMPLETE
4.1 version-history-undo → ✅ DONE (multi-level undo, IDB snapshots, commit 9daa754)

Phase 5 — E2E Playwright: ✅ Phase 1 COMPLETE
5.1 e2e-playwright → ✅ DONE (25 smoke tests, Chromium only)
5.2 e2e-playwright-ci → ❌ TODO (CI job in deploy.yml)
5.3 e2e-playwright-auth → ❌ TODO (Phase 2: auth mocking)

Phase 6 — Compliance (último):
6.1 privacy-policy-legal → requiere revisión legal humana
```

---

## Known Technical Debt

| File | Issue | Branch Coverage | Action |
|------|-------|-----------------|--------|
| BuilderPage.tsx | 73% branches | Uncovered branches in deploy/backend features | Subir cuando bloquee una feature |
| useVercelDeploy.ts | 76% branches | Partial mock coverage | Subir cuando bloquee una feature |
| useBackendCreation.ts | 75% branches | Partial mock coverage | Subir cuando bloquee una feature |

**Policy**: Coverage como ESCUDO (protege features) no como OBJETIVO (perder el norte). Subir SOLO cuando bloquee una feature.

---

## Project Philosophy

- **Features del producto** > Deuda técnica > E2E Playwright > Coverage polishing
- **Tests PROTEGEN features, no REEMPLAZAN features**
- Si tengo 100% coverage pero deploy no funciona, tengo 100% de nada
- El flujo E2E del producto ES el objetivo principal
- Flujo E2E: Landing(prompt) → AI Generation → WebContainer boot → Preview → Code Editor → Chat changes → Backend(Supabase) → Deploy(Vercel) → URL pública
