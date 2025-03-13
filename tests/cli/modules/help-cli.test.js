/**
 * @file Help CLI Module Tests
 * @description Functional tests for the Help CLI module
 */

const assert = require('assert');
const path = require('path');

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
    try {
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
        
        // Test parseArgs method with help command
        verboseLog('Testing parseArgs with help command...');
        let args = {
            help: true,
            _: ['help']
        };
        let result = await helpCli.parseArgs(args);
        assert.ok(result, 'Should parse help command');
        assert.strictEqual(result.command, 'help', 'Should identify help command');
        assert.ok(result.handler, 'Should have handler function');
        verboseLog('✅ Parse help command test passed');

        // Test parseArgs with version command
        verboseLog('Testing parseArgs with version command...');
        args = {
            help: true,  
            _: ['version']
        };
        result = await helpCli.parseArgs(args);
        assert.ok(result, 'Should parse version command');
        assert.strictEqual(result.command, 'version', 'Should identify version command');
        assert.ok(result.handler, 'Should have handler function');
        verboseLog('✅ Parse version command test passed');
        
        // Test parseArgs with manual command
        verboseLog('Testing parseArgs with manual command...');
        args = {
            help: true,  
            _: ['manual']
        };
        result = await helpCli.parseArgs(args);
        assert.ok(result, 'Should parse manual command');
        assert.strictEqual(result.command, 'manual', 'Should identify manual command');
        assert.ok(result.handler, 'Should have handler function');
        verboseLog('✅ Parse manual command test passed');
        
        // Test execute method with help command
        verboseLog('Testing execute with help command...');
        try {
            await helpCli.execute({
                command: 'help',
                handler: helpCli.commands.help,
                args: {}
            });
            verboseLog('✅ Execute help command test passed');
        } catch (error) {
            verboseLog(`❌ Execute help command test failed: ${error.message}`);
            throw new Error(`Error executing help command: ${error.message}`);
        }
        
        // Test execute method with version command
        verboseLog('Testing execute with version command...');
        try {
            await helpCli.execute({
                command: 'version',
                handler: helpCli.commands.version,
                args: {}
            });
            verboseLog('✅ Execute version command test passed');
        } catch (error) {
            verboseLog(`❌ Execute version command test failed: ${error.message}`);
            throw new Error(`Error executing version command: ${error.message}`);
        }
        
        // Test execute method with manual command
        verboseLog('Testing execute with manual command...');
        try {
            await helpCli.execute({
                command: 'manual',
                handler: helpCli.commands.manual,
                args: {}
            });
            verboseLog('✅ Execute manual command test passed');
        } catch (error) {
            verboseLog(`❌ Execute manual command test failed: ${error.message}`);
            throw new Error(`Error executing manual command: ${error.message}`);
        }
        
        // Test execute method with invalid command
        verboseLog('Testing execute with invalid command...');
        try {
            await helpCli.execute(null);
            assert.fail('Should throw error for invalid command');
        } catch (error) {
            assert.ok(error, 'Should have error for invalid command');
            verboseLog('✅ Execute invalid command test passed');
        }
        
        console.log('All Help CLI tests passed!');
        return true;
    } catch (error) {
        console.error('Help CLI tests failed:', error);
        return false;
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