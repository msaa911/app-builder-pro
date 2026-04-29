# Delta Spec: landing-page-links

## ADDED Requirements

### LPL-001: BrowserRouter Integration
The system SHALL install `react-router-dom` and wrap `<App />` with `<BrowserRouter>` in `main.tsx`. The app MUST use `<Routes>` and `<Route>` for all page navigation. Route paths SHALL be: `/` → LandingPage, `/showcase` → ShowcasePage, `/templates` → TemplatesPage, `/builder/:projectId?` → BuilderPage. Unknown routes MUST redirect to `/`.

### LPL-002: App.tsx Route Migration
The system SHALL replace `useState<'landing' | 'builder'>` with declarative `<Routes>` in App.tsx. The `onStartBuild` callback SHALL navigate to `/builder` via `useNavigate()`. The `initialPrompt` SHALL be passed via router `location.state`.

### LPL-003: ShowcasePage — IDB Project Gallery
The system SHALL render a gallery of persisted projects from IndexedDB via `useProjectPersistence().projectList`. Each project card MUST display: `name`, `updatedAt` (relative date), `fileCount`. Clicking a project card SHALL navigate to `/builder/{projectId}`. When no projects exist, an empty state with a CTA linking to `/` MUST render.

### LPL-004: TemplatesPage — Curated Starters
The system SHALL display a static grid of curated starter templates. Each template MUST have: `id`, `name`, `description`, `prompt`. Selecting a template SHALL navigate to `/builder` with `state: { prompt: template.prompt }`. Templates are hardcoded — no IDB or API.

### LPL-005: SignInModal — Coming Soon Placeholder
The system SHALL display a modal with "Coming Soon" messaging when "Sign In" is clicked. The modal MUST be dismissible via: close button, overlay click, and Escape key. It MUST use `role="dialog"` and `aria-label="Sign In"`.

### LPL-006: Landing Nav Links — React Router Wiring
The system SHALL replace `<a href="#">Showcase</a>` with `<Link to="/showcase">` and same for Templates. The "Sign In" button SHALL open SignInModal. The logo SHALL be a `<Link to="/">`. TopBar logo in BuilderPage SHALL be a `<Link to="/">`.

### LPL-007: BuilderPage — Route-Aware Project Loading
BuilderPage SHALL accept `projectId` from route params (`/builder/:projectId`) and `initialPrompt` from `location.state`. When `projectId` is present, BuilderPage MUST call `persistence.openProject(projectId)` on mount. When `location.state.prompt` is present, BuilderPage MUST start generation with that prompt.

## REMOVED Requirements

### useState Page Switching (App.tsx)
Reason: Replaced by declarative React Router routes. `useState<'landing' | 'builder'>` and `setActivePage` are deleted.

## Non-Functional Requirements

### LPL-NFR-001: Mobile Responsiveness
ShowcasePage and TemplatesPage grids MUST collapse to single-column on viewports ≤768px.

### LPL-NFR-002: Backward Compatibility
Existing BuilderPage functionality MUST NOT break. Direct `/builder` URL without params MUST behave identically to current behavior.

### LPL-NFR-003: Accessibility
All `<Link>` elements MUST be keyboard-focusable. SignInModal MUST trap focus while open and restore focus on close.
