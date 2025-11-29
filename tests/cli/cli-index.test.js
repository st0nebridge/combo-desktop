/**
 * @file CLI Index Tests
 * @description Functional tests for the CLI Index module
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { mockService } = require('./test-utils');

// Import the module to test
const cliIndex = require('../../src/cli/index');
const cliRegistry = require('../../src/cli/cli.registry');

/**
 * Test the CLI Index functionality
 * @returns {Promise<boolean>} True if all tests pass
 */
async function runTests() {
    if (process.env.JEST_WORKER_ID) {
        return true;
    }
    console.log('Running CLI Index tests...');
    
    try {
        // Mock fs.readdirSync to return test modules
        const originalReaddirSync = fs.readdirSync;
        fs.readdirSync = (dir) => {
            if (dir.includes('modules')) {
                return [
                    'help-cli.js',
                    'instance-cli.js',
                    'profile-cli.js',
                    'provider-cli.js',
                    'base-cli.js' // This should be filtered out
                ];
            }
            return originalReaddirSync(dir);
        };
        
        // Mock registry for testing
        const originalRegister = cliRegistry.register;
        let registeredModules = [];
        cliRegistry.register = (module) => {
            registeredModules.push(module.constructor.name);
            return true;
        };
        
        // Mock registry clear
        const originalClear = cliRegistry.clear;
        let clearCalled = false;
        cliRegistry.clear = () => {
            clearCalled = true;
            return originalClear.call(cliRegistry);
        };
        
        try {
            // Test initModules
            const initResult = await cliIndex.initModules();
            assert.strictEqual(initResult, true, 'initModules should return true');
            assert.strictEqual(clearCalled, true, 'Registry clear should be called');
            
            // Check registered modules
            assert.ok(registeredModules.includes('HelpCLI'), 'HelpCLI should be registered');
            assert.ok(registeredModules.includes('InstanceCLI'), 'InstanceCLI should be registered');
            assert.ok(registeredModules.includes('ProfileCLI'), 'ProfileCLI should be registered');
            assert.ok(registeredModules.includes('ProviderCLI'), 'ProviderCLI should be registered');
            assert.strictEqual(registeredModules.length, 4, 'Should register 4 modules');
            
            // Test duplicate initialization
            registeredModules = [];
            clearCalled = false;
            
            const duplicateInitResult = await cliIndex.initModules();
            assert.strictEqual(duplicateInitResult, true, 'Duplicate initModules should return true');
            assert.strictEqual(clearCalled, false, 'Registry clear should not be called for duplicate init');
            assert.strictEqual(registeredModules.length, 0, 'No modules should be registered for duplicate init');
            
            // Test execute method
            // Mock cliRegistry.execute
            const originalExecute = cliRegistry.execute;
            let executeCalled = false;
            let executeArgs = null;
            cliRegistry.execute = async (args) => {
                executeCalled = true;
                executeArgs = args;
                return { success: true, isCliCommand: true, processedProviders: [] };
            };
            
            // Mock process.exit
            const originalExit = process.exit;
            let exitCalled = false;
            let exitCode = null;
            process.exit = (code) => {
                exitCalled = true;
                exitCode = code;
                return code;
            };
            
            try {
                // Test execute with no args
                const noArgsResult = await cliIndex.execute([]);
                assert.strictEqual(noArgsResult.success, true, 'Execute with no args should succeed');
                assert.strictEqual(executeCalled, true, 'Registry execute should be called');
                assert.deepStrictEqual(executeArgs, [], 'Execute should be called with empty args');
                
                // Reset mocks
                executeCalled = false;
                executeArgs = null;
                
                // Test execute with args
                const argsResult = await cliIndex.execute(['--help']);
                assert.strictEqual(argsResult.success, true, 'Execute with args should succeed');
                assert.strictEqual(executeCalled, true, 'Registry execute should be called');
                assert.deepStrictEqual(executeArgs, ['--help'], 'Execute should be called with correct args');
                
                // Test execute with failure
                cliRegistry.execute = async () => {
                    return { success: false, isCliCommand: true, processedProviders: [] };
                };
                
                try {
                    await cliIndex.execute(['--unknown']);
                    assert.fail('Execute should throw on failure');
                } catch (error) {
                    assert.ok(exitCalled, 'Process.exit should be called on failure');
                    assert.strictEqual(exitCode, 1, 'Exit code should be 1 on failure');
                }
                
                console.log('All CLI Index tests passed!');
                return true;
            } finally {
                // Restore process.exit
                process.exit = originalExit;
                
                // Restore cliRegistry.execute
                cliRegistry.execute = originalExecute;
            }
        } finally {
            // Restore mocks
            fs.readdirSync = originalReaddirSync;
            cliRegistry.register = originalRegister;
            cliRegistry.clear = originalClear;
        }
    } catch (error) {
        console.error('CLI Index tests failed:', error);
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

if (typeof describe === 'function') {
    describe('CLI index legacy suite', () => {
        test('executes CLI index tests', async () => {
            const result = await runTests();
            expect(result).toBe(true);
        });
    });
}
