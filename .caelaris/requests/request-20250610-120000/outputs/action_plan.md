# Comprehensive Action Plan for Combo Desktop Project Issues

## Executive Summary

This action plan addresses five critical areas identified in the codebase analysis:
1. **Critical**: Incomplete instance manager implementation requiring restoration
2. **High**: Deprecated code cleanup in CLI modules  
3. **Medium**: Underutilized error recovery mechanisms
4. **Medium**: Insufficient test coverage for core services
5. **Low**: Minor pending development tasks

## Action Items

### Priority 1 (Critical) - Restore Instance Manager Functionality

**Problem**: Current `instance.manager.js` is a severely stripped-down version missing critical features like transaction management, detailed error recovery, and lock history tracking.

**Solution**: Restore full functionality from backup while maintaining current simplifications where appropriate.

**Steps**:
1. **Assessment Phase** (1-2 hours)
   - Compare current `instance.manager.js` with `instance.manager.js.bak` line by line
   - Identify which features from backup are truly necessary vs. over-engineered
   - Document compatibility requirements with current codebase

2. **Selective Restoration** (4-6 hours)
   - Restore transaction management utilities from backup
   - Re-integrate error recovery mechanisms using `error-recovery.js`
   - Restore detailed lock file management and history tracking
   - Add back robust cleanup handlers and IPC health checks
   - Maintain simplified initialization where current version works well

3. **Testing & Validation** (2-3 hours)
   - Run existing instance manager tests
   - Test multi-instance scenarios
   - Verify profile isolation still works correctly
   - Test cleanup on application exit

4. **Documentation** (1 hour)
   - Document what was restored and why
   - Update any changed APIs or behaviors

**Dependencies**: None
**Risk**: Medium - Changes to core instance management could affect stability
**Estimated Total Effort**: 8-12 hours

### Priority 2 (High) - Remove Deprecated CLI Code

**Problem**: `src/cli/old/` directory contains outdated CLI implementations that could cause confusion and maintenance overhead.

**Solution**: Remove deprecated code after ensuring all functionality is covered by new modules.

**Steps**:
1. **Verification Phase** (1 hour)
   - Compare functionality between `old/` and `modules/` CLI implementations
   - Ensure no unique features are lost in `old/` versions
   - Check if any current code still references `old/` modules

2. **Cleanup Phase** (30 minutes)
   - Delete `src/cli/old/` directory
   - Update any imports or references if found
   - Update build scripts if they reference old CLI files

3. **Validation** (30 minutes)
   - Test all CLI commands still work correctly
   - Verify no broken imports or missing functionality

**Dependencies**: None
**Risk**: Low - Old code appears to be truly deprecated
**Estimated Total Effort**: 2 hours

### Priority 3 (Medium) - Enhance Error Recovery Integration

**Problem**: Current `instance.manager.js` doesn't fully utilize the robust error recovery utilities available in `error-recovery.js`.

**Solution**: Integrate error recovery patterns throughout the instance manager and other core services.

**Steps**:
1. **Integration Planning** (1 hour)
   - Review current error handling patterns in `instance.manager.js`
   - Identify opportunities to use `RecoverableError`, `safeExecute`, etc.
   - Plan integration points with other services

2. **Implementation** (3-4 hours)
   - Replace basic error handling with `RecoverableError` where appropriate
   - Use `safeExecute` for file operations and lock management
   - Implement diagnostic logging for critical failures
   - Add recovery functions for common failure scenarios

3. **Extension to Other Services** (2-3 hours)
   - Apply error recovery patterns to `profile.manager.js`
   - Enhance error handling in `app.manager.js`
   - Update `tray.service.js` and `window.service.js` where beneficial

**Dependencies**: Completion of Priority 1 (instance manager restoration)
**Risk**: Low - Error recovery utilities are well-designed
**Estimated Total Effort**: 6-8 hours

### Priority 4 (Medium) - Expand Test Coverage

**Problem**: Several core services lack dedicated unit/integration tests.

**Solution**: Create comprehensive test suites for undertested services.

**Steps**:
1. **Test Coverage Assessment** (2 hours)
   - Audit existing tests across the entire `tests/` directory
   - Identify gaps in coverage for each service
   - Create test coverage report using appropriate tools

2. **Test Suite Creation** (8-12 hours)
   - Create `app.manager.test.js` with unit and integration tests
   - Create `profile.manager.test.js` covering profile creation, deletion, isolation
   - Create `logging.service.test.js` for log functionality
   - Create `tray.service.test.js` for system tray operations
   - Create `window.service.test.js` for window management

3. **Test Infrastructure Enhancement** (2-3 hours)
   - Enhance test utilities in `test-utils.js` as needed
   - Add mock services for isolated testing
   - Set up automated test running and coverage reporting

4. **Integration Testing** (2-3 hours)
   - Create end-to-end test scenarios
   - Test multi-provider, multi-profile scenarios
   - Test application lifecycle and cleanup

**Dependencies**: None (can run in parallel with other priorities)
**Risk**: Low - Adding tests reduces overall project risk
**Estimated Total Effort**: 14-20 hours

### Priority 5 (Low) - Complete Minor Development Tasks

**Problem**: Pending TODO item for theme service integration.

**Solution**: Implement theme service integration or decide on alternative approach.

**Steps**:
1. **Theme Service Investigation** (1 hour)
   - Research how theme detection should work in Electron
   - Determine if a dedicated theme service is needed or if simpler approach suffices
   - Check if other parts of codebase need theme information

2. **Implementation** (1-2 hours)
   - Either create simple theme service or implement direct system theme detection
   - Update `base.provider.js` to use actual theme detection instead of hardcoded value
   - Test theme detection on different operating systems

3. **Documentation** (30 minutes)
   - Document theme handling approach
   - Update any relevant user documentation

**Dependencies**: None
**Risk**: Very Low - Minor feature addition
**Estimated Total Effort**: 2.5-3.5 hours

## Implementation Timeline

### Phase 1 (Week 1): Critical Issues
- Priority 1: Restore instance manager functionality
- Priority 2: Remove deprecated CLI code

### Phase 2 (Week 2): Core Improvements  
- Priority 3: Enhance error recovery integration
- Priority 5: Complete minor development tasks

### Phase 3 (Week 3-4): Quality Assurance
- Priority 4: Expand test coverage
- Final testing and validation of all changes

## Risk Mitigation

1. **Backup Strategy**: Create git branches for each major change
2. **Incremental Testing**: Test each change independently before moving to next
3. **Rollback Plan**: Keep current working versions until new versions are validated
4. **Documentation**: Document all changes for future maintenance

## Success Metrics

- [ ] Instance manager restored to full functionality without breaking existing features
- [ ] No deprecated code remains in codebase
- [ ] Error recovery utilities used consistently across services
- [ ] Test coverage above 80% for all core services
- [ ] All TODO items resolved
- [ ] Application stability maintained or improved

## Total Estimated Effort: 32-46 hours

This plan addresses all identified issues systematically while minimizing risk and ensuring the application remains stable throughout the improvement process.
