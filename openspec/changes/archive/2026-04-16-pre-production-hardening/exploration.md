# Exploration: pre-production-hardening

**Date**: 2026-04-16
**Project**: app-builder-pro
**Artifact Store**: openspec

---

## Current State

App Builder Pro es un clon de Lovable que permite al usuario escribir un prompt, usar Gemini API para generar código, y previsualizarlo en un WebContainer. El sistema funciona para el happy path básico (un prompt → una app generada), pero presenta **44 hallazgos de auditoría** que lo hacen inseguro, inmanejable y frágil.

### Arquitectura actual (verificada contra código fuente)

```
src/
├── App.tsx                          → Router: LandingPage | BuilderPage
├── main.tsx                         → Entry point (sin Error Boundary)
├── contexts/
│   └── SettingsContext.tsx           → API Key + Model (localStorage + env fallback)
├── pages/
│   ├── LandingPage.tsx + .css       → Hero + Settings modal
│   └── BuilderPage.tsx + .css       → God Component (5 responsabilidades)
├── services/
│   ├── ai/
│   │   ├── AIOrchestrator.ts        → Singleton, Gemini SDK, prompt injection vulnerable
│   │   ├── codeParser.ts            → Silent failure, sin validación
│   │   └── prompts.ts              → SYSTEM_PROMPT miente (dice Tailwind, no lo hay)
│   └── webcontainer/
│       ├── WebContainerManager.ts   → Singleton, non-null assertion, sin error handling
│       └── fileSystem.ts           → Path traversal vulnerable, sin validación
├── components/
│   ├── chat/ChatPanel.tsx          → Markdown sin sanitizar, files nunca mostrados
│   ├── editor/
│   │   ├── CodeEditor.tsx          → Botones Save/Run sin handlers
│   │   └── FileExplorer.tsx        → Datos mock hardcodeados
│   ├── preview/PreviewPanel.tsx    → Sin sandbox, no maneja estado 'error'
│   ├── settings/SettingsModal.tsx  → BUG: backslash escapa interpolación ${}
│   └── common/
│       ├── TopBar.tsx              → Hardcoded project name
│       └── ConsolePanel.tsx        → Logs mock, sin conexión a WebContainer
└── types/index.ts                  → Tipo inconsistente (string | Uint8Array)
```

### Flujo de datos actual (verificado)

```
Usuario → ChatPanel.onSendMessage(content)
   → BuilderPage.handleNewMessage (GOD COMPONENT: 5 responsabilidades)
     → AIOrchestrator.updateConfig() (log sensible)
     → AIOrchestrator.generateApp(prompt) (prompt injection vulnerable)
       → Gemini API (API key expuesta en bundle)
       → codeParser.parseAIResponse(text) (SILENT FAILURE)
     ← { message, files }
     → WebContainerManager.mount(tree) (non-null assertion)
     → WebContainerManager.install(undefined) (sin error handling, sin logs)
     → WebContainerManager.runDev(undefined, onReady) (sin stderr)
     ← PreviewPanel (sin sandbox, sin TailwindCSS, sin estado error)
```

---

## Verified Findings (All 44 confirmed against source code)

### CRITICAL — 10 hallazgos

| ID | Archivo | Línea | Verificado |
|----|---------|-------|------------|
| C-01 | SettingsContext.tsx | 42,50 | ✅ localStorage.getItem('app-builder-api-key') plain text |
| C-02 | AIOrchestrator.ts | 13-17,26-29 | ✅ import.meta.env.VITE_GEMINI_API_KEY en bundle |
| C-03 | BuilderPage.tsx | 36-83 | ✅ handleNewMessage: 5 responsabilidades en 50 líneas |
| C-04 | BuilderPage.tsx | 33-34 | ✅ AIOrchestrator.getInstance() hardcodeado |
| C-05 | BuilderPage.tsx | 79-82 | ✅ console.error + state='error' sin UI de error |
| C-06 | AIOrchestrator.ts | 105 | ✅ catch (error: any) |
| C-07 | WebContainerManager.ts | 27 | ✅ this.webcontainerInstance!.mount(tree) |
| C-08 | SettingsModal.tsx | 84 | ✅ Backslash en template literal: \${...} |
| C-09 | codeParser.ts | 3-51 | ✅ Retorna [] silenciosamente si parsing falla |
| C-10 | prompts.ts:3 + package.json | — | ✅ Dice Tailwind pero tailwindcss no está en deps |

### HIGH — 12 hallazgos

| ID | Archivo | Línea | Verificado |
|----|---------|-------|------------|
| H-01 | AIOrchestrator.ts | 50-53 | ✅ `User Prompt: ${prompt}` sin sanitización |
| H-02 | AIOrchestrator.ts | 21,45,65 | ✅ console.log con hasApiKey y prompt completo |
| H-03 | index.html / vite.config.ts | — | ✅ Sin CSP meta tag ni headers |
| H-04 | CodeEditor:27-34, FileExplorer:24-25, ConsolePanel:24-26, ChatPanel:47-49 | — | ✅ Botones sin handlers |
| H-05 | FileExplorer.tsx:7-17, ConsolePanel.tsx:7-14 | — | ✅ Datos mock + BuilderPage:70,73 pasa undefined |
| H-06 | SettingsContext.tsx | 60-62 | ✅ getEffectiveApiKey() lógica de negocio en Context |
| H-07 | BuilderPage.tsx | 86-90 | ✅ useEffect con handleNewMessage en deps |
| H-08 | SettingsModal.tsx | 24 | ✅ Dynamic import sin try/catch |
| H-09 | main.tsx | — | ✅ Sin Error Boundary |
| H-10 | PreviewPanel.css:34, ConsolePanel.css:78,82,86, CodeEditor.css:5 | — | ✅ Colores hardcoded |
| H-11 | prompts.ts:20-28 + AIOrchestrator.ts (refineApp) | — | ✅ REFINE_PROMPT existe pero sin flujo UI |
| H-12 | PreviewPanel.tsx | 42-69 | ✅ No maneja state==='error' |

### MEDIUM — 14 hallazgos + LOW — 8 hallazgos
(Todos verificados en auditoría anterior, sin cambios)

---

## Dependency Graph Between Fixes

### Blocking dependencies (fix A MUST come before fix B)
```
Paso 0: Instalar Vitest + Testing Library
   ↓ (habilita TDD para todos los fixes siguientes)
C-08: Fix className interpolación (1 línea, bloquea selección de modelo)
   ↓
C-10: Fix TailwindCSS (SYSTEM_PROMPT o deps) — bloquea el flujo principal
   ↓
C-09: Fix codeParser (agregar validación) — bloquea feedback de errores
   ↓
C-05: Fix error handling UI — depende de que codeParser reporte errores
   ↓
C-03 + C-04: Refactor BuilderPage → hooks — habilita testability
   ↓
C-01 + C-02: Fix API key exposure — requiere arquitectura (backend proxy o mejoras client-side)
C-07: Fix non-null assertion
C-06: Fix catch(error: any)
   ↓
H-01 a H-12: Fixes HIGH (pueden hacerse en paralelo después de CRITICALs)
   ↓
M-01 a M-14: Fixes MEDIUM
   ↓
L-01 a L-08: Fixes LOW
```

### Parallelizable groups
- **Grupo A (Quick Fixes)**: C-08, C-07, C-06, H-02, H-10, M-04 — sin dependencias entre sí
- **Grupo B (Core Pipeline)**: C-10, C-09, C-05 — secuencia estricta
- **Grupo C (Refactor)**: C-03, C-04, H-06, H-07, H-09 — arquitectura
- **Grupo D (Security)**: C-01, C-02, H-01, H-03, M-01, M-02, M-03 — seguridad
- **Grupo E (Integration)**: H-05, H-11, H-12, M-08 — conectar componentes reales

---

## Approaches

### Approach 1: "Big Bang" — Todo en un cambio

**Descripción**: Resolver los 44 hallazgos en un solo cambio `pre-production-hardening` con múltiples tareas agrupadas.

- **Pros**:
  - Un solo cambio para revisar
  - Estado consistente al final
- **Cons**:
  - Demasiado grande para revisar efectivamente
  - Alto riesgo de regresiones cruzadas
  - Difícil de hacer code review
  - Si algo falla, todo se bloquea
- **Effort**: Very High (2-3 semanas)

### Approach 2: "Phase-Gated" — Cambios secuenciales por prioridad

**Descripción**: Dividir en 4-5 cambios secuenciales, cada uno con su propio ciclo SDD completo.

```
Change 1: test-infra        → Instalar Vitest + Testing Library
Change 2: critical-pipeline → C-08, C-10, C-09, C-05 (pipeline roto)
Change 3: arch-refactor     → C-03, C-04, C-06, C-07, H-06, H-07, H-09
Change 4: security-hardening → C-01, C-02, H-01, H-03, M-01, M-02, M-03
Change 5: integration-complete → H-04, H-05, H-11, H-12, M-08 + resto
```

- **Pros**:
  - Cada cambio es revisable y testeable
  - Se puede hacer deploy incremental
  - Si un cambio tiene problemas, no bloquea los demás
  - Cada cambio tiene scope claro
- **Cons**:
  - Más overhead de procesos SDD
  - Cambios pequeños pueden parecer innecesarios solos
- **Effort**: Medium-High (1.5-2 semanas con overlap)

### Approach 3: "Waves" — Cambio único con oleadas de tareas

**Descripción**: Un solo cambio `pre-production-hardening` pero con tareas organizadas en oleadas (waves) que respetan las dependencias. Cada oleada se puede aplicar y verificar independientemente.

```
Wave 0: Test Infrastructure     (prerrequisito)
Wave 1: Quick Fixes             (C-08, C-07, C-06, H-02, H-10, M-04)
Wave 2: Core Pipeline Fix       (C-10, C-09, C-05)
Wave 3: Architecture Refactor   (C-03, C-04, H-06, H-07, H-09)
Wave 4: Security Hardening      (C-01, C-02, H-01, H-03, M-01, M-02, M-03)
Wave 5: Integration Complete    (H-04, H-05, H-11, H-12, M-08)
Wave 6: Polish                  (MEDIUMs restantes + LOWs)
```

- **Pros**:
  - Un solo proceso SDD (menos overhead)
  - Oleadas respetan dependencias
  - Cada oleada es testeable independientemente
  - Se puede pausar entre oleadas
  - El Arquitecto puede priorizar qué oleadas hacer primero
- **Cons**:
  - Cambio grande en el tracker
  - Requiere disciplina para no mezclar oleadas
- **Effort**: Medium (1-2 semanas)

---

## Testing Strategy

### Infraestructura (Paso 0)
- **Vitest** como test runner (zero-config con Vite)
- **@testing-library/react** para integration tests
- **@vitest/coverage-v8** para coverage
- **jsdom** como test environment

### Patrones de Testing por Módulo

| Módulo | Tipo | Patrón | Mocks necesarios |
|--------|------|--------|------------------|
| codeParser | Unit | Input → Output | Ninguno (función pura) |
| AIOrchestrator | Unit | Mock GoogleGenerativeAI | vitest.mock('@google/generative-ai') |
| WebContainerManager | Unit | Mock WebContainer API | vitest.mock('@webcontainer/api') |
| SettingsContext | Integration | renderHook + act | localStorage mock |
| BuilderPage hooks | Integration | renderHook + act | Mock services |
| ChatPanel | Component | @testing-library/react | Mock context provider |
| PreviewPanel | Component | @testing-library/react | Mock iframe |

### TDD Flow por Fix
1. **RED**: Escribir test que demuestre el bug (ej: test que codeParser retorna warnings cuando no puede parsear)
2. **GREEN**: Escribir código mínimo para pasar el test
3. **REFACTOR**: Limpiar manteniendo tests verdes

---

## Recommendation

**Approach 3: "Waves"** — Es el mejor balance entre estructura y pragmatismo:

1. Un solo proceso SDD = menos overhead
2. Oleadas respetan dependencias técnicas
3. Cada oleada es independientemente testeable y deployable
4. El Arquitecto puede decidir parar después de cualquier oleada
5. El TDD flow se aplica dentro de cada tarea de cada oleada

### Orden de oleadas con estimación

| Wave | Focus | Hallazgos | Archivos afectados | Estimación |
|------|-------|-----------|-------------------|------------|
| 0 | Test Infra | — | package.json, vitest.config.ts | 30 min |
| 1 | Quick Fixes | C-08, C-07, C-06, H-02, H-10, M-04 | 6 archivos | 1-2 hs |
| 2 | Core Pipeline | C-10, C-09, C-05 | 4 archivos | 2-3 hs |
| 3 | Architecture | C-03, C-04, H-06, H-07, H-09 | 5+ archivos | 4-6 hs |
| 4 | Security | C-01, C-02, H-01, H-03, M-01, M-02, M-03 | 6 archivos | 3-4 hs |
| 5 | Integration | H-04, H-05, H-11, H-12, M-08 | 6 archivos | 3-4 hs |
| 6 | Polish | M-05→M-14, L-01→L-08 | Varios | 2-3 hs |

---

## Risks

1. **C-01/C-02 (API Key exposure)**: La solución "correcta" requiere un backend proxy, que es arquitectura nueva. Una solución client-side temporal (Web Crypto API) es incompleta pero más rápida.
2. **C-10 (TailwindCSS)**: Cambiar el SYSTEM_PROMPT a "plain CSS" es rápido pero genera apps menos vistosas. Agregar Tailwind al WebContainer es más trabajo pero mejor UX.
3. **C-03 (God Component refactor)**: Refactorizar BuilderPage es riesgoso porque es el componente central. Los tests protegen contra regresiones.
4. **C-01 + M-02 (XSS + localStorage)**: Si sanitizamos Markdown (rehype-sanitize) PERO aún hay XSS via WebContainer, la API key sigue expuesta. Se necesita solución defense-in-depth.
5. **WebContainer API mocking**: La API de WebContainer es compleja de mockear. Puede requerir crear un mock factory dedicado.

---

## Ready for Proposal

**Yes** — La exploración está completa, los hallazgos están verificados, las dependencias mapeadas, y la estrategia de testing definida. Listo para pasar a la fase de Propuesta.
