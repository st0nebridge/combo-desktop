# Test Charter - Desk Tray Application

> TICP-Compliant Test Documentation
> Last Updated: 2025-11-28

## 1. Overview

This document defines the test strategy, coverage requirements, and traceability matrix for the Desk Tray application in compliance with the Test Iteration & Coverage Protocol (TICP).

## 2. Test Objectives

### 2.1 Primary Objectives

| ID | Objective | Priority | MSP Module |
|----|-----------|----------|------------|
| OBJ-001 | Verify instance lifecycle management | Critical | services/instance.manager |
| OBJ-002 | Validate window creation and management | Critical | services/window.service |
| OBJ-003 | Ensure profile isolation works correctly | High | services/profile.manager |
| OBJ-004 | Verify tray icon behavior and notifications | High | services/tray.service |
| OBJ-005 | Validate CLI argument parsing | High | cli/* |
| OBJ-006 | Ensure provider initialization | High | providers/* |
| OBJ-007 | Verify error recovery mechanisms | Medium | shared/error-recovery |
| OBJ-008 | Validate transaction rollback behavior | Medium | shared/transaction |

### 2.2 Coverage Targets

As per TICP Section 2:

| Metric | Global Target | Critical Module Target |
|--------|---------------|----------------------|
| Statements | ≥ 85% | ≥ 90% |
| Branches | ≥ 70% | ≥ 80% |
| Functions | ≥ 85% | ≥ 90% |
| Lines | ≥ 85% | ≥ 90% |

**Critical Modules:**
- `services/instance.manager.js`
- `services/window.service.js`
- `utils/error-recovery.js`
- `utils/transaction.js`

## 3. Test Suites

### 3.1 Unit Tests

Located in `./tests/` mirroring MSP module hierarchy:

```
tests/
├── cli/
│   ├── cli-registry.test.js          # OBJ-005
│   ├── cli-index.test.js             # OBJ-005
│   └── modules/
│       ├── help-cli.test.js          # OBJ-005
│       ├── instance-cli.test.js      # OBJ-005, OBJ-001
│       ├── profile-cli.test.js       # OBJ-005, OBJ-003
│       └── provider-cli.test.js      # OBJ-005, OBJ-006
├── services/
│   ├── app.manager.test.js           # OBJ-001
│   ├── instance-manager.test.js      # OBJ-001
│   ├── profile.manager.test.js       # OBJ-003
│   ├── tray.service.test.js          # OBJ-004
│   └── window.service.test.js        # OBJ-002
└── utils/
    ├── error-recovery.test.js        # OBJ-007
    └── transaction.test.js           # OBJ-008
```

### 3.2 Integration Tests

Located in `./tests/integration/`:

| Test File | Objectives | Description |
|-----------|------------|-------------|
| `theme-integration.test.js` | OBJ-004 | Theme switching and icon updates |
| `window-show-behavior.test.js` | OBJ-002 | Window visibility behaviors |

## 4. Test Types per Objective

| Objective | Unit | Integration | Contract | E2E |
|-----------|------|-------------|----------|-----|
| OBJ-001 | ✅ | ✅ | ✅ | - |
| OBJ-002 | ✅ | ✅ | - | - |
| OBJ-003 | ✅ | - | - | - |
| OBJ-004 | ✅ | ✅ | - | - |
| OBJ-005 | ✅ | - | - | - |
| OBJ-006 | ✅ | - | ✅ | - |
| OBJ-007 | ✅ | - | - | - |
| OBJ-008 | ✅ | - | - | - |

## 5. Test Case Design Guidelines

### 5.1 Required Test Cases per Module

Each MSP module MUST have tests covering:

1. **Success paths** - Normal operation scenarios
2. **Failure paths** - Error handling and recovery
3. **Boundary conditions** - Edge cases and limits
4. **Concurrency** - Race conditions where applicable
5. **Security** - Input validation and sanitization

### 5.2 Data Factory Guidelines

- Use per-module data factories over static fixtures
- Factories located in `tests/factories/`
- Each factory should generate valid and invalid data variants

## 6. Execution Commands

As per TICP Section 11:

```bash
# Run all tests
npm test

# Watch mode for TDD
npm run test:watch

# Coverage report
npm run test:coverage

# Run changed tests only
npm run test:changed

# CI mode with coverage enforcement
npm run test:ci

# Module-specific tests
npm run test:services
npm run test:utils
npm run test:cli
npm run test:integration
```

## 7. Waiver Process

Per TICP Section 9:

### 7.1 Short-term Waivers (≤2 weeks)

- Set `COVERAGE_WAIVER=true` environment variable
- Create ticket documenting reason

### 7.2 Medium-term Waivers (≤1 release)

- Create waiver document in `quality/waivers/`
- Include expiry date and remediation plan

### 7.3 Permanent Waivers

- Requires protocol change approval
- Document in `quality/waivers/permanent/`

## 8. Anti-Patterns to Avoid

Per TICP Section 12:

1. ❌ Removing/weakening tests to pass (violates PPP)
2. ❌ Tests not linked to objectives/modules
3. ❌ Global state coupling between tests
4. ❌ Snapshot over-reliance without semantic asserts
5. ❌ Delete-to-pass behavior

## 9. Compliance Verification

Run compliance check:

```bash
npm run validate
```

This runs:
1. Linting (ESLint)
2. Tests with coverage enforcement
3. Coverage threshold verification

## 10. Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2025-11-28 | 1.0.0 | System | Initial TICP-compliant charter |
