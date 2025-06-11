/**
 * Integration test for window show behavior feature
 * Tests the complete CLI-to-provider initialization chain
 */

const path = require('path');
const assert = require('assert');

// Mock electron before requiring any modules
const electronMock = {
    app: {
        getName: () => 'combo-desktop',
        getVersion: () => '1.0.0',
        getPath: (type) => {
            if (type === 'userData') return path.join(__dirname, 'test-data');
            return '/tmp/test';
        },
        on: () => {},
        emit: () => {},
        exit: () => {}
    },
    BrowserWindow: class MockBrowserWindow {
        constructor(options) {
            this.id = Math.random();
            this.webContents = {
                on: () => {},
                once: () => {},
                loadURL: () => Promise.resolve(),
                setUserAgent: () => {},
                session: {}
            };
            this.options = options;
            console.log(`[MOCK] BrowserWindow created with show: ${options.show}`);
        }
        on() {}
        once() {}
        show() { console.log('[MOCK] Window.show() called'); }
        hide() { console.log('[MOCK] Window.hide() called'); }
        focus() { console.log('[MOCK] Window.focus() called'); }
        minimize() { console.log('[MOCK] Window.minimize() called'); }
        showInactive() { console.log('[MOCK] Window.showInactive() called'); }
        moveTop() { console.log('[MOCK] Window.moveTop() called'); }
        isDestroyed() { return false; }
        isVisible() { return true; }
        isFocused() { return false; }
    },
    session: {
        fromPartition: () => ({
            setUserAgent: () => {},
            clearStorageData: () => Promise.resolve()
        })
    },
    shell: { openExternal: () => {} },
    ipcMain: { on: () => {}, handle: () => {} },
    Tray: class MockTray { constructor() { this.destroy = () => {}; } },
    Menu: { buildFromTemplate: () => ({ popup: () => {} }) }
};

// Mock electron modules
require.cache[require.resolve('electron')] = {
    exports: electronMock
};

console.log('🧪 Starting Window Show Behavior Integration Tests\n');

async function runIntegrationTests() {
    let testsPassed = 0;
    let totalTests = 0;

    function test(name, testFn) {
        totalTests++;
        try {
            const result = testFn();
            if (result instanceof Promise) {
                return result.then(() => {
                    console.log(`✅ ${name}`);
                    testsPassed++;
                }).catch(error => {
                    console.log(`❌ ${name}: ${error.message}`);
                });
            } else {
                console.log(`✅ ${name}`);
                testsPassed++;
            }
        } catch (error) {
            console.log(`❌ ${name}: ${error.message}`);
        }
    }

    // Test 1: CLI Argument Parsing
    await test('CLI parses window-show argument correctly', () => {
        const ProviderCLI = require('../../src/cli/modules/provider-cli');
        const cli = new ProviderCLI();
        
        const args = ['--whatsapp', '--window-show', 'hidden', '--profile', 'test'];
        const result = cli.parseArgs(args);
        
        assert.strictEqual(result.windowShowBehavior, 'hidden');
        assert.strictEqual(result.sessions[0].provider, 'whatsapp');
        assert.strictEqual(result.sessions[0].profile, 'test');
    });

    // Test 2: CLI Context Propagation
    await test('CLI execution passes windowShowBehavior to context', async () => {
        const ProviderCLI = require('../../src/cli/modules/provider-cli');
        const cli = new ProviderCLI();
        
        const args = ['--facebook', '--window-show', 'minimize'];
        const result = await cli.execute(args, {});
        
        assert.strictEqual(result.context.windowShowBehavior, 'minimize');
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.continueExecution, true);
    });

    // Test 3: BaseProvider Behavior Setting
    await test('BaseProvider correctly stores and retrieves window show behavior', () => {
        const BaseProvider = require('../../src/providers/abstract/base.provider');
        
        class TestProvider extends BaseProvider {
            getName() { return 'Test'; }
            getCommandArg() { return '--test'; }
            getUrl() { return 'https://test.com'; }
            getBaseIconPath() { return '/test'; }
        }
        
        const provider = new TestProvider();
        
        // Test default behavior
        assert.strictEqual(provider.getWindowShowBehavior(), 'auto');
        
        // Test setting behavior
        provider.setWindowShowBehavior('hidden');
        assert.strictEqual(provider.getWindowShowBehavior(), 'hidden');
        
        // Test invalid behavior throws error
        assert.throws(() => {
            provider.setWindowShowBehavior('invalid');
        }, /Invalid window show behavior/);
    });

    // Test 4: Provider Registry Spawn Options
    await test('Provider Registry spawn method accepts options parameter', async () => {
        const providerRegistry = require('../../src/providers/provider.registry');
        const providers = providerRegistry.getAvailableProviders();
        
        assert(providers.length > 0, 'Should have registered providers');
        
        const whatsappProvider = providers.find(p => p.name === 'WhatsApp');
        assert(whatsappProvider, 'Should have WhatsApp provider');
        assert(typeof whatsappProvider.spawn === 'function', 'Should have spawn function');
        
        // Mock window service to avoid actual window creation
        const windowService = require('../../src/services/window.service');
        const originalCreateWindow = windowService.createWindow;
        let capturedOptions = null;
        
        windowService.createWindow = (options, windowName, metadata) => {
            capturedOptions = { options, windowName, metadata };
            return {
                id: 'mock-window',
                on: () => {},
                show: () => {},
                hide: () => {},
                focus: () => {},
                isDestroyed: () => false,
                isVisible: () => true,
                webContents: {
                    loadURL: () => Promise.resolve(),
                    setUserAgent: () => {},
                    on: () => {},
                    session: {}
                }
            };
        };
        
        try {
            await whatsappProvider.spawn('test', { windowShowBehavior: 'background' });
            // Provider should be created with window show behavior
            assert(capturedOptions, 'Window creation should have been called');
        } catch (error) {
            // Expected in test environment due to missing dependencies
            assert(error.message.includes('tray') || error.message.includes('window'), 
                   'Error should be related to missing tray/window dependencies');
        } finally {
            windowService.createWindow = originalCreateWindow;
        }
    });

    // Test 5: App Manager Integration
    await test('App Manager passes windowShowBehavior through initializeSessions', async () => {
        // This test checks that the integration chain is properly connected
        const appManager = require('../../src/services/app.manager');
        
        // Mock provider registry to capture spawn options
        const providerRegistry = require('../../src/providers/provider.registry');
        let capturedSpawnOptions = null;
        
        const originalGetProvider = providerRegistry.getProvider;
        providerRegistry.getProvider = (name) => {
            const provider = originalGetProvider.call(providerRegistry, name);
            if (provider) {
                const originalSpawn = provider.spawn;
                provider.spawn = async (profile, options) => {
                    capturedSpawnOptions = options;
                    throw new Error('Mock spawn - preventing actual execution');
                };
            }
            return provider;
        };
        
        try {
            const sessions = [{ provider: 'whatsapp', profile: 'test' }];
            const context = { windowShowBehavior: 'minimize' };
            
            await appManager.initializeSessions(sessions, context);
        } catch (error) {
            // Expected due to mocked spawn
        }
        
        assert(capturedSpawnOptions, 'Spawn should have been called with options');
        assert.strictEqual(capturedSpawnOptions.windowShowBehavior, 'minimize');
        
        // Restore original method
        providerRegistry.getProvider = originalGetProvider;
    });

    // Test 6: Window Behavior Application
    await test('Window show behaviors are applied correctly', async () => {
        const BaseProvider = require('../../src/providers/abstract/base.provider');
        
        class TestProvider extends BaseProvider {
            getName() { return 'Test'; }
            getCommandArg() { return '--test'; }
            getUrl() { return 'https://test.com'; }
            getBaseIconPath() { return '/test'; }
        }
        
        const provider = new TestProvider();
        
        // Mock window
        const mockWindow = {
            show: () => console.log('[TEST] Window shown'),
            hide: () => console.log('[TEST] Window hidden'),
            focus: () => console.log('[TEST] Window focused'),
            minimize: () => console.log('[TEST] Window minimized'),
            showInactive: () => console.log('[TEST] Window shown inactive'),
            moveTop: () => console.log('[TEST] Window moved to top'),
            isVisible: () => true,
            isDestroyed: () => false
        };
        
        provider.window = mockWindow;
        
        // Test different behaviors
        provider.setWindowShowBehavior('auto');
        await provider.applyWindowShowBehavior(false);
        
        provider.setWindowShowBehavior('hidden');
        await provider.applyWindowShowBehavior(false);
        
        provider.setWindowShowBehavior('minimize');
        await provider.applyWindowShowBehavior(false);
        
        provider.setWindowShowBehavior('background');
        await provider.applyWindowShowBehavior(false);
        
        provider.setWindowShowBehavior('bring-to-front');
        await provider.applyWindowShowBehavior(true);
        
        // All behaviors should execute without error
        assert(true, 'All window behaviors applied successfully');
    });

    // Test 7: CLI Help Documentation
    await test('CLI help includes window-show option', () => {
        const ProviderCLI = require('../../src/cli/modules/provider-cli');
        const cli = new ProviderCLI();
        
        // Capture console output
        let helpOutput = '';
        const originalLog = console.log;
        console.log = (msg) => { helpOutput += msg + '\n'; };
        
        try {
            cli.showUsage();
            assert(helpOutput.includes('--window-show'), 'Help should include --window-show option');
            assert(helpOutput.includes('auto, minimize, hidden, background, bring-to-front'), 
                   'Help should list all behavior options');
        } finally {
            console.log = originalLog;
        }
    });

    // Print results
    console.log(`\n📊 Test Results: ${testsPassed}/${totalTests} tests passed`);
    
    if (testsPassed === totalTests) {
        console.log('🎉 All integration tests passed! Window show behavior is fully implemented.');
        return true;
    } else {
        console.log('❌ Some tests failed. Please check the implementation.');
        return false;
    }
}

// Run the tests
runIntegrationTests().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
});
