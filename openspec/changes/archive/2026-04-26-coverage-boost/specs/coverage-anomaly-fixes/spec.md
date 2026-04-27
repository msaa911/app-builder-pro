# Delta Spec: coverage-anomaly-fixes

## Purpose
Fix two coverage anomalies where existing test suites don't properly map to source coverage: SettingsModal.tsx (0% despite comprehensive tests) and AIQuotaManager.ts (export inconsistency blocks test execution).

## ADDED Requirements

### Requirement: CB-CAF-001 SettingsModal Coverage Tracking
The SettingsModal.tsx module SHALL have its coverage accurately tracked by the V8 coverage provider so that the existing test suite in `src/components/settings/__tests__/SettingsModal.test.tsx` (263 lines, 17+ test cases) is reflected in coverage metrics.

#### Scenario: Dynamic import resolved for coverage
- GIVEN SettingsModal.tsx uses a dynamic import (`await import('../../services/ai/AIOrchestrator')`) in `handleTest`
- WHEN the V8 coverage provider instruments the module
- THEN the dynamic import SHALL NOT prevent the module from being included in coverage collection

#### Scenario: Test file location matches source module path
- GIVEN the test file is at `src/components/settings/__tests__/SettingsModal.test.tsx`
- AND the source is at `src/components/settings/SettingsModal.tsx`
- WHEN coverage is collected
- THEN the coverage provider SHALL associate test execution with the source module
- AND SettingsModal.tsx coverage SHALL exceed 50% statements

#### Scenario: CSS import does not break coverage
- GIVEN SettingsModal.tsx imports `./SettingsModal.css`
- WHEN the module is instrumented
- THEN the CSS import SHALL NOT cause coverage collection to skip the module

### Requirement: CB-CAF-002 AIQuotaManager Export Consistency
The `AIQuotaManager` class SHALL be consistently exported so that test files can import it directly using `import { AIQuotaManager } from '../services/ai/AIQuotaManager'`.

#### Scenario: Class export matches test import
- GIVEN `AIQuotaManager.test.ts` line 2 imports `{ AIQuotaManager }` from the module
- AND `AIQuotaManager.ts` line 10 declares `export class AIQuotaManager`
- WHEN the test file is executed
- THEN the import SHALL resolve without error
- AND the class constructor `new AIQuotaManager()` SHALL succeed

#### Scenario: Singleton export preserved
- GIVEN `AIQuotaManager.ts` line 82 exports `quotaManager` as a singleton
- WHEN a test imports `{ quotaManager }` from the module
- THEN the singleton instance SHALL be accessible
- AND `quotaManager.canMakeRequest` SHALL be a callable function
