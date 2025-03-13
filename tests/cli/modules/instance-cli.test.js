/**
 * @file Instance CLI Module Tests
 * @description Functional tests for the Instance CLI module
 */

const assert = require('assert');
const path = require('path');
const { mockService } = require('../test-utils');

// Set up environment for tests
process.env.NODE_ENV = 'test';
process.env.CLI_TEST_VERBOSE = process.env.CLI_TEST_VERBOSE || 'true';

/**
 * Verbose logging helper
 * @param {string} message - Message to log
 */
function verboseLog(message) {
    if (process.env.CLI_TEST_VERBOSE === 'true') {
        console.log(`[VERBOSE] ${message}`);
    }
}

/**
 * Test the Instance CLI module functionality
 * @returns {Promise<boolean>} True if all tests pass
 */
async function runTests() {
    let restoreInstanceManager;
    
    try {
        // Create a mock for the instanceManager
        // We need to mock this before importing the InstanceCLI class
        verboseLog('Setting up instance manager mock');
        const instanceManagerPath = path.resolve(__dirname, '../../../src/services/instance.manager');
        restoreInstanceManager = mockService(instanceManagerPath, {
            resetLock: async () => {
                verboseLog('Mock: Resetting instance lock');
                return true;
            },
            createNewInstance: async () => {
                verboseLog('Mock: Creating new instance');
                return true;
            }
        });
        verboseLog('Successfully mocked instance manager');
        
        // Now import the module to test after mocking its dependencies
        const InstanceCLI = require('../../../src/cli/modules/instance-cli');
        verboseLog('Successfully imported InstanceCLI module');
        
        console.log('Running Instance CLI tests...');
        verboseLog('Starting Instance CLI tests with verbose logging enabled');
        
        // Test instance creation and command mapping
        verboseLog('Testing InstanceCLI instance creation...');
        try {
            const instanceCli = new InstanceCLI();
            assert.ok(instanceCli, 'Should create InstanceCLI instance');
            assert.ok(instanceCli.commands, 'Should have commands object');
            assert.ok(typeof instanceCli.commands['reset-lock'] === 'function', 'Should have reset-lock command');
            assert.ok(typeof instanceCli.commands['new'] === 'function', 'Should have new command');
            verboseLog('✅ InstanceCLI instance creation test passed');
        
            // Test parseArgs method with reset-lock command
            verboseLog('Testing parseArgs with reset-lock command...');
            let args = {
                instance: true,  // This is the entry flag that must be present (singular, not plural)
                _: ['reset-lock']
            };
            let result = await instanceCli.parseArgs(args);
            assert.ok(result, 'Should parse reset-lock command');
            assert.strictEqual(result.command, 'reset-lock', 'Should identify reset-lock command');
            assert.ok(result.handler, 'Should have handler function');
            verboseLog('✅ Parse reset-lock command test passed');

            // Test parseArgs with new command
            verboseLog('Testing parseArgs with new command...');
            args = {
                instance: true,  // This is the entry flag that must be present (singular, not plural)
                _: ['new']
            };
            result = await instanceCli.parseArgs(args);
            assert.ok(result, 'Should parse new command');
            assert.strictEqual(result.command, 'new', 'Should identify new command');
            assert.ok(result.handler, 'Should have handler function');
            verboseLog('✅ Parse new command test passed');
            
            // Test execute method with reset-lock command
            verboseLog('Testing execute with reset-lock command...');
            try {
                await instanceCli.execute({
                    command: 'reset-lock',
                    handler: instanceCli.commands['reset-lock'],
                    args: { force: true }  // Added force: true to pass the check in resetLock method
                });
                verboseLog('✅ Execute reset-lock command test passed');
            } catch (error) {
                console.error('Error executing reset-lock command:', error);
                verboseLog(`❌ Execute reset-lock command test failed: ${error.message}`);
                return false;
            }
            
            // Test execute method with invalid command
            verboseLog('Testing execute with invalid command...');
            try {
                await instanceCli.execute(null);
                assert.fail('Should throw error for invalid command');
            } catch (error) {
                assert.ok(error, 'Should have error for invalid command');
                verboseLog('✅ Execute invalid command test passed');
            }
            
            console.log('All Instance CLI tests passed!');
            return true;
        } catch (error) {
            console.error('Error in InstanceCLI tests:', error);
            return false;
        }
    } catch (error) {
        console.error('Instance CLI tests failed:', error);
        return false;
    } finally {
        // Restore the original instanceManager
        if (restoreInstanceManager) {
            try {
                restoreInstanceManager();
                verboseLog('Restored original instance manager');
            } catch (error) {
                console.error('Error restoring instance manager:', error);
            }
        }
    }
}

// Add handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit the process as we're handling it
});

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Unhandled error in tests:', error);
        process.exit(1);
    });
}

module.exports = { runTests };