/**
 * @file Provider CLI Module Tests
 * @description Functional tests for the Provider CLI module
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
 * Test the Provider CLI module functionality
 * @returns {Promise<boolean>} True if all tests pass
 */
async function runTests() {
    let restoreProviderRegistry;
    let restoreAppManager;
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
            },
            initializeLogging: () => {
                verboseLog('Logger.initializeLogging: Initializing logging');
            }
        });
        verboseLog('Successfully mocked logger');
        
        // Mock provider registry - do this before importing the ProviderCLI
        verboseLog('Setting up provider registry mock');
        const mockProviders = [
            { name: 'WhatsApp', commandArg: '--whatsapp', description: 'WhatsApp messenger' },
            { name: 'Facebook', commandArg: '--facebook', description: 'Facebook messenger' }
        ];
        
        const providerRegistryPath = path.resolve(__dirname, '../../../src/providers');
        restoreProviderRegistry = mockService(providerRegistryPath, {
            getAvailableProviders: () => {
                verboseLog('Mock: Getting available providers');
                return mockProviders;
            },
            getProvider: (name) => {
                verboseLog(`Mock: Getting provider ${name}`);
                if (name === 'whatsapp') {
                    return {
                        name: 'WhatsApp',
                        commandArg: '--whatsapp',
                        description: 'WhatsApp messenger'
                    };
                } else if (name === 'facebook') {
                    return {
                        name: 'Facebook',
                        commandArg: '--facebook',
                        description: 'Facebook messenger'
                    };
                }
                return null;
            }
        });
        verboseLog('Successfully mocked provider registry');
        
        // Mock app manager
        verboseLog('Setting up app manager mock');
        const appManagerPath = path.resolve(__dirname, '../../../src/services/app.manager');
        restoreAppManager = mockService(appManagerPath, {
            installProvider: async (name, options) => {
                verboseLog(`Mock: Installing provider ${name}`);
                return true;
            },
            uninstallProvider: async (name) => {
                verboseLog(`Mock: Uninstalling provider ${name}`);
                return true;
            },
            getProviderStatus: async (name) => {
                verboseLog(`Mock: Getting status for provider ${name}`);
                return { status: 'running', version: '1.0.0' };
            },
            initProvider: async (provider, options) => {
                verboseLog(`Mock: Initializing provider ${provider.name}`);
                return true;
            },
            stopProvider: async (name) => {
                verboseLog(`Mock: Stopping provider ${name}`);
                return true;
            },
            restartProvider: async (name) => {
                verboseLog(`Mock: Restarting provider ${name}`);
                return true;
            }
        });
        verboseLog('Successfully mocked app manager');
        
        // Now import the module to test after mocking its dependencies
        const ProviderCLI = require('../../../src/cli/modules/provider-cli');
        verboseLog('Successfully imported ProviderCLI module');
        
        console.log('Running Provider CLI tests...');
        verboseLog('Starting Provider CLI tests with verbose logging enabled');
        
        // Test instance creation and command mapping
        verboseLog('Testing ProviderCLI instance creation...');
        const providerCli = new ProviderCLI();
        
        // Override the listProviders method for testing
        providerCli.listProviders = async () => {
            verboseLog('Mock: Listing providers');
            console.log('\nAvailable Providers:');
            console.log('  - WhatsApp');
            console.log('    WhatsApp messenger');
            console.log('  - Facebook');
            console.log('    Facebook messenger');
            console.log();
            return true;
        };
        
        // Override other methods for testing
        providerCli.getStatus = async () => {
            verboseLog('Mock: Getting provider status');
            return true;
        };
        
        providerCli.stopProvider = async () => {
            verboseLog('Mock: Stopping provider');
            return true;
        };
        
        providerCli.restartProvider = async () => {
            verboseLog('Mock: Restarting provider');
            return true;
        };
        
        assert.ok(providerCli, 'Should create ProviderCLI instance');
        assert.ok(providerCli.commands, 'Should have commands object');
        assert.ok(typeof providerCli.commands.list === 'function', 'Should have list command');
        assert.ok(typeof providerCli.commands.status === 'function', 'Should have status command');
        assert.ok(typeof providerCli.commands.stop === 'function', 'Should have stop command');
        assert.ok(typeof providerCli.commands.restart === 'function', 'Should have restart command');
        assert.ok(typeof providerCli.commands.whatsapp === 'function', 'Should have whatsapp command');
        assert.ok(typeof providerCli.commands.facebook === 'function', 'Should have facebook command');
        verboseLog('✅ ProviderCLI instance creation test passed');
        
        // Test parseArgs method with list command
        verboseLog('Testing parseArgs with list command...');
        let args = {
            provider: true,  // This is the entry flag that must be present (singular, not plural)
            _: ['list']
        };
        let result = await providerCli.parseArgs(args);
        assert.ok(result, 'Should parse list command');
        assert.strictEqual(result.command, 'list', 'Should identify list command');
        assert.ok(result.handler, 'Should have handler function');
        verboseLog('✅ Parse list command test passed');

        // Test parseArgs with status command
        verboseLog('Testing parseArgs with status command...');
        args = {
            provider: true,  // This is the entry flag that must be present (singular, not plural)
            _: ['status']
        };
        result = await providerCli.parseArgs(args);
        assert.ok(result, 'Should parse status command');
        assert.strictEqual(result.command, 'status', 'Should identify status command');
        assert.ok(result.handler, 'Should have handler function');
        verboseLog('✅ Parse status command test passed');
        
        // Test parseArgs with stop command
        verboseLog('Testing parseArgs with stop command...');
        args = {
            provider: true,  // This is the entry flag that must be present (singular, not plural)
            _: ['stop'],
            name: 'whatsapp'
        };
        result = await providerCli.parseArgs(args);
        assert.ok(result, 'Should parse stop command');
        assert.strictEqual(result.command, 'stop', 'Should identify stop command');
        assert.ok(result.handler, 'Should have handler function');
        assert.strictEqual(result.name, 'whatsapp', 'Should capture provider name');
        verboseLog('✅ Parse stop command test passed');
        
        // Test parseArgs with restart command
        verboseLog('Testing parseArgs with restart command...');
        args = {
            provider: true,  // This is the entry flag that must be present (singular, not plural)
            _: ['restart'],
            name: 'facebook'
        };
        result = await providerCli.parseArgs(args);
        assert.ok(result, 'Should parse restart command');
        assert.strictEqual(result.command, 'restart', 'Should identify restart command');
        assert.ok(result.handler, 'Should have handler function');
        assert.strictEqual(result.name, 'facebook', 'Should capture provider name');
        verboseLog('✅ Parse restart command test passed');
        
        // Test parseArgs with direct provider command
        verboseLog('Testing parseArgs with direct provider command...');
        args = {
            whatsapp: true,
            _: []
        };
        result = await providerCli.parseArgs(args);
        assert.ok(result, 'Should parse direct provider command');
        assert.strictEqual(result.command, 'whatsapp', 'Should identify whatsapp command');
        assert.ok(result.handler, 'Should have handler function');
        verboseLog('✅ Parse direct provider command test passed');
        
        // Test parseArgs with direct provider command and profile
        verboseLog('Testing parseArgs with direct provider command and profile...');
        args = {
            facebook: true,
            profile: 'work',
            _: []
        };
        result = await providerCli.parseArgs(args);
        assert.ok(result, 'Should parse direct provider command with profile');
        assert.strictEqual(result.command, 'facebook', 'Should identify facebook command');
        assert.ok(result.handler, 'Should have handler function');
        assert.strictEqual(result.profile, 'work', 'Should capture profile name');
        verboseLog('✅ Parse direct provider command with profile test passed');
        
        // Test execute method with list command
        verboseLog('Testing execute with list command...');
        args = ['--provider', 'list'];
        result = await providerCli.execute(args);
        assert.ok(result, 'Should execute list command');
        assert.strictEqual(result.success, true, 'Should execute successfully');
        assert.strictEqual(result.continueExecution, false, 'Should not continue execution');
        verboseLog('✅ Execute list command test passed');
        
        // Test execute method with direct provider
        verboseLog('Testing execute with direct provider...');
        args = ['--whatsapp'];
        result = await providerCli.execute(args);
        assert.ok(result, 'Should execute direct provider command');
        assert.strictEqual(result.success, true, 'Should execute successfully');
        assert.strictEqual(result.continueExecution, true, 'Should continue execution');
        assert.ok(result.context, 'Should have context object');
        assert.ok(Array.isArray(result.context.providers), 'Should have providers array');
        assert.ok(result.context.providers.includes('whatsapp'), 'Should include whatsapp in providers');
        verboseLog('✅ Execute direct provider command test passed');
        
        // Test execute method with direct provider and profile
        verboseLog('Testing execute with direct provider and profile...');
        args = ['--facebook', 'work'];
        result = await providerCli.execute(args);
        assert.ok(result, 'Should execute direct provider command with profile');
        assert.strictEqual(result.success, true, 'Should execute successfully');
        assert.strictEqual(result.continueExecution, true, 'Should continue execution');
        assert.ok(result.context, 'Should have context object');
        assert.ok(Array.isArray(result.context.providers), 'Should have providers array');
        assert.ok(result.context.providers.includes('facebook'), 'Should include facebook in providers');
        assert.ok(Array.isArray(result.context.sessions), 'Should have sessions array');
        assert.strictEqual(result.context.sessions.length, 1, 'Should have one session');
        assert.strictEqual(result.context.sessions[0].provider, 'facebook', 'Session should be for facebook');
        assert.strictEqual(result.context.sessions[0].profile, 'work', 'Session should have work profile');
        verboseLog('✅ Execute direct provider command with profile test passed');
        
        // Test multiple provider instances
        verboseLog('Testing multiple provider instances...');
        args = ['--whatsapp', '--facebook', '--whatsapp', 'work'];
        result = await providerCli.execute(args);
        assert.ok(result, 'Should execute multiple provider instances');
        assert.strictEqual(result.success, true, 'Should execute successfully');
        assert.strictEqual(result.continueExecution, true, 'Should continue execution');
        assert.ok(result.context, 'Should have context object');
        assert.ok(Array.isArray(result.context.providers), 'Should have providers array');
        assert.ok(result.context.providers.includes('whatsapp'), 'Should include whatsapp in providers');
        assert.ok(result.context.providers.includes('facebook'), 'Should include facebook in providers');
        assert.ok(Array.isArray(result.context.sessions), 'Should have sessions array');
        assert.strictEqual(result.context.sessions.length, 3, 'Should have three sessions');
        
        // Check for default WhatsApp session
        const defaultWhatsappSession = result.context.sessions.find(
            s => s.provider === 'whatsapp' && s.profile === 'default'
        );
        assert.ok(defaultWhatsappSession, 'Should have default WhatsApp session');
        
        // Check for work WhatsApp session
        const workWhatsappSession = result.context.sessions.find(
            s => s.provider === 'whatsapp' && s.profile === 'work'
        );
        assert.ok(workWhatsappSession, 'Should have work WhatsApp session');
        
        // Check for default Facebook session
        const defaultFacebookSession = result.context.sessions.find(
            s => s.provider === 'facebook' && s.profile === 'default'
        );
        assert.ok(defaultFacebookSession, 'Should have default Facebook session');
        verboseLog('✅ Multiple provider instances test passed');
        
        // Test multiple provider instances with different profiles
        verboseLog('Testing multiple provider instances with different profiles...');
        args = ['--whatsapp', 'personal', '--facebook', 'work', '--whatsapp', 'business'];
        result = await providerCli.execute(args);
        assert.ok(result, 'Should execute multiple provider instances with different profiles');
        assert.strictEqual(result.success, true, 'Should execute successfully');
        assert.strictEqual(result.continueExecution, true, 'Should continue execution');
        assert.ok(result.context, 'Should have context object');
        assert.ok(Array.isArray(result.context.providers), 'Should have providers array');
        assert.ok(result.context.providers.includes('whatsapp'), 'Should include whatsapp in providers');
        assert.ok(result.context.providers.includes('facebook'), 'Should include facebook in providers');
        assert.ok(Array.isArray(result.context.sessions), 'Should have sessions array');
        assert.strictEqual(result.context.sessions.length, 3, 'Should have three sessions');
        
        // Check for personal WhatsApp session
        const personalWhatsappSession = result.context.sessions.find(
            s => s.provider === 'whatsapp' && s.profile === 'personal'
        );
        assert.ok(personalWhatsappSession, 'Should have personal WhatsApp session');
        
        // Check for business WhatsApp session
        const businessWhatsappSession = result.context.sessions.find(
            s => s.provider === 'whatsapp' && s.profile === 'business'
        );
        assert.ok(businessWhatsappSession, 'Should have business WhatsApp session');
        
        // Check for work Facebook session
        const workFacebookSession = result.context.sessions.find(
            s => s.provider === 'facebook' && s.profile === 'work'
        );
        assert.ok(workFacebookSession, 'Should have work Facebook session');
        verboseLog('✅ Multiple provider instances with different profiles test passed');
        
        console.log('✅ All Provider CLI tests passed!');
        return true;
    } catch (error) {
        console.error('❌ Provider CLI test failed:', error);
        return false;
    } finally {
        // Restore original modules
        if (restoreProviderRegistry) {
            verboseLog('Restoring provider registry');
            restoreProviderRegistry();
        }
        if (restoreAppManager) {
            verboseLog('Restoring app manager');
            restoreAppManager();
        }
        if (restoreLogger) {
            verboseLog('Restoring logger');
            restoreLogger();
        }
    }
}

// Add handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit the process as we're handling it
});

// Run the tests
runTests()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Error running tests:', error);
        process.exit(1);
    });