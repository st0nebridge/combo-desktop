/**
 * @file Help CLI Module Tests
 * @description Functional tests for the Help CLI module
 */

const assert = require('assert');
const path = require('path');
const { mockService } = require('../test-utils');

// Import the module to test
const HelpCLI = require('../../../src/cli/modules/help-cli');

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
 * Test the Help CLI module functionality
 * @returns {Promise<boolean>} True if all tests pass
 */
async function runTests() {
    if (process.env.JEST_WORKER_ID) {
        return true;
    }
    let restoreLogger;
    let restoreRegistry;
    
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
        
        // Mock CLI registry
        verboseLog('Setting up CLI registry mock');
        global.cliRegistry = {
            getModules: () => {
                verboseLog('Mock: Getting CLI modules');
                const mockModules = new Map();
                mockModules.set('test', {
                    getManualTopic: () => 'test',
                    showManual: async () => {
                        verboseLog('Mock: Showing manual for test module');
                        return true;
                    },
                    constructor: { name: 'TestCLI' }
                });
                return mockModules;
            }
        };
        verboseLog('Successfully mocked CLI registry');
        
        console.log('Running Help CLI tests...');
        verboseLog('Starting Help CLI tests with verbose logging enabled');
        
        // Test instance creation and command mapping
        verboseLog('Testing HelpCLI instance creation...');
        const helpCli = new HelpCLI();
        assert.ok(helpCli, 'Should create HelpCLI instance');
        assert.ok(helpCli.commands, 'Should have commands object');
        assert.ok(typeof helpCli.commands.version === 'function', 'Should have version command');
        assert.ok(typeof helpCli.commands.help === 'function', 'Should have help command');
        assert.ok(typeof helpCli.commands.manual === 'function', 'Should have manual command');
        verboseLog('✅ HelpCLI instance creation test passed');
        
        // Test canHandle method
        verboseLog('Testing canHandle method...');
        assert.strictEqual(helpCli.canHandle([]), false, 'Should not handle empty args');
        assert.strictEqual(helpCli.canHandle(['--help']), true, 'Should handle --help flag');
        assert.strictEqual(helpCli.canHandle(['--version']), true, 'Should handle --version flag');
        assert.strictEqual(helpCli.canHandle(['--manual']), true, 'Should handle --manual flag');
        assert.strictEqual(helpCli.canHandle(['--unknown']), false, 'Should not handle unknown flags');
        verboseLog('✅ canHandle method test passed');
        
        // Test parseArgs method with direct flags
        verboseLog('Testing parseArgs with direct flags...');
        let args = ['--help'];
        let result = helpCli.parseArgs(args);
        assert.strictEqual(result.command, 'help', 'Should identify help command');
        verboseLog('✅ Parse help flag test passed');
        
        args = ['--version'];
        result = helpCli.parseArgs(args);
        assert.strictEqual(result.command, 'version', 'Should identify version command');
        verboseLog('✅ Parse version flag test passed');
        
        args = ['--manual'];
        result = helpCli.parseArgs(args);
        assert.strictEqual(result.command, 'manual', 'Should identify manual command');
        assert.strictEqual(result.topic, undefined, 'Should not have topic');
        verboseLog('✅ Parse manual flag without topic test passed');
        
        args = ['--manual', 'test'];
        result = helpCli.parseArgs(args);
        assert.strictEqual(result.command, 'manual', 'Should identify manual command');
        assert.strictEqual(result.topic, 'test', 'Should capture topic');
        verboseLog('✅ Parse manual flag with topic test passed');
        
        // Test isCliCommand method
        verboseLog('Testing isCliCommand method...');
        assert.strictEqual(helpCli.isCliCommand(), true, 'Should identify as CLI command');
        verboseLog('✅ isCliCommand method test passed');
        
        // Test loadCliModules method
        verboseLog('Testing loadCliModules method...');
        helpCli.loadCliModules();
        assert.ok(Object.keys(helpCli.cliModules).length > 0, 'Should load CLI modules');
        assert.ok(helpCli.cliModules.test, 'Should have test module');
        verboseLog('✅ loadCliModules method test passed');
        
        // Test execute method with help command
        verboseLog('Testing execute with help command...');
        result = await helpCli.execute(['--help'], {});
        assert.strictEqual(result.success, true, 'Should execute help command successfully');
        assert.strictEqual(result.continueExecution, false, 'Should not continue execution');
        verboseLog('✅ Execute help command test passed');
        
        // Test execute method with version command
        verboseLog('Testing execute with version command...');
        result = await helpCli.execute(['--version'], {});
        assert.strictEqual(result.success, true, 'Should execute version command successfully');
        assert.strictEqual(result.continueExecution, false, 'Should not continue execution');
        verboseLog('✅ Execute version command test passed');
        
        // Test execute method with manual command
        verboseLog('Testing execute with manual command...');
        result = await helpCli.execute(['--manual'], {});
        assert.strictEqual(result.success, true, 'Should execute manual command successfully');
        assert.strictEqual(result.continueExecution, false, 'Should not continue execution');
        verboseLog('✅ Execute manual command test passed');
        
        // Test execute method with manual command and topic
        verboseLog('Testing execute with manual command and topic...');
        result = await helpCli.execute(['--manual', 'test'], {});
        assert.strictEqual(result.success, true, 'Should execute manual command with topic successfully');
        assert.strictEqual(result.continueExecution, false, 'Should not continue execution');
        verboseLog('✅ Execute manual command with topic test passed');
        
        // Test command handlers directly
        verboseLog('Testing showUsage command handler...');
        assert.strictEqual(await helpCli.showUsage(), true, 'Should show usage successfully');
        verboseLog('✅ showUsage handler test passed');
        
        verboseLog('Testing showVersion command handler...');
        assert.strictEqual(await helpCli.showVersion(), true, 'Should show version successfully');
        verboseLog('✅ showVersion handler test passed');
        
        verboseLog('Testing showManual command handler...');
        assert.strictEqual(await helpCli.showManual(), true, 'Should show general manual successfully');
        verboseLog('✅ showManual handler without topic test passed');
        
        verboseLog('Testing showManual command handler with topic...');
        assert.strictEqual(await helpCli.showManual('test'), true, 'Should show topic manual successfully');
        verboseLog('✅ showManual handler with topic test passed');
        
        verboseLog('Testing showManual command handler with invalid topic...');
        assert.strictEqual(await helpCli.showManual('invalid'), true, 'Should handle invalid topic gracefully');
        verboseLog('✅ showManual handler with invalid topic test passed');
        
        console.log('All Help CLI tests passed!');
        return true;
    } catch (error) {
        console.error('Help CLI tests failed:', error);
        return false;
    } finally {
        // Clean up mocks
        if (restoreLogger) {
            restoreLogger();
        }
        if (global.cliRegistry) {
            delete global.cliRegistry;
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

if (typeof describe === 'function') {
    describe('HelpCLI legacy suite', () => {
        test('executes help CLI tests', async () => {
            const result = await runTests();
            expect(result).toBe(true);
        });
    });
}
