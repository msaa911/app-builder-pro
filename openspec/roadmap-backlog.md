# App Builder Pro — Roadmap & Backlog

**Last Updated**: 2026-04-29
**Total Archived Changes**: 21
**Tests**: 1761 passing | **Coverage**: 96%+ stmts | **tsc**: clean

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
| 20 | topbar-share | COMPLETE | Share button with clipboard copy, copied feedback (2s), disabled guard, toast success/error (12 tests: 7 unit + 5 integration, commit 6ae30e8) |
| 21 | file-rename | COMPLETE | File/folder rename via context menu → inline input → WC fs.rename, protected path guard, activeFile path update (13 tests: 9 unit + 4 integration, commit 755a193) |

---

## Pending Features — Ordered by E2E Priority

### 🟡 MEDIUM (UX incompleta)

#### 1. Landing Page Links Vivos
- **Problem**: Showcase, Templates, Sign In son dead links
- **Impact**: UX básica rota en la landing
- **Complexity**: Media
- **SDD Change Name**: `landing-page-links`
- **Status**: ✅ COMPLETE — All 7 phases done (react-router-dom, routes, ShowcasePage, TemplatesPage, SignInModal, BuilderPage route-aware, integration tests)

#### 2. TopBar Share Button
- **Problem**: Botón Share es dead UI
- **Impact**: No se puede compartir proyecto por URL
- **Complexity**: Media
- **SDD Change Name**: `topbar-share`
- **Status**: ✅ COMPLETE — Share button with clipboard copy, 2s copied feedback, disabled when no project, toast success/error (12 tests, commit 6ae30e8)

#### 3. Auth / User Accounts
- **Problem**: No hay autenticación ni cuentas de usuario
- **Impact**: Persistencia real y multi-usuario requieren auth
- **Complexity**: Alta
- **SDD Change Name**: `auth-user-accounts`

### 🔵 LOW (Nice to have)

#### 4. Version History / Undo
- **Problem**: Sin historial de cambios ni undo de generación
- **Impact**: Nice to have, no bloquea E2E
- **Complexity**: Alta
- **SDD Change Name**: `version-history-undo`

#### 5. File Deletion & Rename in FileExplorer
- **Problem**: Solo se pueden crear archivos, no eliminar ni renombrar
- **Impact**: UX polishing
- **Complexity**: Baja
- **SDD Change Name**: `file-deletion-rename`
- **Status**: ✅ COMPLETE — Rename implemented (FREN-001→FREN-011), Delete was already complete. Context menu → inline rename input → WC fs.rename, protected path guard, activeFile path update on rename (13 tests, commit 755a193)

#### 6. Privacy Policy (10 TODOs legales)
- **Problem**: 10 TODO comments en el texto legal
- **Impact**: Legal, no funcional
- **Complexity**: Baja
- **SDD Change Name**: `privacy-policy-legal`

### 🔧 DEFERRED (intentionally postponed)

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

## Implementation Order (Proposed)

```
Phase 1 — Critical E2E Flow:
1.1 chat-iterative-refine → ✅ DONE
1.2 editor-save-to-webcontainer → ✅ DONE
1.3 editor-run-to-webcontainer → ✅ DONE (Run → restartDev)

Phase 2 — Stability & UX:
2.1 project-persistence → ✅ DONE (IndexedDB, 5 projects, auto-save)
2.2 landing-page-links → ✅ DONE (react-router-dom, ShowcasePage, TemplatesPage, SignInModal, BuilderPage route-aware)

Phase 3 — Sharing & Auth:
3.1 topbar-share → ✅ DONE (clipboard copy + copied feedback)
3.2 auth-user-accounts → base para features sociales

Phase 4 — Polish:
4.1 file-deletion-rename → UX del editor
4.2 version-history-undo → calidad de vida
4.3 privacy-policy-legal → compliance

E2E Playwright: configurar DESPUÉS de Phase 2 completa
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
