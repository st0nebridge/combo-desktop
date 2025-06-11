#!/usr/bin/env node

/**
 * Real-world test of the tray exit behavior using actual code
 */

const path = require('path');

// Setup environment for testing
process.env.NODE_ENV = 'test';

// Mock electron to avoid GUI
const mockElectron = {
    app: {
        quit: () => {
            console.log('[MOCK] app.quit() called - would exit process');
            return true;
        },
        getPath: (name) => {
            if (name === 'userData') {
                return path.join(__dirname, 'test-data');
            }
            return path.join(__dirname, 'test-data');
        }
    },
    BrowserWindow: class MockBrowserWindow {
        constructor() {
            this.destroyed = false;
        }
        isDestroyed() { return this.destroyed; }
        close() { this.destroyed = true; }
        loadURL() { return Promise.resolve(); }
        webContents = {
            session: {
                clearStorageData: () => Promise.resolve()
            }
        };
    }
};

// Mock electron module
require.cache[require.resolve('electron')] = {
    exports: mockElectron
};

// Create test directory
const fs = require('fs');
const testDir = path.join(__dirname, 'test-data');
fs.mkdirSync(testDir, { recursive: true });

async function testRealProviderExitBehavior() {
    console.log('🧪 Testing Real Provider Exit Behavior');
    console.log('=====================================');
    
    try {
        // Import actual provider class
        const BaseProvider = require('./src/providers/abstract/base.provider.js');
        
        // Create a mock provider that extends BaseProvider
        class TestProvider extends BaseProvider {
            constructor(name, profile) {
                super(name || 'test-provider');
                this.profile = profile || 'default';
            }
            
            getSessionName() {
                return this.getName();
            }
            
            getName() {
                return 'testprovider';
            }
            
            getCommandArg() {
                return '--testprovider';
            }
        }
        
        console.log('\n--- Creating first instance ---');
        const provider1 = new TestProvider('testprovider', 'default');
        
        // Register a session manually to simulate the normal flow
        const instanceManager = require('./src/services/instance.manager.js');
        await instanceManager.registerSession('testprovider', 'default');
        
        console.log(`Sessions after registration: ${instanceManager.getSessionCount()}`);
        
        console.log('\n--- Simulating tray exit click ---');
        const quitMenuItem = provider1.getQuitMenuItem();
        
        // Call the click handler
        await quitMenuItem.click();
        
        console.log(`Sessions after quit: ${instanceManager.getSessionCount()}`);
        
    } catch (error) {
        console.error('Error in test:', error);
        console.error('Stack:', error.stack);
    }
}

async function testMultiInstanceScenario() {
    console.log('\n🧪 Testing Multi-Instance Scenario');
    console.log('===================================');
    
    try {
        // First, reset the instance manager state
        const instanceManager = require('./src/services/instance.manager.js');
        instanceManager.providerSessions.clear();
        
        // Register sessions for different profiles
        await instanceManager.registerSession('whatsapp', 'default');
        await instanceManager.registerSession('telegram', 'work');
        
        console.log(`Total sessions: ${instanceManager.getSessionCount()}`);
        
        // Import actual provider class
        const BaseProvider = require('./src/providers/abstract/base.provider.js');
        
        class TestTelegramProvider extends BaseProvider {
            constructor() {
                super('telegram');
                this.profile = 'work';
            }
            
            getSessionName() {
                return 'telegram';
            }
            
            getName() {
                return 'telegram';
            }
            
            getCommandArg() {
                return '--telegram';
            }
        }
        
        console.log('\n--- Creating telegram provider ---');
        const telegramProvider = new TestTelegramProvider();
        
        console.log('\n--- Simulating tray exit for telegram:work ---');
        const quitMenuItem = telegramProvider.getQuitMenuItem();
        
        // Call the click handler
        await quitMenuItem.click();
        
        console.log(`Sessions after telegram quit: ${instanceManager.getSessionCount()}`);
        
    } catch (error) {
        console.error('Error in multi-instance test:', error);
        console.error('Stack:', error.stack);
    }
}

async function main() {
    console.log('Real Provider Tray Exit Behavior Test');
    console.log('====================================\n');
    
    try {
        await testRealProviderExitBehavior();
        await testMultiInstanceScenario();
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        // Cleanup
        try {
            const testDir = path.join(__dirname, 'test-data');
            if (fs.existsSync(testDir)) {
                fs.rmSync(testDir, { recursive: true, force: true });
            }
        } catch (error) {
            console.warn('Cleanup warning:', error.message);
        }
    }
    
    console.log('\n✅ Test completed');
}

if (require.main === module) {
    main().catch(console.error);
}
