/**
 * Test script to validate the new tray exit behavior with separate Close Instance and Quit Application options
 */

const path = require('path');
const { EventEmitter } = require('events');

// Mock Electron components
global.mockWindowManager = new Map();

// Mock Window class
class MockWindow extends EventEmitter {
    constructor(options = {}) {
        super();
        this.id = options.id || Math.random().toString(36).substr(2, 9);
        this.metadata = options.metadata || {};
        this._destroyed = false;
        console.log(`[WINDOW] Created window ${this.id}`);
    }

    isDestroyed() {
        return this._destroyed;
    }

    close() {
        this._destroyed = true;
        this.emit('closed');
        console.log(`[WINDOW] Closed window ${this.id}`);
    }

    setTitle(title) {
        this.title = title;
    }

    show() {
        console.log(`[WINDOW] Showing window ${this.id}`);
    }

    hide() {
        console.log(`[WINDOW] Hiding window ${this.id}`);
    }

    focus() {
        console.log(`[WINDOW] Focusing window ${this.id}`);
    }

    loadURL(url) {
        this.url = url;
    }
}

// Mock Tray class
class MockTray {
    constructor(iconPath) {
        this.iconPath = iconPath;
        this.contextMenu = null;
        console.log(`[TRAY] Created mock tray with icon: ${iconPath}`);
    }

    setContextMenu(menu) {
        this.contextMenu = menu;
    }

    destroy() {
        console.log(`[TRAY] Destroyed tray`);
    }

    isDestroyed() {
        return false;
    }
}

// Mock MenuItem class
class MockMenuItem {
    constructor(options) {
        this.label = options.label;
        this.click = options.click;
        this.type = options.type || 'normal';
        this.enabled = options.enabled !== false;
    }
}

// Mock Menu class
class MockMenu {
    static buildFromTemplate(template) {
        const menu = new MockMenu();
        menu.items = template.map(item => new MockMenuItem(item));
        return menu;
    }
}

// Mock electron module
const electronMock = {
    BrowserWindow: MockWindow,
    Tray: MockTray,
    Menu: MockMenu,
    MenuItem: MockMenuItem,
    app: {
        getPath: (name) => {
            if (name === 'userData') return '/mock/userData';
            return '/mock/path';
        },
        quit: () => {
            console.log('[APP] 🚪 Application quit called - would exit entire process');
        }
    },
    nativeImage: {
        createFromPath: (path) => ({ path })
    },
    nativeTheme: {
        shouldUseDarkColors: false
    }
};

// Mock require for electron
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(...args) {
    if (args[0] === 'electron') {
        return electronMock;
    }
    return originalRequire.apply(this, args);
};

async function testNewTrayBehavior() {
    console.log('=== TESTING NEW TRAY EXIT BEHAVIOR ===');
    console.log('Testing Close Instance vs Quit Application functionality\n');
    
    try {
        // Clear require cache for fresh instances
        delete require.cache[require.resolve('./src/services/instance.manager.js')];
        delete require.cache[require.resolve('./src/providers/abstract/base.provider.js')];
        
        const instanceManager = require('./src/services/instance.manager.js');
        
        // Create mock providers that extend the base provider for testing
        const BaseProvider = require('./src/providers/abstract/base.provider.js');
        
        class MockWhatsAppProvider extends BaseProvider {
            constructor() {
                super();
                this.profile = 'default';
            }
            
            getName() {
                return 'whatsapp';
            }
            
            getSessionName() {
                return 'whatsapp';
            }
            
            getCommandArg() {
                return '--whatsapp';
            }
            
            getUrl() {
                return 'https://web.whatsapp.com';
            }
            
            getTrayIcon() {
                return {
                    image: path.join(__dirname, 'assets', 'whatsapp.ico')
                };
            }
        }
        
        class MockFacebookProvider extends BaseProvider {
            constructor() {
                super();
                this.profile = 'default';
            }
            
            getName() {
                return 'facebook';
            }
            
            getSessionName() {
                return 'facebook';
            }
            
            getCommandArg() {
                return '--facebook';
            }
            
            getUrl() {
                return 'https://messenger.com';
            }
            
            getTrayIcon() {
                return {
                    image: path.join(__dirname, 'assets', 'facebook.ico')
                };
            }
        }
        
        console.log('Step 1: Creating providers and registering sessions...');
        const whatsappProvider = new MockWhatsAppProvider();
        const facebookProvider = new MockFacebookProvider();
        
        // Register sessions
        await instanceManager.registerSession('whatsapp', 'default');
        await instanceManager.registerSession('facebook', 'default');
        
        console.log(`Session count after registration: ${instanceManager.getSessionCount()}`);
        console.log(`Active sessions: ${Array.from(instanceManager.providerSessions.keys()).join(', ')}\n`);
        
        console.log('Step 2: Testing WhatsApp context menu...');
        const whatsappMenu = whatsappProvider.getContextMenuOptions();
        console.log('WhatsApp menu items:');
        whatsappMenu.forEach((item, index) => {
            if (item.type === 'separator') {
                console.log(`  ${index}: [separator]`);
            } else {
                console.log(`  ${index}: ${item.label}`);
            }
        });
        
        console.log('\nStep 3: Testing "Close Instance" behavior...');
        const closeInstanceItem = whatsappMenu.find(item => item.label === 'Close Instance');
        if (closeInstanceItem) {
            console.log('>>> Clicking "Close Instance" for WhatsApp...');
            await closeInstanceItem.click();
            console.log(`Session count after WhatsApp close: ${instanceManager.getSessionCount()}`);
            console.log(`Remaining sessions: ${Array.from(instanceManager.providerSessions.keys()).join(', ')}\n`);
        } else {
            console.log('❌ Close Instance menu item not found!\n');
        }
        
        console.log('Step 4: Testing Facebook context menu...');
        const facebookMenu = facebookProvider.getContextMenuOptions();
        console.log('Facebook menu items:');
        facebookMenu.forEach((item, index) => {
            if (item.type === 'separator') {
                console.log(`  ${index}: [separator]`);
            } else {
                console.log(`  ${index}: ${item.label}`);
            }
        });
        
        console.log('\nStep 5: Testing "Close Instance" for Facebook (should NOT quit app)...');
        const facebookCloseItem = facebookMenu.find(item => item.label === 'Close Instance');
        if (facebookCloseItem) {
            console.log('>>> Clicking "Close Instance" for Facebook...');
            await facebookCloseItem.click();
            console.log(`Session count after Facebook close: ${instanceManager.getSessionCount()}`);
            console.log(`Remaining sessions: ${Array.from(instanceManager.providerSessions.keys()).join(', ')}\n`);
        } else {
            console.log('❌ Close Instance menu item not found!\n');
        }
        
        console.log('Step 6: Testing "Quit Application" behavior...');
        const quitAppItem = facebookMenu.find(item => item.label === 'Quit Application');
        if (quitAppItem) {
            console.log('>>> Clicking "Quit Application"...');
            await quitAppItem.click();
        } else {
            console.log('❌ Quit Application menu item not found!\n');
        }
        
        console.log('✅ Test completed successfully!');
        console.log('\nExpected behavior:');
        console.log('1. Close Instance should only remove the specific provider');
        console.log('2. Close Instance should NOT quit the application');
        console.log('3. Quit Application should always quit the application');
        
    } catch (error) {
        console.error('❌ Error in test:', error);
        console.error('Stack:', error.stack);
    }
}

// Run the test
testNewTrayBehavior().catch(console.error);
