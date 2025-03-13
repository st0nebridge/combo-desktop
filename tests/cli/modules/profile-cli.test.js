/**
 * @file Profile CLI Module Tests
 * @description Functional tests for the Profile CLI module
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
 * Test the Profile CLI module functionality
 * @returns {Promise<boolean>} True if all tests pass
 */
async function runTests() {
    let restoreProfileManager;
    
    try {
        // Create a mock for the profileManager - do this before importing the ProfileCLI
        verboseLog('Setting up profile manager mock');
        const profileManagerPath = path.resolve(__dirname, '../../../src/services/profile.manager');
        restoreProfileManager = mockService(profileManagerPath, {
            getAllProfiles: () => {
                verboseLog('Mock: Listing profiles');
                return [
                    { name: 'work', provider: 'whatsapp', options: { theme: 'dark' }, active: false },
                    { name: 'personal', provider: 'whatsapp', active: true },
                    { name: 'business', provider: 'telegram', options: { notifications: true }, active: false }
                ];
            },
            createProfile: async (name, provider, options) => {
                verboseLog(`Mock: Creating profile ${name}`);
                return true;
            },
            deleteProfile: async (name) => {
                verboseLog(`Mock: Deleting profile ${name}`);
                return true;
            },
            switchProfile: async (name) => {
                verboseLog(`Mock: Switching to profile ${name}`);
                return true;
            },
            delegateCommand: async (command, ...args) => {
                verboseLog(`Mock: Delegating command ${command} with args: ${JSON.stringify(args)}`);
                return true;
            }
        });
        verboseLog('Successfully mocked profile manager');
        
        // Now import the module to test after mocking its dependencies
        const ProfileCLI = require('../../../src/cli/modules/profile-cli');
        verboseLog('Successfully imported ProfileCLI module');
        
        console.log('Running Profile CLI tests...');
        verboseLog('Starting Profile CLI tests with verbose logging enabled');
        
        // Test instance creation and command mapping
        verboseLog('Testing ProfileCLI instance creation...');
        const profileCli = new ProfileCLI();
        assert.ok(profileCli, 'Should create ProfileCLI instance');
        assert.ok(profileCli.commands, 'Should have commands object');
        assert.ok(typeof profileCli.commands.list === 'function', 'Should have list command');
        assert.ok(typeof profileCli.commands.create === 'function', 'Should have create command');
        assert.ok(typeof profileCli.commands.delete === 'function', 'Should have delete command');
        assert.ok(typeof profileCli.commands.switch === 'function', 'Should have switch command');
        verboseLog('✅ ProfileCLI instance creation test passed');
        
        // Test parseArgs method with list command
        verboseLog('Testing parseArgs with list command...');
        let args = {
            profile: true,  // This is the entry flag that must be present (singular, not plural)
            _: ['list']
        };
        let result = await profileCli.parseArgs(args);
        assert.ok(result, 'Should parse list command');
        assert.strictEqual(result.command, 'list', 'Should identify list command');
        assert.ok(result.handler, 'Should have handler function');
        verboseLog('✅ Parse list command test passed');

        // Test parseArgs with create command
        verboseLog('Testing parseArgs with create command...');
        args = {
            profile: true,  // This is the entry flag that must be present (singular, not plural)
            _: ['create'],
            name: 'test-profile',
            provider: 'whatsapp'
        };
        result = await profileCli.parseArgs(args);
        assert.ok(result, 'Should parse create command');
        assert.strictEqual(result.command, 'create', 'Should identify create command');
        assert.ok(result.handler, 'Should have handler function');
        assert.strictEqual(result.args.name, 'test-profile', 'Should pass name argument');
        assert.strictEqual(result.args.provider, 'whatsapp', 'Should pass provider argument');
        verboseLog('✅ Parse create command test passed');
        
        // Test parseArgs with delete command
        verboseLog('Testing parseArgs with delete command...');
        args = {
            profile: true,  // This is the entry flag that must be present (singular, not plural)
            _: ['delete'],
            name: 'test-profile',
            provider: 'whatsapp'
        };
        result = await profileCli.parseArgs(args);
        assert.ok(result, 'Should parse delete command');
        assert.strictEqual(result.command, 'delete', 'Should identify delete command');
        assert.ok(result.handler, 'Should have handler function');
        assert.strictEqual(result.args.name, 'test-profile', 'Should pass name argument');
        assert.strictEqual(result.args.provider, 'whatsapp', 'Should pass provider argument');
        verboseLog('✅ Parse delete command test passed');
        
        // Test parseArgs with switch command
        verboseLog('Testing parseArgs with switch command...');
        args = {
            profile: true,  // This is the entry flag that must be present (singular, not plural)
            _: ['switch'],
            name: 'test-profile',
            provider: 'whatsapp'
        };
        result = await profileCli.parseArgs(args);
        assert.ok(result, 'Should parse switch command');
        assert.strictEqual(result.command, 'switch', 'Should identify switch command');
        assert.ok(result.handler, 'Should have handler function');
        assert.strictEqual(result.args.name, 'test-profile', 'Should pass name argument');
        assert.strictEqual(result.args.provider, 'whatsapp', 'Should pass provider argument');
        verboseLog('✅ Parse switch command test passed');
        
        // Test execute method with list command
        verboseLog('Testing execute with list command...');
        try {
            await profileCli.execute({
                command: 'list',
                handler: profileCli.commands.list,
                args: {}
            });
            verboseLog('✅ Execute list command test passed');
        } catch (error) {
            verboseLog(`❌ Execute list command test failed: ${error.message}`);
            throw new Error(`Error executing list command: ${error.message}`);
        }
        
        // Test execute method with invalid command
        verboseLog('Testing execute with invalid command...');
        try {
            await profileCli.execute(null);
            assert.fail('Should throw error for invalid command');
        } catch (error) {
            assert.ok(error, 'Should have error for invalid command');
            verboseLog('✅ Execute invalid command test passed');
        }
        
        console.log('All Profile CLI tests passed!');
        return true;
    } catch (error) {
        console.error('Profile CLI tests failed:', error);
        return false;
    } finally {
        // Restore the original profileManager
        if (restoreProfileManager) {
            try {
                restoreProfileManager();
                verboseLog('Restored original profile manager');
            } catch (error) {
                console.error('Error restoring profile manager:', error);
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