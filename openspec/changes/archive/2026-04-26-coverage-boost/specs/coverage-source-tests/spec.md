# Delta Spec: coverage-source-tests

## Purpose
Specifications for new tests required to close branch/function gaps in low-coverage source files.

## ADDED Requirements

### Requirement: CB-SAN-001 validateInputLength Function Tests
The test suite SHALL cover the `validateInputLength` function in `src/utils/sanitize.ts` which currently has zero test coverage.

#### Scenario: Valid input within default limit
- GIVEN a string with length ≤ 10000
- WHEN `validateInputLength(input)` is called
- THEN it SHALL return `true`

#### Scenario: Input exceeds default limit
- GIVEN a string with length > 10000
- WHEN `validateInputLength(input)` is called
- THEN it SHALL return `false`

#### Scenario: Input within custom limit
- GIVEN a string with length 50 and `maxLength=100`
- WHEN `validateInputLength(input, 100)` is called
- THEN it SHALL return `true`

#### Scenario: Input exceeds custom limit
- GIVEN a string with length 150 and `maxLength=100`
- WHEN `validateInputLength(input, 100)` is called
- THEN it SHALL return `false`

#### Scenario: Non-string input rejected
- GIVEN a non-string value (e.g., `123` as number)
- WHEN `validateInputLength(input)` is called
- THEN it SHALL return `false` (typeof check on line 56)

#### Scenario: Empty string is valid
- GIVEN an empty string `""`
- WHEN `validateInputLength("")` is called
- THEN it SHALL return `true`

### Requirement: CB-SAN-002 sanitizeInput Edge Cases
The test suite SHALL cover uncovered branches in `sanitizeInput` for falsy/empty input and null byte removal.

#### Scenario: Empty string input returns empty string
- GIVEN an empty string `""`
- WHEN `sanitizeInput("")` is called
- THEN it SHALL return `""` (early return on line 30-31)

#### Scenario: Non-string input returns empty string
- GIVEN a non-string falsy value (e.g., `null`, `0`, `undefined`)
- WHEN `sanitizeInput(input)` is called
- THEN it SHALL return `""` (line 30-31 guard clause)

#### Scenario: Null bytes removed from input
- GIVEN a string containing null bytes `"\0malicious\0"`
- WHEN `sanitizeInput(input)` is called
- THEN the result SHALL NOT contain null bytes (line 38 regex branch)

### Requirement: CB-UCC-001 useCookieConsent Branch Coverage
The test suite SHALL cover the `externalConsent !== undefined` branch (line 36) for the `undefined` value case, distinguishing "not provided" from "explicitly null".

#### Scenario: Hook called without externalConsent (undefined)
- GIVEN `useCookieConsent()` called with no argument
- WHEN the hook initializes
- THEN `externalConsent` is `undefined` (not provided)
- AND the hook SHALL call `getConsent()` to load from storage (line 36-37 false branch → line 40)

#### Scenario: Hook called with explicit undefined
- GIVEN `useCookieConsent(undefined)` called
- WHEN the hook initializes
- THEN `externalConsent` is `undefined` (explicitly passed)
- AND the hook SHALL call `getConsent()` to load from storage

#### Scenario: Hook called with explicit null
- GIVEN `useCookieConsent(null)` called
- WHEN the hook initializes
- THEN `externalConsent !== undefined` is `true` (line 36-37 true branch)
- AND the hook SHALL NOT call `getConsent()` — uses null directly

### Requirement: CB-PP-001 PreviewPanel hasError State
The test suite SHALL cover the `hasError` state branch in `PreviewPanel.tsx` (lines 59-63, 71).

#### Scenario: hasError=true shows error view with retry button
- GIVEN PreviewPanel with `state="running"` and `url="http://localhost:3000"`
- WHEN the iframe `onError` callback fires (setting `hasError=true`)
- THEN the component SHALL render the error view with "Unable to load preview" text
- AND a "Retry" button SHALL be present

#### Scenario: Retry button clears hasError state
- GIVEN PreviewPanel with `hasError=true` showing the error view
- WHEN the "Retry" button is clicked
- THEN `hasError` SHALL be set to `false`
- AND the iframe SHALL be rendered again with the original URL

#### Scenario: hasError=false shows iframe in running state
- GIVEN PreviewPanel with `state="running"`, `url="http://localhost:3000"`, and `hasError=false`
- THEN the iframe SHALL be rendered with `src="http://localhost:3000"`

### Requirement: CB-LP-001 LandingPage PrivacyPolicyModal
The test suite SHALL cover the PrivacyPolicyModal integration in `LandingPage.tsx` (line 144, 150).

#### Scenario: Privacy Policy button opens modal
- GIVEN LandingPage is rendered
- WHEN the "Privacy Policy" button in the footer is clicked
- THEN `isPrivacyOpen` state SHALL be `true`
- AND the PrivacyPolicyModal SHALL be rendered (visible)

#### Scenario: PrivacyPolicyModal onClose closes modal
- GIVEN LandingPage with PrivacyPolicyModal open
- WHEN the modal's `onClose` callback is invoked
- THEN `isPrivacyOpen` SHALL be `false`
- AND the PrivacyPolicyModal SHALL NOT be rendered

### Requirement: CB-LP-002 LandingPage handleSubmit with Whitespace-Only Input
The test suite SHALL cover the `prompt.trim()` guard in `handleSubmit` (line 27).

#### Scenario: Whitespace-only prompt does not trigger build
- GIVEN LandingPage with prompt input containing only spaces `"   "`
- WHEN the form is submitted
- THEN `onStartBuild` SHALL NOT be called (line 27: `if (prompt.trim())` is false)

### Requirement: CB-CFG-001 Supabase Config Env Var Fallbacks
The test suite SHALL cover the environment variable fallback branches in `src/config/supabase.ts` (lines 15-18, 28-32, 54, 56).

#### Scenario: Missing VITE_SUPABASE_OAUTH_CLIENT_ID returns empty string
- GIVEN `import.meta.env.VITE_SUPABASE_OAUTH_CLIENT_ID` is undefined
- WHEN `supabaseOAuthConfig` is loaded
- THEN `clientId` SHALL be `""` (line 17)
- AND `logWarnSafe` SHALL be called with a warning message

#### Scenario: Present VITE_SUPABASE_OAUTH_CLIENT_ID returns value
- GIVEN `import.meta.env.VITE_SUPABASE_OAUTH_CLIENT_ID` is set to `"my-client-id"`
- WHEN `supabaseOAuthConfig` is loaded
- THEN `clientId` SHALL be `"my-client-id"` (line 19)

#### Scenario: Missing VITE_SUPABASE_REDIRECT_URI falls back to default
- GIVEN `import.meta.env.VITE_SUPABASE_REDIRECT_URI` is undefined
- WHEN `supabaseOAuthConfig` is loaded
- THEN `redirectUri` SHALL be `window.location.origin + '/oauth/callback'` (line 30)
- AND `logWarnSafe` SHALL be called

#### Scenario: Missing VITE_SUPABASE_URL returns empty string
- GIVEN `import.meta.env.VITE_SUPABASE_URL` is undefined
- WHEN `supabaseConfig` is loaded
- THEN `apiUrl` SHALL be `""` (line 54 `||` fallback)

#### Scenario: Missing VITE_SUPABASE_ANON_KEY returns empty string
- GIVEN `import.meta.env.VITE_SUPABASE_ANON_KEY` is undefined
- WHEN `supabaseConfig` is loaded
- THEN `anonKey` SHALL be `""` (line 56 `||` fallback)

### Requirement: CB-CFG-002 Vercel Config Env Var Fallbacks
The test suite SHALL cover the environment variable fallback branches in `src/config/vercel.ts` (lines 18-25, 34-41).

#### Scenario: Missing VITE_VERCEL_CLIENT_ID returns empty string
- GIVEN `import.meta.env.VITE_VERCEL_CLIENT_ID` is undefined
- WHEN `vercelOAuthConfig` is loaded
- THEN `clientId` SHALL be `""` (line 22)
- AND `logWarnSafe` SHALL be called

#### Scenario: Present VITE_VERCEL_CLIENT_ID returns value
- GIVEN `import.meta.env.VITE_VERCEL_CLIENT_ID` is set to `"vercel-client-123"`
- WHEN `vercelOAuthConfig` is loaded
- THEN `clientId` SHALL be `"vercel-client-123"`

#### Scenario: Missing VITE_VERCEL_REDIRECT_URI falls back to default
- GIVEN `import.meta.env.VITE_VERCEL_REDIRECT_URI` is undefined
- WHEN `vercelOAuthConfig` is loaded
- THEN `redirectUri` SHALL be `window.location.origin + '/oauth/vercel/callback'` (line 39)
- AND `logWarnSafe` SHALL be called

#### Scenario: Present VITE_VERCEL_REDIRECT_URI returns value
- GIVEN `import.meta.env.VITE_VERCEL_REDIRECT_URI` is set to `"https://custom.callback"`
- WHEN `vercelOAuthConfig` is loaded
- THEN `redirectUri` SHALL be `"https://custom.callback"`

### Requirement: CB-VD-001 useVercelDeploy Branch Gaps
The test suite SHALL cover uncovered branches in `useVercelDeploy.ts`: `retry()` returning false when no stored files (line 176-181), and `abort()` returning false when not deploying (line 200-209).

#### Scenario: Retry returns false when stage is ERROR but no stored files
- GIVEN useVercelDeploy hook in ERROR stage with `lastFilesRef.current` empty
- WHEN `retry()` is called
- THEN it SHALL return `false` (line 176 branch: `length === 0`)

#### Scenario: Abort returns false when not deploying
- GIVEN useVercelDeploy hook with `isDeploying=false`
- WHEN `abort()` is called
- THEN it SHALL return `false` (line 200-208)

#### Scenario: File preparation error wraps non-Error thrown values
- GIVEN `prepareFiles` throws a non-Error value (string)
- WHEN `deploy()` is called
- THEN error message SHALL contain "File preparation failed: Unknown error" (line 113-116)

### Requirement: CB-SOA-001 useSupabaseOAuth Branch Gaps
The test suite SHALL cover the uncovered `handleAuthEvent` branches: `INITIAL_SESSION` with no token (line 106-108), and the `default` case branches (lines 131-149).

#### Scenario: INITIAL_SESSION with no session sets idle state
- GIVEN an `INITIAL_SESSION` event with `session=null`
- WHEN `handleAuthEvent` processes the event
- THEN status SHALL be `'idle'`
- AND `isAuthenticated` SHALL be `false`

#### Scenario: Default event with session maintains authenticated
- GIVEN an unrecognized event (e.g., `'PASSWORD_RECOVERY'`) with a valid session
- WHEN `handleAuthEvent` processes the event
- THEN status SHALL be `'authenticated'` (line 134-136)
- AND `isAuthenticated` SHALL be `true`

#### Scenario: Default event without session and not INITIAL_SESSION redirects
- GIVEN an unrecognized event (e.g., `'MFA_CHALLENGE_VERIFIED'`) with `session=null`
- WHEN `handleAuthEvent` processes the event
- THEN `clearLegacySessionStorage()` SHALL be called (line 139)
- AND `window.location.href` SHALL be set to `window.location.origin` (line 144)

### Requirement: CB-TB-001 TopBar Statement Gaps
The test suite SHALL cover uncovered statement paths in `TopBar.tsx`: all BuilderState variants for the status badge (line 80-98), and the Share/Publish App buttons.

#### Scenario: Status badge shows "Generating Code" when state is generating
- GIVEN TopBar with `state="generating"`
- WHEN rendered
- THEN a status badge SHALL be visible with text "Generating Code"
- AND the loader-dots animation SHALL be present (line 82-88)

#### Scenario: Status badge shows "Installing Deps" when state is installing
- GIVEN TopBar with `state="installing"`
- WHEN rendered
- THEN a status badge SHALL be visible with text "Installing Deps"

#### Scenario: Status badge shows "App Running" when state is running
- GIVEN TopBar with `state="running"`
- WHEN rendered
- THEN a status badge SHALL be visible with text "App Running"

#### Scenario: Status badge shows "Error" when state is error
- GIVEN TopBar with `state="error"`
- WHEN rendered
- THEN a status badge SHALL be visible with text "Error"

#### Scenario: No status badge when state is idle
- GIVEN TopBar with `state="idle"`
- WHEN rendered
- THEN no status badge SHALL be present (line 80: `state !== 'idle'` is false)

#### Scenario: Settings button calls onOpenSettings
- GIVEN TopBar with `onOpenSettings` callback
- WHEN the settings icon button is clicked
- THEN `onOpenSettings` SHALL be called

### Requirement: CB-AEB-001 AppErrorBoundary Branch Gaps
The test suite SHALL cover the uncovered branches in `AppErrorBoundary.tsx`: custom `fallback` prop (line 37-39), `componentDidCatch` non-PROD branch (line 26-28), and `handleReset` recovery (line 31-33).

#### Scenario: Custom fallback rendered when error occurs
- GIVEN AppErrorBoundary with `fallback={<div>Custom Error</div>}`
- WHEN a child component throws an error
- THEN the custom fallback SHALL be rendered instead of the default error UI

#### Scenario: handleReset clears error state and renders children again
- GIVEN AppErrorBoundary in error state showing error UI
- WHEN the "Try Again" button is clicked (triggering `handleReset`)
- THEN `hasError` SHALL be `false`
- AND children SHALL be rendered again (line 74)

#### Scenario: componentDidCatch logs component stack in non-PROD
- GIVEN `import.meta.env.PROD` is `false` (development mode)
- WHEN a child component throws with an `errorInfo.componentStack`
- THEN `logWarnSafe` SHALL be called with the component stack string (line 27-28)

### Requirement: CB-VA-001 vercelApi Branch Gaps
The test suite SHALL cover uncovered branches in `vercelApi.ts`: `CANCELED` deployment state (line 118-119), poll API error response (line 100-106), and `response.json()` parse failure in createDeployment (line 52 `.catch(() => ({}))`).

#### Scenario: CANCELED deployment state throws error
- GIVEN `pollDeployment` receives a response with `state: 'CANCELED'`
- WHEN the state is checked
- THEN it SHALL throw `'Deployment was canceled'` (line 118-119)

#### Scenario: Poll API returns non-ok response
- GIVEN `pollDeployment` receives a non-ok response (e.g., 404)
- WHEN the response is checked
- THEN it SHALL throw with `'Vercel API error: 404'` (line 100-106)

#### Scenario: Error response body parse failure falls back to statusText
- GIVEN `createDeployment` receives a non-ok response where `response.json()` throws
- WHEN error data is parsed (line 52 `.catch(() => ({}))` fallback)
- THEN the error message SHALL use `response.statusText` as fallback
