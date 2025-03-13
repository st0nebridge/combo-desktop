/**
 * @file CLI Registry Tests
 * @description Functional tests for the CLI Registry
 */

const assert = require('assert');
const path = require('path');
const { mockService } = require('./test-utils');

// Import the module to test
const cliRegistry = require('../../src/cli/cli.registry');
const HelpCLI = require('../../src/cli/modules/help-cli');
const InstanceCLI = require('../../src/cli/modules/instance-cli');
const ProfileCLI = require('../../src/cli/modules/profile-cli');
const ProviderCLI = require('../../src/cli/modules/provider-cli');

/**
 * Test the CLI Registry functionality
 * @returns {Promise<boolean>} True if all tests pass
 */
async function runTests() {
    console.log('Running CLI Registry tests...');
    
    try {
        // Clear registry for clean testing
        cliRegistry.clear();
        assert.strictEqual(cliRegistry.modules.size, 0, 'Registry should be empty after clear');
        
        // Test module registration
        const helpCli = new HelpCLI();
        const instanceCli = new InstanceCLI();
        const profileCli = new ProfileCLI();
        const providerCli = new ProviderCLI();
        
        // Register modules
        const helpRegistered = cliRegistry.register(helpCli);
        assert.strictEqual(helpRegistered, true, 'Should register HelpCLI module');
        
        const instanceRegistered = cliRegistry.register(instanceCli);
        assert.strictEqual(instanceRegistered, true, 'Should register InstanceCLI module');
        
        const profileRegistered = cliRegistry.register(profileCli);
        assert.strictEqual(profileRegistered, true, 'Should register ProfileCLI module');
        
        const providerRegistered = cliRegistry.register(providerCli);
        assert.strictEqual(providerRegistered, true, 'Should register ProviderCLI module');
        
        // Test invalid module registration
        const invalidRegistered = cliRegistry.register({});
        assert.strictEqual(invalidRegistered, false, 'Should reject invalid module');
        
        const nullRegistered = cliRegistry.register(null);
        assert.strictEqual(nullRegistered, false, 'Should reject null module');
        
        // Test duplicate registration
        const duplicateRegistered = cliRegistry.register(helpCli);
        assert.strictEqual(duplicateRegistered, true, 'Should handle duplicate registration gracefully');
        
        // Test registry size
        assert.strictEqual(cliRegistry.modules.size, 4, 'Registry should have 4 modules');
        
        // Mock instance manager for delegation tests
        const instanceManager = require('../../src/services/instance.manager');
        const restoreInstanceManager = mockService('../../src/services/instance.manager', {
            ...instanceManager,
            ensureDirectories: async () => true,
            resetLock: async () => true,
            hasRunningInstance: async () => false,
            canHandleProfile: async () => false,
            delegateCommand: async () => true
        });
        
        // Capture console.log output
        const originalConsoleLog = console.log;
        let consoleOutput = '';
        console.log = (...args) => {
            consoleOutput += args.join(' ') + '\n';
            originalConsoleLog(...args);
        };
        
        try {
            // Test execute with no arguments
            const noArgsResult = await cliRegistry.execute([]);
            assert.strictEqual(noArgsResult.success, true, 'Execute with no args should succeed');
            assert.strictEqual(noArgsResult.isCliCommand, true, 'No args should be a CLI command');
            assert.ok(consoleOutput.includes('Usage:'), 'Should show help with no args');
            
            // Reset console output
            consoleOutput = '';
            
            // Test execute with help flag
            const helpResult = await cliRegistry.execute(['--help']);
            assert.strictEqual(helpResult.success, true, 'Execute with help flag should succeed');
            assert.strictEqual(helpResult.isCliCommand, true, 'Help should be a CLI command');
            assert.ok(consoleOutput.includes('Usage:'), 'Should show help with --help flag');
            
            // Reset console output
            consoleOutput = '';
            
            // Test execute with reset-lock flag
            const resetLockResult = await cliRegistry.execute(['--reset-lock']);
            assert.strictEqual(resetLockResult.success, true, 'Execute with reset-lock flag should succeed');
            assert.strictEqual(resetLockResult.isCliCommand, true, 'Reset-lock should be a CLI command');
            
            // Test execute with unknown flag
            const unknownResult = await cliRegistry.execute(['--unknown-flag']);
            assert.strictEqual(unknownResult.success, false, 'Execute with unknown flag should fail');
            assert.strictEqual(unknownResult.isCliCommand, true, 'Unknown flag should be a CLI command');
            assert.ok(consoleOutput.includes('Usage:'), 'Should show help with unknown flag');
            
            // Test shouldDelegateCommand method
            const shouldDelegateHelp = await cliRegistry.shouldDelegateCommand(['--help']);
            assert.strictEqual(shouldDelegateHelp, false, 'Should not delegate help command');
            
            const shouldDelegateNewInstance = await cliRegistry.shouldDelegateCommand(['--new-instance']);
            assert.strictEqual(shouldDelegateNewInstance, false, 'Should not delegate new-instance command');
            
            const shouldDelegateOneInstance = await cliRegistry.shouldDelegateCommand(['--one-instance']);
            assert.strictEqual(shouldDelegateOneInstance, false, 'Should not delegate one-instance command');
            
            const shouldDelegateResetLock = await cliRegistry.shouldDelegateCommand(['--reset-lock']);
            assert.strictEqual(shouldDelegateResetLock, false, 'Should not delegate reset-lock command');
            
            const shouldDelegateInstances = await cliRegistry.shouldDelegateCommand(['--instances']);
            assert.strictEqual(shouldDelegateInstances, false, 'Should not delegate instances command');
            
            const shouldDelegateProfilesList = await cliRegistry.shouldDelegateCommand(['--profiles', 'list']);
            assert.strictEqual(shouldDelegateProfilesList, false, 'Should not delegate profiles list command');
            
            // Test getLastParsedArgs method
            const lastParsedArgs = cliRegistry.getLastParsedArgs();
            assert.ok(lastParsedArgs !== null, 'Should have last parsed args');
            
            console.log('All CLI Registry tests passed!');
            return true;
        } finally {
            // Restore console.log
            console.log = originalConsoleLog;
            
            // Restore instance manager
            restoreInstanceManager();
            
            // Clear registry
            cliRegistry.clear();
        }
    } catch (error) {
        console.error('CLI Registry tests failed:', error);
        return false;
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Error running tests:', error);
            process.exit(1);
        });
}

module.exports = { runTests };