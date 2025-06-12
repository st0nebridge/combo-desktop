/**
 * Debug script to understand session state issues in tray quit behavior
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

// Mock path.resolve
const originalResolve = path.resolve;
path.resolve = (...args) => {
    if (args.some(arg => arg && arg.includes('icon'))) {
        return '/mock/icon/path.ico';
    }
    return originalResolve(...args);
};

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
            console.log('[APP] Application quit called');
        }
    },
    nativeImage: {
        createFromPath: (path) => ({ path })
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

async function debugSessionState() {
    console.log('=== DEBUGGING SESSION STATE ===');
    
    try {
        // Clear require cache for fresh instances
        delete require.cache[require.resolve('./src/services/instance.manager.js')];
        delete require.cache[require.resolve('./src/providers/abstract/base.provider.js')];
        delete require.cache[require.resolve('./src/providers/modules/whatsapp.provider.js')];
        delete require.cache[require.resolve('./src/providers/modules/facebook.provider.js')];
        
        const instanceManager = require('./src/services/instance.manager.js');
        const WhatsAppProvider = require('./src/providers/modules/whatsapp.provider.js');
        const FacebookProvider = require('./src/providers/modules/facebook.provider.js');
        
        console.log('\nStep 1: Creating WhatsApp provider...');
        const whatsappProvider = new WhatsAppProvider('default');
        await whatsappProvider.initialize();
        
        console.log(`Session count after WhatsApp: ${instanceManager.getSessionCount()}`);
        console.log(`Sessions: ${Array.from(instanceManager.providerSessions.keys()).join(', ')}`);
        
        console.log('\nStep 2: Creating Facebook provider...');
        const facebookProvider = new FacebookProvider('default');
        await facebookProvider.initialize();
        
        console.log(`Session count after Facebook: ${instanceManager.getSessionCount()}`);
        console.log(`Sessions: ${Array.from(instanceManager.providerSessions.keys()).join(', ')}`);
        
        console.log('\nStep 3: Getting quit handlers...');
        const whatsappQuitHandler = whatsappProvider.getQuitMenuItem();
        const facebookQuitHandler = facebookProvider.getQuitMenuItem();
        
        console.log('\nStep 4: Executing WhatsApp quit...');
        console.log('Before WhatsApp quit:');
        console.log(`  Session count: ${instanceManager.getSessionCount()}`);
        console.log(`  Sessions: ${Array.from(instanceManager.providerSessions.keys()).join(', ')}`);
        
        // Execute WhatsApp quit
        await new Promise((resolve) => {
            const originalClick = whatsappQuitHandler.click;
            whatsappQuitHandler.click = async () => {
                await originalClick();
                resolve();
            };
            whatsappQuitHandler.click();
        });
        
        console.log('After WhatsApp quit:');
        console.log(`  Session count: ${instanceManager.getSessionCount()}`);
        console.log(`  Sessions: ${Array.from(instanceManager.providerSessions.keys()).join(', ')}`);
        
        console.log('\nStep 5: Checking Facebook provider state...');
        console.log(`  Facebook provider still exists: ${facebookProvider !== null}`);
        console.log(`  Facebook session name: ${facebookProvider.getSessionName()}`);
        console.log(`  Facebook profile: ${facebookProvider.profile}`);
        
        console.log('\nStep 6: Executing Facebook quit...');
        console.log('Before Facebook quit:');
        console.log(`  Session count: ${instanceManager.getSessionCount()}`);
        console.log(`  Sessions: ${Array.from(instanceManager.providerSessions.keys()).join(', ')}`);
        
        // Execute Facebook quit
        await new Promise((resolve) => {
            const originalClick = facebookQuitHandler.click;
            facebookQuitHandler.click = async () => {
                await originalClick();
                resolve();
            };
            facebookQuitHandler.click();
        });
        
        console.log('After Facebook quit:');
        console.log(`  Session count: ${instanceManager.getSessionCount()}`);
        console.log(`  Sessions: ${Array.from(instanceManager.providerSessions.keys()).join(', ')}`);
        
    } catch (error) {
        console.error('Error in debug session state:', error);
    }
}

// Run the test
debugSessionState().catch(console.error);
