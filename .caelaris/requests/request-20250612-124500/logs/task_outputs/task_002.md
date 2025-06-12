# Task 002 Output: Archive Candidates Categorization

## Archive Structure Design

### Category 1: Development Tests (`archived/development-tests/`)
**Test Scripts (Individual test files):**
- `test-unload-instance-fix.js`
- `test-case-sensitivity-fix.js`
- `test-cli-fix-validation.js`
- `test-close-instance-simulation.js`
- `test-delegation-behavior.js`
- `test-delegation-tray-real.js`
- `test-delegation-tray.js`
- `test-delegation.js`
- `test-e2e-close-instance-fix.js`
- `test-ipc-simple.js`
- `test-multi-instance.js`
- `test-new-tray-behavior.js`
- `test-process-management.js`
- `test-real-close-instance.js`
- `test-real-delegation.js`
- `test-real-tray-exit.js`
- `test-session-registration-fix.js`
- `test-simple-close-instance.js`
- `test-tray-close-instance.js`
- `test-tray-context-menu.js`
- `test-tray-exit.js`
- `test-window-show-behavior.js`

### Category 2: Debug Scripts (`archived/debug-scripts/`)
**Debug Utilities:**
- `debug-delegation-exit.js`
- `debug-ipc-delegation.js`
- `debug-real-provider-flow.js`
- `debug-session-registration.js`
- `debug-session-sharing.js`
- `debug-session-state.js`
- `debug-tray-close.js`
- `debug-window-tray-creation.js`

### Category 3: Development Tools (`archived/development-tools/`)
**Demo and Validation Scripts:**
- `demo-window-show-behavior.js`
- `validate-window-show-behavior.js`
- `verify-architecture.js`
- `verify-close-instance-fix.js`
- `verify-code-structure.js`
- `quick-test.js`
- `simple-test.js`
- `manual-test-guide.js`

### Category 4: Implementation Notes (`archived/implementation-notes/`)
**Development Completion Documentation:**
- `FIX_SUMMARY_CLOSE_INSTANCE.md`
- `FIX_SUMMARY_TRAY_CLEANUP.md`
- `SESSION_REGISTRATION_FIX_COMPLETE.md`
- `UNLOAD_INSTANCE_IMPLEMENTATION_COMPLETE.md`
- `WINDOW_SHOW_BEHAVIOR_COMPLETION.md`

## Archive Execution Plan

### Phase 1: Create Archive Directory Structure
```
archived/
├── development-tests/    # Test scripts (22 files)
├── debug-scripts/       # Debug utilities (8 files)  
├── development-tools/   # Demo/validation scripts (8 files)
├── implementation-notes/# Development docs (5 files)
└── README.md           # Archive index and usage guide
```

### Phase 2: Move Files by Category
1. **Development Tests**: All `test-*.js` files
2. **Debug Scripts**: All `debug-*.js` files
3. **Development Tools**: Demo, verify, validate scripts + manual guides
4. **Implementation Notes**: All FIX_SUMMARY and completion .md files

### Phase 3: Create Archive Documentation
- Archive README.md explaining contents and purpose
- Maintain file references for easy restoration if needed

## Safety Measures
- **Backup Verification**: Ensure `.archive/` exists for additional safety
- **Move Operation**: Use move (not delete) to preserve files
- **Index Creation**: Create comprehensive file index
- **Production Isolation**: Zero impact on src/, docs/, tests/ directories

## File Count Summary
- **Total files to archive**: 43 files
- **Archive categories**: 4 categories
- **Estimated space saving**: ~2MB of development scripts
- **Recovery time**: <5 minutes if restoration needed

## Risk Assessment: MINIMAL
- All files are development/testing artifacts
- No production dependencies
- Complete restoration capability maintained
- Zero functional impact on application
