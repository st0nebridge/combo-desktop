# Desk Tray Tests

> TICP-Compliant Test Suite Documentation

This directory contains tests for the Desk Tray application, organized according to MSP (Modular Structure Protocol) and TICP (Test Iteration & Coverage Protocol) requirements.

## Compliance Status

- **MSP Version:** 1.0
- **TICP Version:** 1.0
- **Last Verified:** 2025-11-28

## Test Structure

Tests are organized to mirror the MSP module hierarchy:

```
tests/
├── cli/                          # CLI module tests (MSP: cli/*)
│   ├── modules/                  # Individual CLI module tests
│   │   ├── help-cli.test.js      # OBJ-005
│   │   ├── instance-cli.test.js  # OBJ-005, OBJ-001
│   │   ├── profile-cli.test.js   # OBJ-005, OBJ-003
│   │   └── provider-cli.test.js  # OBJ-005, OBJ-006
│   ├── cli-registry.test.js      # OBJ-005
│   ├── cli-index.test.js         # OBJ-005
│   ├── test-runner.js            # CLI test runner
│   └── test-utils.js             # Test utilities
├── services/                     # Service tests (MSP: services/*)
│   ├── app.manager.test.js       # OBJ-001
│   ├── instance-manager.test.js  # OBJ-001
│   ├── profile.manager.test.js   # OBJ-003
│   ├── tray.service.test.js      # OBJ-004
│   └── window.service.test.js    # OBJ-002
├── utils/                        # Utility tests (MSP: shared/*)
│   ├── error-recovery.test.js    # OBJ-007
│   └── transaction.test.js       # OBJ-008
├── integration/                  # Integration tests
│   ├── theme-integration.test.js
│   └── window-show-behavior.test.js
├── fixtures/                     # Test fixtures
├── electron-mock.js              # Electron module mocks
└── README.md                     # This file
```

## Running Tests

### TICP Commands (Section 11)

```bash
# Run all tests with coverage (CI mode)
npm test

# Watch mode for TDD
npm run test:watch

# Coverage report
npm run test:coverage

# Run only changed tests
npm run test:changed

# Full validation (lint + test + coverage)
npm run validate
```

### Module-specific Tests

```bash
# CLI tests
npm run test:cli

# Service tests
npm run test:services

# Utility tests
npm run test:utils

# Integration tests
npm run test:integration
```

## Coverage Thresholds

Per TICP Section 2:

| Metric | Global | Critical Modules |
|--------|--------|------------------|
| Statements | ≥ 85% | ≥ 90% |
| Branches | ≥ 70% | ≥ 80% |
| Functions | ≥ 85% | ≥ 90% |
| Lines | ≥ 85% | ≥ 90% |

**Critical Modules:**
- `src/services/*.js`
- `src/utils/*.js`

## Test Utilities

The `test-utils.js` file provides common utilities:

- `executeCliCommand(args, options)`: Execute CLI command
- `assertOutputContains(args, expectedOutput)`: Assert output content
- `assertExitCode(args, expectedExitCode)`: Assert exit code
- `mockService(modulePath, mockImplementation)`: Mock dependencies

## Writing Tests

### TDD Workflow (TICP Section 1)

1. Write failing test first (Red)
2. Implement minimal code to pass (Green)
3. Refactor while maintaining green (Refactor)

### Test Template

```javascript
/**
 * @file Module Name Tests
 * @module tests/layer/module.test
 * @objectives OBJ-XXX, OBJ-YYY
 */

const assert = require('assert');

describe('ModuleName', () => {
    // Link to MSP module
    const MODULE = 'path/to/module';
    
    describe('featureName', () => {
        test('should handle success case [OBJ-XXX]', () => {
            // Arrange
            // Act
            // Assert
        });
        
        test('should handle failure case [OBJ-XXX]', () => {
            // Arrange
            // Act
            // Assert
        });
    });
});
```

### Anti-Patterns to Avoid (TICP Section 12)

1. ❌ Removing tests to pass CI
2. ❌ Tests without objective traceability
3. ❌ Global state between tests
4. ❌ Snapshot-only assertions
5. ❌ Mock-only tests (must test real code)

## Test Objective Traceability

| Objective | Description | Test Files |
|-----------|-------------|------------|
| OBJ-001 | Instance lifecycle | `instance-manager.test.js`, `app.manager.test.js` |
| OBJ-002 | Window management | `window.service.test.js` |
| OBJ-003 | Profile isolation | `profile.manager.test.js`, `profile-cli.test.js` |
| OBJ-004 | Tray behavior | `tray.service.test.js`, `theme-integration.test.js` |
| OBJ-005 | CLI parsing | `cli/*.test.js` |
| OBJ-006 | Provider init | `provider-cli.test.js` |
| OBJ-007 | Error recovery | `error-recovery.test.js` |
| OBJ-008 | Transactions | `transaction.test.js` |

## Related Documentation

- [Test Charter](../docs/TEST_CHARTER.md) - Full test strategy
- [Coverage Map](../docs/COVERAGE_MAP.md) - Module coverage matrix
- [Waivers](../quality/waivers/README.md) - Coverage waiver process