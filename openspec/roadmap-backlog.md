# App Builder Pro — Roadmap & Backlog

**Last Updated**: 2026-04-28
**Total Archived Changes**: 16
**Tests**: 1552 passing | **Coverage**: 96%+ stmts | **tsc**: clean

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

---

## Pending Features — Ordered by E2E Priority

### 🔴 CRITICAL (Flujo E2E roto sin estos)

#### 1. Code Editor Run → WebContainer Restart
- **Problem**: Botón Run es un stub UI — no reinicia el preview
- **Impact**: Los cambios no se reflejan sin recargar la página
- **Complexity**: Baja
- **Key Files**: `src/components/editor/CodeEditor.tsx`, `src/services/webcontainer/WebContainerManager.ts`
- **SDD Change Name**: `editor-run-restart`

### 🟡 MEDIUM (UX incompleta)

#### 2. Project Persistence (localStorage/IndexedDB)
- **Problem**: Refresh de página pierde todo el proyecto
- **Impact**: No hay proyecto real sin persistencia
- **Complexity**: Media
- **SDD Change Name**: `project-persistence`

#### 3. Landing Page Links Vivos
- **Problem**: Showcase, Templates, Sign In son dead links
- **Impact**: UX básica rota en la landing
- **Complexity**: Media
- **SDD Change Name**: `landing-page-links`

#### 4. TopBar Share Button
- **Problem**: Botón Share es dead UI
- **Impact**: No se puede compartir proyecto por URL
- **Complexity**: Media
- **SDD Change Name**: `topbar-share`

#### 5. Auth / User Accounts
- **Problem**: No hay autenticación ni cuentas de usuario
- **Impact**: Persistencia real y multi-usuario requieren auth
- **Complexity**: Alta
- **SDD Change Name**: `auth-user-accounts`

### 🔵 LOW (Nice to have)

#### 6. Version History / Undo
- **Problem**: Sin historial de cambios ni undo de generación
- **Impact**: Nice to have, no bloquea E2E
- **Complexity**: Alta
- **SDD Change Name**: `version-history-undo`

#### 7. File Deletion & Rename in FileExplorer
- **Problem**: Solo se pueden crear archivos, no eliminar ni renombrar
- **Impact**: UX polishing
- **Complexity**: Baja
- **SDD Change Name**: `file-deletion-rename`

#### 8. Privacy Policy (10 TODOs legales)
- **Problem**: 10 TODO comments en el texto legal
- **Impact**: Legal, no funcional
- **Complexity**: Baja
- **SDD Change Name**: `privacy-policy-legal`

---

## Implementation Order (Proposed)

```
Phase 1 — Critical E2E Flow:
1.1 chat-iterative-refine → ✅ DONE
1.2 editor-save-to-webcontainer → ✅ DONE
1.3 editor-run-restart → cierra ciclo editar→ver

Phase 2 — Stability & UX:
2.1 project-persistence → estabilidad del proyecto
2.2 landing-page-links → UX básica

Phase 3 — Sharing & Auth:
  3.1 auth-user-accounts       → base para features sociales
  3.2 topbar-share             → compartir proyectos

Phase 4 — Polish:
  4.1 file-deletion-rename     → UX del editor
  4.2 version-history-undo     → calidad de vida
  4.3 privacy-policy-legal     → compliance

E2E Playwright: configurar DESPUÉS de Phase 1 completa
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
