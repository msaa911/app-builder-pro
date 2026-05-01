# Exploration: coverage-gap-fix

## Context
- **Project**: app-builder-pro
- **Problem**: Changes 1, 2, 3 have coverage gaps preventing 100%
- **Goal**: Close coverage gaps to achieve >95% real coverage

---

## Current State

### Vitest Configuration
Current config at `vitest.config.ts`:
- Uses `provider: 'v8'`
- Excludes: `node_modules/`, `src/main.tsx`, `src/vite-env.d.ts`, `*.d.ts`, `test/`
- **Missing exclusions**: Barrel files (`index.ts`), type-only files (`types.ts`)

### Test Infrastructure
- MSW handlers exist at `src/__mocks__/mcp-server.ts`
- Mock responses at `src/services/supabase/__fixtures__/mock-responses.ts`
- Existing tests follow good patterns with `beforeAll`/`afterAll` server setup

### client.ts Analysis
- File `src/services/supabase/client.ts` is 54 lines
- Provides `getSupabaseClient()` singleton and `supabase` export
- Uses `import.meta.env` - requires Vite environment
- **NOT imported anywhere in the codebase** (verified via grep)
- Could be tested OR removed as dead code

---

## Affected Areas

### CHANGE 1 - Supabase MCP (82.31%)
| File | Gap | What Needs Testing |
|------|-----|-------------------|
| `MCPClient.ts:63-68` | `data.error` branch | Mock response with `{ error: {...} }` |
| `MCPClient.ts:120` | Fallback name when all retries fail | Test max retries exhausted scenario |
| `client.ts:6-51` | NO TESTS | Either test or remove |
| `retry.ts:59-61` | `MCPAuthError` redundant check | Already handled by isRetryable |
| `retry.ts:116-119` | `withRetry_` unused function | Dead code candidate |
| `errors.ts:107-108` | `MCPTimeoutError` | Test timeout scenario |
| `errors.ts:139,141` | Default case in switch | Test unknown status code |

### CHANGE 2 - Analyzer (91.33%)
| File | Gap | What Needs Testing |
|------|-----|-------------------|
| `AIFallbackAnalyzer.ts:203-208` | Default values in mapping | Test missing fields in AI response |
| `AIFallbackAnalyzer.ts:237-238` | `?? 50` defaults | Test low confidence AI response |
| `BackendRequirementsAnalyzer.ts:150` | Pattern-only mode branch | Test confidence below threshold |
| `BackendRequirementsAnalyzer.ts:256` | Storage requirements merge | Test empty pattern result with AI |
| `confidence.ts:277-278` | `isLowConfidence` else branch | Test boundary conditions |
| `confidence.ts:304-305` | Low confidence return | Test low threshold values |

### CHANGE 3 - SQL Generator (91.66%)
| File | Gap | What Needs Testing |
|------|-----|-------------------|
| `MigrationBuilder.ts:132-138` | Unknown type catch | Test field with invalid type |
| `MigrationBuilder.ts:178-180` | `build()` function | Already tested in integration |
| `SQLGenerator.ts:97-98` | Unused config options | Dead code or needs test |
| `SQLGenerator.ts:123-125` | Unused fallback | Dead code or needs test |

---

## Approaches

### 1. Update Vitest Config (Recommended)
```ts
// Add to coverage.exclude array:
'**/index.ts',
'**/types.ts',
'**/*.stories.tsx',
'**/types/*.ts',
```
- **Pros**: Immediately excludes non-real coverage debt
- **Cons**: None - barrel files have no logic
- **Effort**: Low (2-line change)

### 2. Write Missing Tests
Need to write specific tests for:
- Error response branches (data.error, catch blocks)
- Boundary conditions (low confidence, pattern-only mode)
- Unknown types in MigrationBuilder
- Max retry exhaustion in MCPClient

### 3. Remove Dead Code
- `client.ts`: Not imported anywhere - remove or test?
- `withRetry_`: Unused function in retry.ts
- Unused config options in SQLGenerator

---

## Recommendation

### Priority Order
1. **First**: Update vitest config to exclude barrel/type files (immediate gain)
2. **Second**: Add error branch tests for MCPClient (4 tests)
3. **Third**: Add analyzer boundary tests (6 tests)
4. **Fourth**: Add MigrationBuilder unknown type test (1 test)
5. **Fifth**: Decide on client.ts - test OR remove

### Estimated Tests Needed
| Gap Area | Test Count | Complexity |
|----------|------------|------------|
| Error branches (MCP) | 4 | Medium |
| Boundary conditions (Analyzer) | 6 | Medium |
| Unknown type (MigrationBuilder) | 1 | Low |
| client.ts decision | 1-3 | Low |
| Retry dead code | 0 (remove) | - |
| **Total** | **12-14** | - |

### client.ts Recommendation
**Remove as dead code** - It's not imported anywhere in the codebase, yet shows 0% coverage. Either:
- Remove the file entirely (cleaner), OR
- Add a simple test verifying it initializes correctly with env vars

The safest approach: Test it once to verify initialization, then treat as low-priority since it's not used.

---

## Risks

1. **MSW Limitations**: Browser-based MSW may not perfectly simulate network errors
2. **Timeout Testing**: Difficult to test actual timeout without slowing tests
3. **Environment Variables**: `client.ts` depends on `import.meta.env` - needs vitest env setup

---

## Ready for Proposal

**Yes** - Enough information to proceed to SDD-propose phase with:
- Specific vitest config changes
- List of 12-14 specific tests to write
- Decision on client.ts (recommend removal)
- Clear priority order

The orchestrator should tell the user: "Ready to create change proposal with specific test additions for each coverage gap."