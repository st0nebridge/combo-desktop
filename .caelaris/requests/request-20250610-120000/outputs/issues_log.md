# Combo Desktop Project Issues Log

## Issue Classification

This document provides detailed documentation of all issues identified during the comprehensive codebase analysis of the Combo Desktop project.

---

## Issue #001: Incomplete Instance Manager Implementation

**Priority**: P1 - Critical  
**Category**: Core Functionality / Stability  
**Discovery Method**: File comparison analysis  
**Status**: Identified, Action Plan Created  

### Description
The current `src/services/instance.manager.js` is a severely reduced implementation compared to its backup version (`instance.manager.js.bak`). The file header explicitly states it's a "minimal implementation to restore functionality after file corruption."

### Technical Details
- **Current File**: 432 lines of code with basic functionality
- **Backup File**: 4,396 lines with comprehensive features
- **Missing Features**:
  - Transaction management system
  - Detailed lock history tracking  
  - Robust error recovery mechanisms
  - Advanced IPC health checks
  - Comprehensive cleanup handlers
  - Integration with `error-recovery.js` utilities

### Impact Assessment
- **Severity**: High - Affects core application stability
- **Scope**: Instance management, multi-user scenarios, error handling
- **User Impact**: Potential application crashes, unreliable multi-instance behavior
- **Developer Impact**: Reduced debugging capabilities, poor error diagnostics

### Root Cause
File corruption event that required emergency restoration with minimal functionality to maintain basic operation.

### Recommended Solution
Selective restoration of functionality from backup file while maintaining current simplifications where appropriate.

### Effort Estimate
8-12 hours of development work

---

## Issue #002: Deprecated CLI Code Directory

**Priority**: P2 - High  
**Category**: Code Maintenance / Technical Debt  
**Discovery Method**: Directory structure analysis  
**Status**: Identified, Action Plan Created  

### Description
The `src/cli/old/` directory contains deprecated CLI implementations that have been superseded by the modular architecture in `src/cli/modules/`.

### Technical Details
- **Deprecated Files**:
  - `old/help-cli.js`
  - `old/instance-cli.js` 
  - `old/profile-cli.js`
  - `old/provider-cli.js`
- **Modern Equivalents**: Available in `src/cli/modules/` with improved architecture
- **Architecture Differences**: Old versions are standalone, new versions extend `BaseCLI` class

### Impact Assessment
- **Severity**: Medium - Doesn't affect functionality but creates confusion
- **Scope**: Developer experience, maintenance overhead
- **User Impact**: None (users don't interact with these files directly)
- **Developer Impact**: Confusion about which implementation to use, risk of modifying wrong files

### Root Cause
Code refactoring that left old implementations in place as safety backup.

### Recommended Solution
Complete removal of `src/cli/old/` directory after verification that all functionality is available in new modules.

### Effort Estimate
2 hours of verification and cleanup work

---

## Issue #003: Underutilized Error Recovery System

**Priority**: P3 - Medium  
**Category**: Error Handling / Robustness  
**Discovery Method**: Cross-reference analysis between files  
**Status**: Identified, Action Plan Created  

### Description
The project includes sophisticated error recovery utilities in `src/utils/error-recovery.js` but these are not consistently used across services, particularly in the current instance manager.

### Technical Details
- **Available Utilities**:
  - `RecoverableError` class with categorization
  - `safeExecute` function for wrapped operations
  - `logDiagnostics` for detailed error reporting
  - `recoverLockFile` for file corruption recovery
- **Current Usage**: Minimal integration in current codebase
- **Backup Usage**: Extensive integration in `instance.manager.js.bak`

### Impact Assessment
- **Severity**: Medium - Affects application resilience
- **Scope**: Error handling consistency across all services
- **User Impact**: Poor error recovery, less informative error messages
- **Developer Impact**: Inconsistent debugging experience, manual error handling

### Root Cause
Loss of integration during instance manager simplification process.

### Recommended Solution
Systematic integration of error recovery patterns across all services, starting with instance manager restoration.

### Effort Estimate
6-8 hours of integration work

---

## Issue #004: Insufficient Test Coverage for Core Services

**Priority**: P4 - Medium  
**Category**: Quality Assurance / Testing  
**Discovery Method**: Test directory analysis vs. source directory comparison  
**Status**: Identified, Action Plan Created  

### Description
Several core services lack dedicated unit or integration tests, creating risk for regressions and reducing confidence in changes.

### Technical Details
- **Services Without Dedicated Tests**:
  - `app.manager.js` - Application lifecycle management
  - `profile.manager.js` - Profile creation and management
  - `logging.service.js` - Logging functionality
  - `tray.service.js` - System tray operations
  - `window.service.js` - Window management
- **Services With Tests**:
  - `instance.manager.js` - Has both unit and integration tests
- **Test Infrastructure**: Good foundation exists in `tests/` directory

### Impact Assessment
- **Severity**: Medium - Affects long-term maintainability
- **Scope**: All core services, regression risk
- **User Impact**: Potential for undetected bugs in releases
- **Developer Impact**: Reduced confidence when making changes

### Root Cause
Development prioritization focused on functionality over test coverage.

### Recommended Solution
Create comprehensive test suites for all untested services with focus on critical functionality.

### Effort Estimate
14-20 hours of test development work

---

## Issue #005: Incomplete Theme Service Integration

**Priority**: P5 - Low  
**Category**: Feature Completion  
**Discovery Method**: TODO comment search  
**Status**: Identified, Action Plan Created  

### Description
A single TODO comment indicates incomplete integration with theme service for dark mode detection.

### Technical Details
- **Location**: `src/providers/abstract/base.provider.js:471`
- **Code**: `isDarkMode: true, // TODO: Get from theme service`
- **Current State**: Hardcoded to true
- **Expected State**: Dynamic detection based on system theme

### Impact Assessment
- **Severity**: Low - Cosmetic/UX issue
- **Scope**: Theme detection across providers
- **User Impact**: Dark mode not properly detected from system settings
- **Developer Impact**: Incomplete feature implementation

### Root Cause
Incomplete feature development, likely deprioritized for core functionality.

### Recommended Solution
Either implement theme service or use direct system theme detection API.

### Effort Estimate
2.5-3.5 hours of development work

---

## Summary Statistics

| Priority | Count | Total Estimated Effort |
|----------|-------|----------------------|
| P1 (Critical) | 1 | 8-12 hours |
| P2 (High) | 1 | 2 hours |
| P3 (Medium) | 2 | 20-28 hours |
| P5 (Low) | 1 | 2.5-3.5 hours |
| **Total** | **5** | **32.5-45.5 hours** |

## Risk Distribution

- **High Risk**: 1 issue (Instance Manager)
- **Medium Risk**: 2 issues (CLI Cleanup, Error Recovery)
- **Low Risk**: 2 issues (Test Coverage, Theme Service)

## Recommended Approach

1. Address critical stability issues first (P1)
2. Clean up maintenance burden (P2)  
3. Improve resilience and quality (P3, P4)
4. Complete minor features (P5)

This prioritization ensures application stability while systematically improving code quality and maintainability.
