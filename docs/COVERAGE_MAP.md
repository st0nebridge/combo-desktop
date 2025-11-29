# Coverage Map - Desk Tray Application

> TICP-Compliant Coverage Documentation
> Last Updated: 2025-11-28

## 1. Module Coverage Matrix

This document maps MSP modules to their test coverage requirements and current status.

### 1.1 Core Modules

| MSP Module | Test File | Target | Status | Objective IDs |
|------------|-----------|--------|--------|---------------|
| `main` | N/A | Excluded | - | Entry point |
| `preload` | N/A | Excluded | - | Electron preload |

### 1.2 Services

| MSP Module | Test File | S% | B% | F% | L% | Status |
|------------|-----------|-----|-----|-----|-----|--------|
| `services/app.manager` | `app.manager.test.js` | 90 | 80 | 90 | 90 | 🟡 In Progress |
| `services/instance.manager` | `instance-manager.test.js` | 90 | 80 | 90 | 90 | 🟡 In Progress |
| `services/window.service` | `window.service.test.js` | 90 | 80 | 90 | 90 | 🟡 In Progress |
| `services/tray.service` | `tray.service.test.js` | 90 | 80 | 90 | 90 | 🟡 In Progress |
| `services/profile.manager` | `profile.manager.test.js` | 90 | 80 | 90 | 90 | 🟡 In Progress |
| `services/logging.service` | N/A | 85 | 70 | 85 | 85 | ⚪ Pending |

### 1.3 CLI Modules

| MSP Module | Test File | S% | B% | F% | L% | Status |
|------------|-----------|-----|-----|-----|-----|--------|
| `cli/registry` | `cli-registry.test.js` | 85 | 70 | 85 | 85 | ✅ Complete |
| `cli/index` | `cli-index.test.js` | 85 | 70 | 85 | 85 | ✅ Complete |
| `cli/abstract/base-cli` | N/A | 85 | 70 | 85 | 85 | ⚪ Pending |
| `cli/modules/help-cli` | `help-cli.test.js` | 85 | 70 | 85 | 85 | ✅ Complete |
| `cli/modules/instance-cli` | `instance-cli.test.js` | 85 | 70 | 85 | 85 | ✅ Complete |
| `cli/modules/profile-cli` | `profile-cli.test.js` | 85 | 70 | 85 | 85 | ✅ Complete |
| `cli/modules/provider-cli` | `provider-cli.test.js` | 85 | 70 | 85 | 85 | ✅ Complete |

### 1.4 Providers

| MSP Module | Test File | S% | B% | F% | L% | Status |
|------------|-----------|-----|-----|-----|-----|--------|
| `providers/registry` | N/A | 85 | 70 | 85 | 85 | ⚪ Pending |
| `providers/abstract/base.provider` | N/A | 85 | 70 | 85 | 85 | ⚪ Pending |
| `providers/modules/facebook` | N/A | 85 | 70 | 85 | 85 | ⚪ Pending |
| `providers/modules/whatsapp` | N/A | 85 | 70 | 85 | 85 | ⚪ Pending |

### 1.5 Shared Utilities (Critical - Elevated Thresholds)

| MSP Module | Test File | S% | B% | F% | L% | Status |
|------------|-----------|-----|-----|-----|-----|--------|
| `shared/error-recovery` | `error-recovery.test.js` | 90 | 80 | 90 | 90 | 🟡 In Progress |
| `shared/transaction` | `transaction.test.js` | 90 | 80 | 90 | 90 | 🟡 In Progress |
| `shared/icons` | N/A | 85 | 70 | 85 | 85 | ⚪ Pending |

### 1.6 Configuration

| MSP Module | Test File | S% | B% | F% | L% | Status |
|------------|-----------|-----|-----|-----|-----|--------|
| `config/app.config` | N/A | 85 | 70 | 85 | 85 | ⚪ Pending |
| `config/user-agent.config` | N/A | 85 | 70 | 85 | 85 | ⚪ Pending |

## 2. Coverage Legend

| Status | Meaning |
|--------|---------|
| ✅ Complete | Meets all coverage thresholds |
| 🟡 In Progress | Test exists but coverage needs improvement |
| ⚪ Pending | No test file exists yet |
| ❌ Failed | Below threshold, needs remediation |

## 3. Critical Path Coverage

These paths require **elevated coverage** (90/80/90/90):

### 3.1 Instance Management Flow
```
main.js → cli/index.js → instance.manager.js → window.service.js
```

**Required Tests:**
- Session registration/unregistration
- Lock acquisition/release
- IPC communication
- Process delegation

### 3.2 Provider Initialization Flow
```
cli/provider-cli.js → provider.registry.js → base.provider.js → window.service.js
```

**Required Tests:**
- Provider instantiation
- Window spawning
- Session configuration
- Event handler setup

### 3.3 Error Recovery Flow
```
Any module → error-recovery.js → transaction.js
```

**Required Tests:**
- Error categorization
- Safe execution wrapper
- Transaction rollback
- Diagnostic logging

## 4. Integration Test Coverage

| Test Suite | Modules Covered | Status |
|------------|-----------------|--------|
| `theme-integration.test.js` | tray.service, icons | ✅ |
| `window-show-behavior.test.js` | window.service, base.provider | ✅ |
| `instance-manager.integration.test.js` | instance.manager, window.service | 🟡 |

## 5. Coverage Commands

```bash
# Generate full coverage report
npm run test:coverage

# Generate HTML report
npm run test:ci
# Then open coverage/lcov-report/index.html

# Per-module coverage
npm run test:services -- --coverage
npm run test:utils -- --coverage
npm run test:cli -- --coverage
```

## 6. Gap Analysis

### 6.1 High Priority Gaps

| Module | Gap Type | Action Required |
|--------|----------|-----------------|
| `providers/*` | No tests | Create provider test suite |
| `services/logging.service` | No tests | Create logging tests |
| `config/*` | No tests | Create config validation tests |

### 6.2 Medium Priority Gaps

| Module | Gap Type | Action Required |
|--------|----------|-----------------|
| `cli/abstract/base-cli` | No tests | Create abstract class tests |
| `shared/icons` | No tests | Create icon resolution tests |

## 7. Waiver Status

No active waivers as of 2025-11-28.

## 8. Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-28 | 1.0.0 | Initial TICP-compliant coverage map |
