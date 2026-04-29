# Tasks: Landing Page Links

## Phase 1: Foundation — ✅ COMPLETE
- [x] 1.1 LPL-001: Install react-router-dom
- [x] 1.2 LPL-002: Test MemoryRouter wrapper renders children at `/`
- [x] 1.3 LPL-002: Create RouterWrapper.tsx

## Phase 2: Router Migration — ✅ COMPLETE
- [x] 2.1 LPL-003: Test App renders LandingPage at `/`, BuilderPage at `/builder`, redirects unknown to `/`
- [x] 2.2 LPL-003: Migrate App.tsx — replace useState with Routes, BrowserRouter in main.tsx
- [x] 2.3 LPL-003: REFACTOR — Remove activePage/initialPrompt state
- [x] 2.4 LPL-004: Test LandingPage Showcase/Templates links
- [x] 2.5 LPL-004: Replace `<a href="#">` with `<Link>`, useNavigate for form

### Post-Phase-2 Fixes — ✅ COMPLETE
- [x] Fix #1: LandingPage logo `<div>` → `<Link to="/" data-testid="logo-link">`
- [x] Fix #2: Removed `BuilderPageProps` + `initialPrompt` prop entirely. BuilderPageInner reads `(location.state as any)?.prompt ?? ''`
- [x] Fix #3: TopBar logo `<div>` → `<Link to="/" data-testid="logo-link">`

## Phase 3: ShowcasePage — ✅ COMPLETE
- [x] 3.1 LPL-005: Test ShowcasePage renders project cards from IDB, empty state when no projects
- [x] 3.2 LPL-005: Create ShowcasePage.tsx — projectList card grid, empty state, back link, logo link
- [x] 3.3 LPL-006: Test App route `/showcase` renders ShowcasePage (heading "My Projects")
- [x] 3.4 LPL-006: Route already in App.tsx from Phase 2

## Phase 4: TemplatesPage — ✅ COMPLETE
- [x] 4.1 LPL-007: Test `templates` data — 6 items, 2 categories
- [x] 4.2 LPL-007: Create `src/data/templates.ts` — Template type, TEMPLATE_CATEGORIES, templates array
- [x] 4.3 LPL-008: Test TemplatesPage renders 2 category sections, 6 cards, "Use Template" navigates
- [x] 4.4 LPL-008: Create TemplatesPage.tsx — category headers, card grid, Link to /builder with state
- [x] 4.5 LPL-009: Test App route `/templates` renders TemplatesPage
- [x] 4.6 LPL-009: Route already in App.tsx from Phase 2

## Phase 5: SignInModal — ✅ COMPLETE
- [x] 5.1 LPL-010: Test SignInModal renders "Coming Soon", close button, closes on click
- [x] 5.2 LPL-010: Create SignInModal.tsx
- [x] 5.3 LPL-011: Test LandingPage "Sign In" button opens SignInModal
- [x] 5.4 LPL-011: Replace Sign In button → stateful button that opens SignInModal

## Phase 6: Builder Integration — ✅ COMPLETE
- [x] 6.1 LPL-012: Test BuilderPage reads projectId from useParams() and initialPrompt from useLocation().state
- [x] 6.2 LPL-012: Update BuilderPage.tsx — useParams, useLocation, persistence.openProject, navigate replace
- [x] 6.3 REFACTOR: Add logo/home `<Link to="/">` to TopBar (DONE in Fix #3)

## Phase 7: Integration Tests — ✅ COMPLETE
- [x] Integration tests for new navigation flows
- [x] SDD Verify + Archive (ready for verify phase)
