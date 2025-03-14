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
    let restoreLogger;
    
    try {
        // Mock logger service
        verboseLog('Setting up logger mock');
        const loggerPath = path.resolve(__dirname, '../../../src/services/logging.service');
        restoreLogger = mockService(loggerPath, {
            info: (...args) => {
                verboseLog(`Logger.info: ${args.join(' ')}`);
            },
            warn: (...args) => {
                verboseLog(`Logger.warn: ${args.join(' ')}`);
            },
            error: (...args) => {
                verboseLog(`Logger.error: ${args.join(' ')}`);
            },
            debug: (...args) => {
                verboseLog(`Logger.debug: ${args.join(' ')}`);
            }
        });
        verboseLog('Successfully mocked logger');
        
        // Create a mock for the profileManager - do this before importing the ProfileCLI
        verboseLog('Setting up profile manager mock');
        const profileManagerPath = path.resolve(__dirname, '../../../src/services/profile.manager');
        
        // Create mock profiles data
        const mockProfiles = {
            'app:whatsapp:work': {
                providerName: 'whatsapp',
                profileName: 'work',
                options: { theme: 'dark' },
                active: false
            },
            'app:whatsapp:personal': {
                providerName: 'whatsapp',
                profileName: 'personal',
                options: {},
                active: true
            },
            'app:telegram:business': {
                providerName: 'telegram',
                profileName: 'business',
                options: { notifications: true },
                active: false
            }
        };
        
        restoreProfileManager = mockService(profileManagerPath, {
            getAllProfiles: () => {
                verboseLog('Mock: Getting all profiles');
                return mockProfiles;
            },
            getProfilesByProvider: (providerName) => {
                verboseLog(`Mock: Getting profiles for provider ${providerName}`);
                return Object.entries(mockProfiles)
                    .filter(([_, profile]) => profile.providerName === providerName)
                    .reduce((acc, [key, value]) => {
                        acc[key] = value;
                        return acc;
                    }, {});
            },
            deleteProfile: async (providerName, profileName) => {
                verboseLog(`Mock: Deleting profile ${profileName} for ${providerName}`);
                const partitionName = `app:${providerName}:${profileName}`;
                if (!mockProfiles[partitionName]) {
                    throw new Error(`Profile ${profileName} does not exist for provider ${providerName}`);
                }
                return true;
            },
            deleteAllProfiles: async () => {
                verboseLog('Mock: Deleting all profiles');
                return true;
            },
            getPartitionName: (providerName, profileName) => {
                return `app:${providerName}:${profileName}`;
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
        assert.ok(typeof profileCli.commands.delete === 'function', 'Should have delete command');
        assert.ok(typeof profileCli.commands['delete-all'] === 'function', 'Should have delete-all command');
        verboseLog('✅ ProfileCLI instance creation test passed');
        
        // Test canHandle method
        verboseLog('Testing canHandle method...');
        assert.strictEqual(profileCli.canHandle([]), false, 'Should not handle empty args');
        assert.strictEqual(profileCli.canHandle(['--profile']), true, 'Should handle --profile flag');
        assert.strictEqual(profileCli.canHandle(['--other']), false, 'Should not handle other flags');
        verboseLog('✅ canHandle method test passed');
        
        // Test parseArgs method with list command
        verboseLog('Testing parseArgs with list command...');
        let args = ['--profile', 'list'];
        let result = profileCli.parseArgs(args);
        assert.ok(result, 'Should parse list command');
        assert.strictEqual(result.command, 'list', 'Should identify list command');
        verboseLog('✅ Parse list command test passed');
        
        // Test parseArgs with delete command for all providers
        verboseLog('Testing parseArgs with delete command for all providers...');
        args = ['--profile', 'delete', 'work'];
        result = profileCli.parseArgs(args);
        assert.ok(result, 'Should parse delete command');
        assert.strictEqual(result.command, 'delete', 'Should identify delete command');
        assert.strictEqual(result.profileName, 'work', 'Should capture profile name');
        assert.strictEqual(result.providerName, undefined, 'Should not have provider name');
        verboseLog('✅ Parse delete command for all providers test passed');
        
        // Test parseArgs with delete command for specific provider
        verboseLog('Testing parseArgs with delete command for specific provider...');
        args = ['--profile', 'delete', 'work', '--whatsapp'];
        result = profileCli.parseArgs(args);
        assert.ok(result, 'Should parse delete command with provider');
        assert.strictEqual(result.command, 'delete', 'Should identify delete command');
        assert.strictEqual(result.profileName, 'work', 'Should capture profile name');
        assert.strictEqual(result.providerName, 'whatsapp', 'Should capture provider name');
        verboseLog('✅ Parse delete command for specific provider test passed');
        
        // Test parseArgs with delete-all command
        verboseLog('Testing parseArgs with delete-all command...');
        args = ['--profile', 'delete-all'];
        result = profileCli.parseArgs(args);
        assert.ok(result, 'Should parse delete-all command');
        assert.strictEqual(result.command, 'delete-all', 'Should identify delete-all command');
        verboseLog('✅ Parse delete-all command test passed');
        
        // Test execute method with list command
        verboseLog('Testing execute with list command...');
        result = await profileCli.execute(['--profile', 'list'], {});
        assert.strictEqual(result.success, true, 'Should execute list command successfully');
        assert.strictEqual(result.continueExecution, false, 'Should not continue execution');
        verboseLog('✅ Execute list command test passed');
        
        // Test execute method with delete command for all providers
        verboseLog('Testing execute with delete command for all providers...');
        result = await profileCli.execute(['--profile', 'delete', 'work'], {});
        assert.strictEqual(result.success, true, 'Should execute delete command successfully');
        assert.strictEqual(result.continueExecution, false, 'Should not continue execution');
        verboseLog('✅ Execute delete command for all providers test passed');
        
        // Test execute method with delete command for specific provider
        verboseLog('Testing execute with delete command for specific provider...');
        result = await profileCli.execute(['--profile', 'delete', 'work', '--whatsapp'], {});
        assert.strictEqual(result.success, true, 'Should execute delete command for specific provider successfully');
        assert.strictEqual(result.continueExecution, false, 'Should not continue execution');
        verboseLog('✅ Execute delete command for specific provider test passed');
        
        // Test execute method with delete-all command
        verboseLog('Testing execute with delete-all command...');
        result = await profileCli.execute(['--profile', 'delete-all'], {});
        assert.strictEqual(result.success, true, 'Should execute delete-all command successfully');
        assert.strictEqual(result.continueExecution, false, 'Should not continue execution');
        verboseLog('✅ Execute delete-all command test passed');
        
        // Test command handlers directly
        verboseLog('Testing listProfiles command handler...');
        assert.strictEqual(await profileCli.listProfiles({}), true, 'Should list profiles successfully');
        verboseLog('✅ listProfiles handler test passed');
        
        verboseLog('Testing deleteProfile command handler with profile name only...');
        assert.strictEqual(await profileCli.deleteProfile({ profileName: 'work' }), true, 'Should delete profile successfully');
        verboseLog('✅ deleteProfile handler with profile name only test passed');
        
        verboseLog('Testing deleteProfile command handler with profile and provider...');
        assert.strictEqual(await profileCli.deleteProfile({ profileName: 'work', providerName: 'whatsapp' }), true, 'Should delete profile for provider successfully');
        verboseLog('✅ deleteProfile handler with profile and provider test passed');
        
        verboseLog('Testing deleteAllProfiles command handler...');
        assert.strictEqual(await profileCli.deleteAllProfiles(), true, 'Should delete all profiles successfully');
        verboseLog('✅ deleteAllProfiles handler test passed');
        
        // Test execute method with help flag
        verboseLog('Testing execute with help flag...');
        result = await profileCli.execute(['--profile', '--help'], {});
        assert.strictEqual(result.success, true, 'Should execute help flag successfully');
        assert.strictEqual(result.continueExecution, false, 'Should not continue execution');
        verboseLog('✅ Execute help flag test passed');
        
        console.log('All Profile CLI tests passed!');
        return true;
    } catch (error) {
        console.error('Profile CLI tests failed:', error);
        return false;
    } finally {
        // Restore the original modules
        if (restoreProfileManager) {
            try {
                restoreProfileManager();
                verboseLog('Restored original profile manager');
            } catch (error) {
                console.error('Error restoring profile manager:', error);
            }
        }
        
        if (restoreLogger) {
            try {
                restoreLogger();
                verboseLog('Restored original logger');
            } catch (error) {
                console.error('Error restoring logger:', error);
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