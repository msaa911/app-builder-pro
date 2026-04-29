# Proposal: Landing Page Links

## Intent
Three navigation links in LandingPage ("Showcase", "Templates", "Sign In") are dead — they point to `href="#"` or fire no action. The app navigates via `useState<'landing' | 'builder'>`, preventing URL-based navigation, deep-linking, and browser back/forward. This change makes navigation real and URL-addressable.

## Scope

### In Scope
- Install react-router-dom + wrap App in BrowserRouter
- Migrate App.tsx from `useState` to `Routes`/`Route`-based navigation (`/`, `/showcase`, `/templates`, `/builder`)
- ShowcasePage — gallery of persisted projects from IDB via useProjectPersistence
- TemplatesPage — curated static starter templates (hardcoded array)
- SignInModal — "Coming Soon" placeholder modal (no real auth)
- Wire 3 landing nav links → proper routes/components
- Landing form submit → navigate to `/builder` with prompt via router state

### Out of Scope
- TopBar Share/Publish buttons → separate change
- Real Supabase authentication → separate high-complexity change
- Community showcase (requires backend) → future
- Project sharing/collaboration → future

## Capabilities

### New Capabilities
- `app-routing`: URL-addressable page navigation with react-router-dom
- `showcase-page`: Gallery displaying user's persisted IDB projects
- `templates-page`: Curated static starter templates that pre-fill builder prompt
- `sign-in-placeholder`: "Coming Soon" modal for authentication UI slot

### Modified Capabilities
- None (no existing specs describe landing page navigation)

## Approach
1. Install `react-router-dom` (v7). Wrap `<App />` in `<BrowserRouter>` in `main.tsx`.
2. Replace `useState<'landing' | 'builder'>` in App.tsx with `<Routes>`: `/` → LandingPage, `/showcase` → ShowcasePage, `/templates` → TemplatesPage, `/builder` → BuilderPage.
3. Landing form `onStartBuild` → `navigate('/builder', { state: { prompt } })`.
4. LandingPage nav links: `<Link to="/showcase">`, `<Link to="/templates">`, Sign In button → opens SignInModal.
5. ShowcasePage uses `useProjectPersistence().projectList` to render cards.
6. TemplatesPage renders a static array of template objects.
7. SignInModal is a simple overlay: "Coming Soon" message.

## Success Criteria
- [ ] All 3 landing nav links navigate to real pages
- [ ] URL reflects current page
- [ ] Browser back/forward works
- [ ] ShowcasePage lists IDB projects; empty state when none
- [ ] TemplatesPage shows curated templates; clicking opens builder with prompt
- [ ] Sign In opens "Coming Soon" modal
- [ ] BuilderPage still works: form submit + deep link both functional
- [ ] All tests pass; tsc clean
