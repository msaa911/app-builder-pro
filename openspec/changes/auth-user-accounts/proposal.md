# Change: auth-user-accounts

## Proposal

### Intent
Implementar autenticación de usuarios con Supabase Auth (email/password + Google + GitHub) para reemplazar el SignInModal placeholder "Coming Soon" y habilitar sesiones persistentes cross-tab.

### Scope
1. **AuthContext** — contexto global de usuario (user, session, loading, login, signup, logout)
2. **AuthColaborador** — refactorear `supabaseClient` a un shared module (`src/lib/supabase.ts`) para que Auth + Backend OAuth usen el mismo client
3. **persistSession: true** — cambiar de in-memory a localStorage para que la sesión sobreviva tab close
4. **SignInModal** — reemplazar placeholder con form real (email/password + OAuth buttons)
5. **TopBar user-avatar** — mostrar avatar real del usuario autenticado + dropdown con logout
6. **Protected routes** — BuilderPage requiere auth (redirect a Landing si no hay sesión)
7. **.env.example** — agregar `VITE_SUPABASE_OAUTH_CLIENT_ID`

### Approach
- **Un solo `supabaseClient`** — extraer de `useSupabaseOAuth.ts` a `src/lib/supabase.ts`, compartir con AuthContext
- **`@supabase/supabase-js` v2** — ya instalado (`^2.103.3`), soporta todo nativamente
- **AuthContext** provider en `main.tsx` envolviendo toda la app
- **SignInModal** como entry point — tabs: Email | Social
- **TopBar** recibe user del AuthContext en vez de avatar hardcodeado

### Risks
- **persistSession change**: `useSupabaseOAuth` fue diseñado con `persistSession: false` por seguridad (XSS). Cambiar a `true` expone tokens a localStorage — pero es el tradeoff estándar para UX de auth persistente
- **Supabase project setup**: requiere configurar providers (Google/GitHub) en Supabase Dashboard — documentar en .env.example
- **Migration path**: tests existentes mockean `useSupabaseOAuth` — necesitamos actualizar los mocks

---

## Spec

### Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| AUTH-001 | AuthContext provides user, session, loading, login, signup, logout, loginWithOAuth | MUST |
| AUTH-002 | Supabase client extracted to src/lib/supabase.ts, shared by Auth + Backend OAuth | MUST |
| AUTH-003 | persistSession: true para sesión persistente cross-tab | MUST |
| AUTH-004 | SignInModal shows email/password form with validation | MUST |
| AUTH-005 | SignInModal shows Google and GitHub OAuth buttons | MUST |
| AUTH-006 | SignInModal shows signup/login toggle (email tab) | MUST |
| AUTH-007 | TopBar shows real user avatar + name when authenticated | MUST |
| AUTH-008 | TopBar shows "Sign In" button when not authenticated | MUST |
| AUTH-009 | TopBar user dropdown with Sign Out option | MUST |
| AUTH-010 | BuilderPage redirects to Landing if not authenticated | SHOULD |
| AUTH-011 | Auth state persisted across tab close (localStorage via SDK) | MUST |
| AUTH-012 | Error handling: wrong password, email in use, OAuth failed — show in SignInModal | MUST |
| AUTH-013 | Loading state during auth operations (spinner in SignInModal) | MUST |

### Scenarios

**AUTH-001: AuthContext provides auth state**
- GIVEN the app mounts
- WHEN AuthProvider wraps the app
- THEN AuthContext provides { user, session, loading, login, signup, logout, loginWithOAuth, error }

**AUTH-004: SignInModal email/password form**
- GIVEN user clicks "Sign In" on Landing or TopBar
- WHEN SignInModal opens
- THEN shows email input + password input + submit button
- AND shows "Don't have an account? Sign up" toggle link

**AUTH-005: SignInModal OAuth buttons**
- GIVEN SignInModal is open
- THEN shows "Continue with Google" and "Continue with GitHub" buttons
- WHEN user clicks one
- THEN `loginWithOAuth('google' | 'github')` is called
- AND browser redirects to OAuth provider

**AUTH-007: TopBar authenticated state**
- GIVEN user is authenticated
- THEN TopBar shows user avatar from auth metadata + display name
- AND shows dropdown with "Sign Out" on click

**AUTH-008: TopBar unauthenticated state**
- GIVEN user is NOT authenticated
- THEN TopBar shows "Sign In" button
- WHEN clicked, opens SignInModal

**AUTH-010: Protected route**
- GIVEN user navigates to /builder without auth
- WHEN BuilderPage mounts
- THEN redirect to / with signIn modal auto-opened

**AUTH-012: Auth error display**
- GIVEN user submits wrong password
- WHEN Supabase returns "Invalid login credentials"
- THEN SignInModal shows error message below the form

---

## Design

### Architecture

```
main.tsx
  └── AuthProvider (NEW — src/contexts/AuthContext.tsx)
        └── SettingsProvider
              └── BrowserRouter
                    └── App
                          ├── LandingPage (SignInModal)
                          └── BuilderPage (requires auth)

src/lib/supabase.ts (NEW — shared client)
  ├── used by AuthContext
  └── used by useSupabaseOAuth (refactored to import from lib)

src/contexts/AuthContext.tsx (NEW)
  ├── user: User | null
  ├── session: Session | null
  ├── loading: boolean
  ├── login(email, password): Promise<void>
  ├── signup(email, password, displayName?): Promise<void>
  ├── loginWithOAuth(provider: 'google' | 'github'): Promise<void>
  ├── logout(): Promise<void>
  ├── error: string | null

src/components/common/SignInModal.tsx (REWRITE)
  ├── Tab: Email (login/signup form)
  └── Tab: Social (Google + GitHub buttons)

src/components/common/TopBar.tsx (MODIFY)
  ├── if authenticated → user avatar + dropdown (Sign Out)
  └── if !authenticated → "Sign In" button → opens SignInModal
```

### Key Decisions

1. **Single supabaseClient** — extraer a `src/lib/supabase.ts`, ambos hooks lo importan
2. **persistSession: true** — tradeoff: localStorage tokens (XSS risk) vs persistent sessions (UX). Es el default del SDK y es estándar
3. **AuthContext wrapping SettingsProvider** — auth es más fundamental que settings
4. **No database profiles table** — usamos `auth.users` metadata (avatar_url, full_name) provistos por Supabase Auth. Si necesitamos más, agregamos tabla después
5. **BuilderPage protected via redirect** — no auth guard component, simple `useEffect` + `navigate('/')` si `!user && !loading`
6. **SignInModal tabs** — Email | Social, como Slack/Discord

### File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/supabase.ts` | NEW | Shared Supabase client with persistSession: true |
| `src/contexts/AuthContext.tsx` | NEW | Global auth context with Supabase Auth |
| `src/components/common/SignInModal.tsx` | REWRITE | Real auth form (email + OAuth) |
| `src/components/common/SignInModal.css` | MODIFY | Add form styles, tabs, OAuth buttons |
| `src/hooks/backend/oauth/useSupabaseOAuth.ts` | MODIFY | Import supabaseClient from lib, remove local client |
| `src/components/common/TopBar.tsx` | MODIFY | Auth-aware avatar + Sign In/Out |
| `src/components/common/TopBar.css` | MODIFY | User dropdown styles |
| `src/pages/BuilderPage.tsx` | MODIFY | Auth guard (redirect if !user) |
| `src/pages/LandingPage.tsx` | MODIFY | Wire SignInModal with AuthContext |
| `src/main.tsx` | MODIFY | Wrap with AuthProvider |
| `.env.example` | MODIFY | Add VITE_SUPABASE_OAUTH_CLIENT_ID |

---

## Tasks

| # | Task | Depends | Files |
|---|------|---------|-------|
| T1 | Create `src/lib/supabase.ts` — shared Supabase client with `persistSession: true` | — | `src/lib/supabase.ts` |
| T2 | Create `src/contexts/AuthContext.tsx` — user, session, loading, login, signup, loginWithOAuth, logout, error | T1 | `src/contexts/AuthContext.tsx` |
| T3 | Refactor `useSupabaseOAuth.ts` — import supabaseClient from `src/lib/supabase.ts`, remove local client | T1 | `src/hooks/backend/oauth/useSupabaseOAuth.ts` |
| T4 | Wire `AuthProvider` in `main.tsx` (wrap SettingsProvider) | T2 | `src/main.tsx` |
| T5 | Rewrite `SignInModal.tsx` — email/password form + OAuth buttons + signup toggle + error display + loading | T2 | `src/components/common/SignInModal.tsx`, `src/components/common/SignInModal.css` |
| T6 | Modify `TopBar.tsx` — auth-aware: show user avatar+name when authenticated, "Sign In" when not, dropdown with logout | T2, T5 | `src/components/common/TopBar.tsx`, `src/components/common/TopBar.css` |
| T7 | Auth guard in BuilderPage — redirect to / if !user && !loading | T2 | `src/pages/BuilderPage.tsx` |
| T8 | Wire LandingPage SignInModal with AuthContext | T2, T5 | `src/pages/LandingPage.tsx` |
| T9 | Update `.env.example` with `VITE_SUPABASE_OAUTH_CLIENT_ID` | — | `.env.example` |
| T10 | AuthContext unit tests — login, signup, logout, loginWithOAuth, error states, loading | T2 | `src/contexts/__tests__/AuthContext.test.tsx` |
| T11 | SignInModal unit tests — form submission, OAuth buttons, validation, error display, toggle | T5 | `src/components/common/__tests__/SignInModal.test.tsx` |
| T12 | TopBar auth integration tests — avatar when auth, Sign In when not, logout dropdown | T6 | `src/components/common/__tests__/TopBar.test.tsx` (update) |
| T13 | BuilderPage auth guard test — redirect when !user, no redirect when user | T7 | `src/pages/__tests__/BuilderPage.auth.test.tsx` |
| T14 | Update existing test mocks — useSupabaseOAuth import path change | T3 | multiple test files |
