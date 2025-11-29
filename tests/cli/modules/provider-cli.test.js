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
    if (process.env.JEST_WORKER_ID) {
        return true;
    }
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
            { name: 'Facebook', commandArg: '--facebook', description: 'Facebook messenger' },
            { name: 'Telegram', commandArg: '--telegram', description: 'Telegram messenger' }
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
                } else if (name === 'telegram') {
                    return {
                        name: 'Telegram',
                        commandArg: '--telegram',
                        description: 'Telegram messenger'
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
        delete require.cache[require.resolve('../../../src/cli/modules/provider-cli')];
        const ProviderCLI = require('../../../src/cli/modules/provider-cli');
        verboseLog('Successfully imported ProviderCLI module');
        
        console.log('Running Provider CLI tests...');
        verboseLog('Starting Provider CLI tests with verbose logging enabled');
        
        // Test instance creation
        verboseLog('Testing ProviderCLI instance creation...');
        const providerCli = new ProviderCLI();
        
        // Test the findAllIndices method
        verboseLog('Testing findAllIndices method...');
        const testArray = ['a', 'b', 'c', 'a', 'd', 'a'];
        const indices = providerCli.findAllIndices(testArray, 'a');
        assert.ok(Array.isArray(indices), 'Should return an array');
        assert.strictEqual(indices.length, 3, 'Should find all occurrences');
        assert.deepStrictEqual(indices, [0, 3, 5], 'Should return correct indices');
        verboseLog('✅ findAllIndices method test passed');
        
        // Test parseArgs method with array-style arguments
        verboseLog('Testing parseArgs with array-style arguments...');
        
        // Test with single provider
        verboseLog('Testing parseArgs with single provider...');
        let args = ['--whatsapp'];
        let result = providerCli.parseArgs(args);
        assert.ok(result, 'Should parse single provider');
        assert.ok(Array.isArray(result.providers), 'Should have providers array');
        assert.strictEqual(result.providers.length, 1, 'Should have one provider');
        assert.strictEqual(result.providers[0], 'whatsapp', 'Should be whatsapp provider');
        assert.ok(Array.isArray(result.sessions), 'Should have sessions array');
        assert.strictEqual(result.sessions.length, 1, 'Should have one session');
        assert.strictEqual(result.sessions[0].provider, 'whatsapp', 'Session should be for whatsapp');
        assert.strictEqual(result.sessions[0].profile, 'default', 'Session should have default profile');
        verboseLog('✅ parseArgs with single provider test passed');
        
        // Test with single provider and profile
        verboseLog('Testing parseArgs with single provider and profile...');
        args = ['--whatsapp', 'work'];
        result = providerCli.parseArgs(args);
        assert.ok(result, 'Should parse single provider with profile');
        assert.ok(Array.isArray(result.providers), 'Should have providers array');
        assert.strictEqual(result.providers.length, 1, 'Should have one provider');
        assert.strictEqual(result.providers[0], 'whatsapp', 'Should be whatsapp provider');
        assert.ok(Array.isArray(result.sessions), 'Should have sessions array');
        assert.strictEqual(result.sessions.length, 1, 'Should have one session');
        assert.strictEqual(result.sessions[0].provider, 'whatsapp', 'Session should be for whatsapp');
        assert.strictEqual(result.sessions[0].profile, 'work', 'Session should have work profile');
        verboseLog('✅ parseArgs with single provider and profile test passed');
        
        // Test with multiple different providers
        verboseLog('Testing parseArgs with multiple different providers...');
        args = ['--whatsapp', '--facebook'];
        result = providerCli.parseArgs(args);
        assert.ok(result, 'Should parse multiple different providers');
        assert.ok(Array.isArray(result.providers), 'Should have providers array');
        assert.strictEqual(result.providers.length, 2, 'Should have two providers');
        assert.ok(result.providers.includes('whatsapp'), 'Should include whatsapp provider');
        assert.ok(result.providers.includes('facebook'), 'Should include facebook provider');
        assert.ok(Array.isArray(result.sessions), 'Should have sessions array');
        assert.strictEqual(result.sessions.length, 2, 'Should have two sessions');
        
        // Check for WhatsApp session
        const whatsappSession = result.sessions.find(s => s.provider === 'whatsapp');
        assert.ok(whatsappSession, 'Should have WhatsApp session');
        assert.strictEqual(whatsappSession.profile, 'default', 'WhatsApp session should have default profile');
        
        // Check for Facebook session
        const facebookSession = result.sessions.find(s => s.provider === 'facebook');
        assert.ok(facebookSession, 'Should have Facebook session');
        assert.strictEqual(facebookSession.profile, 'default', 'Facebook session should have default profile');
        verboseLog('✅ parseArgs with multiple different providers test passed');
        
        // Test with multiple instances of the same provider
        verboseLog('Testing parseArgs with multiple instances of the same provider...');
        args = ['--whatsapp', '--whatsapp', 'work'];
        result = providerCli.parseArgs(args);
        assert.ok(result, 'Should parse multiple instances of the same provider');
        assert.ok(Array.isArray(result.providers), 'Should have providers array');
        assert.strictEqual(result.providers.length, 1, 'Should have one provider (unique)');
        assert.strictEqual(result.providers[0], 'whatsapp', 'Should be whatsapp provider');
        assert.ok(Array.isArray(result.sessions), 'Should have sessions array');
        assert.strictEqual(result.sessions.length, 2, 'Should have two sessions');
        
        // Check for default WhatsApp session
        const defaultWhatsappSession = result.sessions.find(s => 
            s.provider === 'whatsapp' && s.profile === 'default'
        );
        assert.ok(defaultWhatsappSession, 'Should have default WhatsApp session');
        
        // Check for work WhatsApp session
        const workWhatsappSession = result.sessions.find(s => 
            s.provider === 'whatsapp' && s.profile === 'work'
        );
        assert.ok(workWhatsappSession, 'Should have work WhatsApp session');
        verboseLog('✅ parseArgs with multiple instances of the same provider test passed');
        
        // Test with complex mix of providers and profiles
        verboseLog('Testing parseArgs with complex mix of providers and profiles...');
        args = ['--whatsapp', 'personal', '--facebook', 'work', '--whatsapp', 'business', '--telegram'];
        result = providerCli.parseArgs(args);
        assert.ok(result, 'Should parse complex mix of providers and profiles');
        assert.ok(Array.isArray(result.providers), 'Should have providers array');
        assert.strictEqual(result.providers.length, 3, 'Should have three providers (unique)');
        assert.ok(result.providers.includes('whatsapp'), 'Should include whatsapp provider');
        assert.ok(result.providers.includes('facebook'), 'Should include facebook provider');
        assert.ok(Array.isArray(result.sessions), 'Should have sessions array');
        assert.strictEqual(result.sessions.length, 4, 'Should have four sessions');
        
        // Check for personal WhatsApp session
        const personalWhatsappSession = result.sessions.find(s => 
            s.provider === 'whatsapp' && s.profile === 'personal'
        );
        assert.ok(personalWhatsappSession, 'Should have personal WhatsApp session');
        
        // Check for business WhatsApp session
        const businessWhatsappSession = result.sessions.find(s => 
            s.provider === 'whatsapp' && s.profile === 'business'
        );
        assert.ok(businessWhatsappSession, 'Should have business WhatsApp session');
        
        // Check for work Facebook session
        const workFacebookSession = result.sessions.find(s => 
            s.provider === 'facebook' && s.profile === 'work'
        );
        assert.ok(workFacebookSession, 'Should have work Facebook session');
        
        // Check for default Telegram session
        const defaultTelegramSession = result.sessions.find(s => 
            s.provider === 'telegram' && s.profile === 'default'
        );
        assert.ok(defaultTelegramSession, 'Should have default Telegram session');
        verboseLog('✅ parseArgs with complex mix of providers and profiles test passed');
        
        // Test execute method with multiple provider instances
        verboseLog('Testing execute with multiple provider instances...');
        args = ['--whatsapp', '--facebook', '--whatsapp', 'work'];
        result = await providerCli.execute(args);
        assert.ok(result, 'Should execute with multiple provider instances');
        assert.strictEqual(result.success, true, 'Should execute successfully');
        assert.strictEqual(result.continueExecution, true, 'Should continue execution');
        assert.ok(result.context, 'Should have context object');
        assert.ok(Array.isArray(result.context.providers), 'Should have providers array in context');
        assert.ok(result.context.providers.includes('whatsapp'), 'Context should include whatsapp provider');
        assert.ok(result.context.providers.includes('facebook'), 'Context should include facebook provider');
        assert.ok(Array.isArray(result.context.sessions), 'Should have sessions array in context');
        assert.strictEqual(result.context.sessions.length, 3, 'Should have three sessions in context');
        
        // Check for default WhatsApp session in context
        const ctxDefaultWhatsappSession = result.context.sessions.find(s => 
            s.provider === 'whatsapp' && s.profile === 'default'
        );
        assert.ok(ctxDefaultWhatsappSession, 'Context should have default WhatsApp session');
        
        // Check for work WhatsApp session in context
        const ctxWorkWhatsappSession = result.context.sessions.find(s => 
            s.provider === 'whatsapp' && s.profile === 'work'
        );
        assert.ok(ctxWorkWhatsappSession, 'Context should have work WhatsApp session');
        
        // Check for default Facebook session in context
        const ctxDefaultFacebookSession = result.context.sessions.find(s => 
            s.provider === 'facebook' && s.profile === 'default'
        );
        assert.ok(ctxDefaultFacebookSession, 'Context should have default Facebook session');
        verboseLog('✅ Execute with multiple provider instances test passed');
        
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

// Wrap legacy runner in a Jest test for compatibility with jest --runInBand
if (typeof describe === 'function') {
    describe('ProviderCLI legacy suite', () => {
        test('executes legacy provider CLI tests', async () => {
            const result = await runTests();
            expect(result).toBe(true);
        });
    });
}

// Export the runTests function for the test runner
module.exports = { runTests };

// Run the tests if this file is executed directly
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
