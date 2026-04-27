# Delta Spec: test-coverage-gating

## Purpose
Define coverage exclusion rules, configuration, and enforcement for non-app files, plus raise thresholds to 90/90/90.

## ADDED Requirements

### Requirement: CB-TCG-001 Coverage Exclusion Rules
The coverage configuration in `vitest.config.ts` SHALL exclude non-app files that contaminate global coverage metrics without representing testable application behavior.

#### Scenario: Non-app build/config files excluded
- GIVEN `vitest.config.ts` coverage.exclude array
- WHEN coverage is collected
- THEN the following files SHALL be excluded: `eslint.config.js`, `vite.config.ts`, `vitest.config.ts`, `getModels.js`

#### Scenario: Script files excluded
- GIVEN scripts in the `scripts/` directory
- WHEN coverage is collected
- THEN all files under `scripts/**` SHALL be excluded

#### Scenario: MSW worker file excluded
- GIVEN `public/mockServiceWorker.js`
- WHEN coverage is collected
- THEN `public/mockServiceWorker.js` SHALL be excluded

#### Scenario: No application source files excluded
- GIVEN a file under `src/` that is not a type definition or index barrel
- WHEN the file contains runtime logic
- THEN it SHALL NOT be excluded from coverage

### Requirement: CB-TCG-002 Coverage Thresholds at 90%
The coverage configuration SHALL enforce minimum 90% across all metrics.

#### Scenario: Statement threshold raised to 90
- GIVEN `vitest.config.ts` coverage.thresholds.statements
- WHEN the value is read
- THEN it SHALL be 90

#### Scenario: Branch threshold raised to 90
- GIVEN `vitest.config.ts` coverage.thresholds.branches
- WHEN the value is read
- THEN it SHALL be 90

#### Scenario: Function threshold raised to 90
- GIVEN `vitest.config.ts` coverage.thresholds.functions
- WHEN the value is read
- THEN it SHALL be 90

### Requirement: CB-TCG-003 Existing Exclusions Preserved
The coverage configuration SHALL preserve all existing exclusion patterns while adding new ones.

#### Scenario: Pre-existing patterns retained
- GIVEN the current exclude list contains `node_modules/`, `src/main.tsx`, `src/vite-env.d.ts`, `**/*.d.ts`, `test/`, `**/index.ts`, `**/types.ts`, `**/__mocks__/**`, `**/__fixtures__/**`
- WHEN new exclusion patterns are added
- THEN all pre-existing patterns SHALL remain in the array
