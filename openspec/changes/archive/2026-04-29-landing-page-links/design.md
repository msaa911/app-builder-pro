# Design: Landing Page Links

## Technical Approach
Migrate App.tsx from `useState<'landing'|'builder'>` to react-router-dom declarative routing. Replace `<a href="#">` stubs in LandingPage nav with `<Link>` components. Add ShowcasePage (IDB project gallery), TemplatesPage (curated static templates), and SignInModal ("Coming Soon" placeholder). BuilderPage receives `initialPrompt` via `location.state` and `projectId` via `useParams()`.

## Architecture Decisions

### Decision: Router Architecture
**Choice**: BrowserRouter in main.tsx, MemoryRouter in tests
**Rationale**: BrowserRouter gives clean URLs for production. MemoryRouter in tests avoids jsdom URL limitations.

### Decision: BuilderPage Dual Entry
**Choice**: Single BuilderPage with optional `projectId` route param + optional `location.state.initialPrompt`
**Rationale**: One BuilderPage keeps all builder logic centralized. projectId from route params triggers `persistence.openProject()`. `location.state.initialPrompt` triggers `handleNewMessage()`. They're mutually exclusive — projectId wins.

### Decision: Navigation Data Transfer
**Choice**: `location.state` for prompt flow, route params for projectId
**Rationale**: `location.state` is ephemeral — prompt data doesn't belong in the URL. ProjectId is a stable identifier that belongs in the URL (bookmarkable, shareable).

### Decision: ShowcasePage Data Source
**Choice**: Reuse `useProjectPersistence().projectList` directly
**Rationale**: `useProjectPersistence` already provides `projectList`, `openProject`, and `deleteProject` — everything ShowcasePage needs.

### Decision: Logo/Home Link = OBLIGATORIO (from competitive analysis)
**Rationale**: Lovable and Base44 both have it. Without it users get trapped in internal pages.

### Decision: 6 templates in 2 categories (from competitive analysis)
**Rationale**: 4 templates looks mediocre. 6 in 2 categories of 3 looks curated and intentional.
- 🌐 Websites: Portfolio, Blog, Landing Page
- 📱 Apps: Todo App, Dashboard, Chat App

### Decision: Builder URL with replace ONLY when project exists in IDB
**Rationale**: Navigate(`/builder/${projectId}`, { replace: true }) after persistence, not prematurely.

## Data Flow

```
LandingPage
 ├─ form submit → navigate('/builder', { state: { initialPrompt } })
 ├─ <Link to="/showcase"> ShowcasePage
 │   └─ click project → navigate('/builder/:projectId')
 ├─ <Link to="/templates"> TemplatesPage
 │   └─ click template → navigate('/builder', { state: { initialPrompt } })
 └─ Sign In btn → SignInModal (local state, no navigation)

BuilderPage (/builder/:projectId?)
 ├─ params.projectId? → persistence.openProject(id) → restore state
 └─ location.state.initialPrompt? → handleNewMessage(prompt)
```

## Interfaces / Contracts

```typescript
// SignInModal
interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// BuilderPage location.state shape
interface BuilderLocationState {
  initialPrompt?: string;
}

// Template data (static, defined in TemplatesPage)
interface TemplateItem {
  id: string;
  name: string;
  description: string;
  prompt: string;
  icon: string;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | SignInModal open/close, "Coming Soon" text | Render with isOpen, click close |
| Unit | LandingPage Link navigation, form → navigate | MemoryRouter, mock useNavigate |
| Unit | ShowcasePage renders projectList, click → navigate | Mock useProjectPersistence |
| Unit | TemplatesPage renders templates, click → navigate with state | Static data |
| Integration | BuilderPage receives projectId from URL params | MemoryRouter with initialEntries |
| Migration | App routes render correct pages | MemoryRouter, verify components at each path |
