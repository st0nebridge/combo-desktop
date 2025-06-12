#!/usr/bin/env node

/**
 * Debug script to trace window and tray creation during delegation
 * This will specifically track what happens when Facebook delegates to WhatsApp
 */

const path = require('path');

// Setup test environment
process.env.NODE_ENV = 'test';

// Mock electron to track window and tray creation
const mockElectron = {
    app: {
        getPath: (name) => {
            if (name === 'userData') {
                return path.join(__dirname, 'temp-userdata');
            }
            return path.join(__dirname, 'temp-data');
        },
        quit: () => {
            console.log('[APP] 🚪 app.quit() called');
            return true;
        }
    },
    BrowserWindow: class MockBrowserWindow {
        constructor(options) {
            this.metadata = options.metadata || {};
            this.destroyed = false;
            this.options = options;
            this.webContents = {
                setUserAgent: () => {},
                loadURL: () => Promise.resolve(),
                executeJavaScript: () => Promise.resolve(),
                on: () => {},
                session: {
                    setPermissionRequestHandler: () => {},
                    on: () => {}
                }
            };
            
            const windowName = this.metadata.windowName || 'unknown';
            console.log(`[WINDOW-CREATE] 🪟 Created BrowserWindow for ${windowName}`);
            console.log(`[WINDOW-CREATE]    Provider: ${this.metadata.provider?.getName() || 'unknown'}`);
            console.log(`[WINDOW-CREATE]    Profile: ${this.metadata.provider?.profile || 'unknown'}`);
        }
        close() { 
            console.log(`[WINDOW-CLOSE] 🔒 Window ${this.metadata.windowName || 'unknown'} closed`); 
            this.destroyed = true;
        }
        isDestroyed() { return this.destroyed; }
        destroy() { 
            console.log(`[WINDOW-DESTROY] 💥 Window ${this.metadata.windowName || 'unknown'} destroyed`); 
            this.destroyed = true; 
        }
        show() { console.log(`[WINDOW-SHOW] 👁️ Window ${this.metadata.windowName || 'unknown'} shown`); }
        hide() { console.log(`[WINDOW-HIDE] 🙈 Window ${this.metadata.windowName || 'unknown'} hidden`); }
        minimize() { console.log(`[WINDOW-MIN] ⬇️ Window ${this.metadata.windowName || 'unknown'} minimized`); }
        restore() { console.log(`[WINDOW-RESTORE] ⬆️ Window ${this.metadata.windowName || 'unknown'} restored`); }
        focus() { console.log(`[WINDOW-FOCUS] 🎯 Window ${this.metadata.windowName || 'unknown'} focused`); }
        on() {}
        once() {}
        setMenu() {}
        webContents = this.webContents;
    },
    Tray: class MockTray {
        constructor(iconPath) {
            this.iconPath = iconPath;
            console.log(`[TRAY-CREATE] 🖼️ Created Tray with icon: ${iconPath}`);
        }
        setContextMenu(menu) { 
            const menuItems = menu?.items?.length || 0;
            console.log(`[TRAY-MENU] 📋 Set context menu with ${menuItems} items`); 
        }
        destroy() { 
            console.log(`[TRAY-DESTROY] 💥 Tray destroyed`); 
        }
        isDestroyed() { return false; }
        setToolTip(tooltip) {
            console.log(`[TRAY-TOOLTIP] 💬 Set tooltip: ${tooltip}`);
        }
        on() {}
    },
    Menu: {
        buildFromTemplate: (template) => {
            return {
                items: template.map(item => ({
                    label: item.label,
                    click: item.click,
                    type: item.type || 'normal'
                }))
            };
        }
    },
    nativeImage: {
        createFromPath: (path) => ({ path })
    }
};

// Override the electron module
require.cache[require.resolve('electron')] = {
    exports: mockElectron
};

// Create temp directory
const fs = require('fs');
const tempUserData = path.join(__dirname, 'temp-userdata');
if (!fs.existsSync(tempUserData)) {
    fs.mkdirSync(tempUserData, { recursive: true });
}

class WindowTrayDebugger {
    constructor() {
        this.debug = true;
    }

    log(message) {
        console.log(`[DEBUG] ${message}`);
    }

    async simulateDelegationFlow() {
        this.log('🔄 Starting window/tray creation debugging...');
        this.log('');

        try {
            // Initialize the main services
            this.log('Step 1: Initializing services...');
            const instanceManager = require('./src/services/instance.manager');
            await instanceManager.init({ profile: 'default', profileIsolation: true });
            
            this.log('Step 2: Registering WhatsApp session (original instance)...');
            const WhatsAppProvider = require('./src/providers/modules/whatsapp.provider');
            const whatsappProvider = new WhatsAppProvider('default');
            await instanceManager.registerSession(whatsappProvider);
            
            this.log('Step 3: Simulating Facebook delegation...');
            const FacebookProvider = require('./src/providers/modules/facebook.provider');
            const facebookProvider = new FacebookProvider('default');
            await instanceManager.registerSession(facebookProvider);
            
            this.log('');
            this.log('🔍 Checking what was actually created...');
            
            // Check window service state
            const windowService = require('./src/services/window.service');
            this.log(`Windows registered: ${windowService.windows.size}`);
            for (const [windowName, window] of windowService.windows.entries()) {
                this.log(`  - ${windowName}: ${window.isDestroyed() ? 'destroyed' : 'alive'}`);
            }
            
            // Check tray service state
            const trayService = require('./src/services/tray.service');
            this.log(`Trays registered: ${trayService.trays.size}`);
            for (const [windowName, trayInfo] of trayService.trays.entries()) {
                this.log(`  - ${windowName}: provider=${trayInfo.provider.getName()}`);
            }
            
            this.log('');
            this.log('Step 4: Testing Close Instance functionality...');
            
            // Test WhatsApp close
            this.log('Testing WhatsApp Close Instance...');
            const whatsappWindowName = whatsappProvider.getWindowName('default');
            const whatsappWindow = windowService.resolveWindow(whatsappWindowName);
            this.log(`WhatsApp window exists: ${!!whatsappWindow.window}`);
            this.log(`WhatsApp tray exists: ${trayService.trays.has(whatsappWindowName)}`);
            
            // Test Facebook close
            this.log('Testing Facebook Close Instance...');
            const facebookWindowName = facebookProvider.getWindowName('default');
            const facebookWindow = windowService.resolveWindow(facebookWindowName);
            this.log(`Facebook window exists: ${!!facebookWindow.window}`);
            this.log(`Facebook tray exists: ${trayService.trays.has(facebookWindowName)}`);
            
            this.log('');
            this.log('Step 5: Attempting actual Close Instance calls...');
            
            // Try to close Facebook instance
            this.log('Calling Facebook Close Instance...');
            await instanceManager.unregisterSession(facebookProvider, 'default');
            
            // Check state after close
            this.log('State after Facebook close:');
            this.log(`Sessions remaining: ${instanceManager.getSessionCount()}`);
            this.log(`Windows remaining: ${windowService.windows.size}`);
            this.log(`Trays remaining: ${trayService.trays.size}`);
            
            return true;
            
        } catch (error) {
            this.log(`❌ Error during debugging: ${error.message}`);
            console.error(error.stack);
            return false;
        }
    }

    async run() {
        const success = await this.simulateDelegationFlow();
        
        this.log('');
        this.log('🎯 DEBUG SUMMARY:');
        this.log('================');
        
        if (success) {
            this.log('✅ Debugging completed successfully');
            this.log('');
            this.log('📊 KEY FINDINGS:');
            this.log('Check the window and tray creation logs above to see:');
            this.log('1. Were BrowserWindows actually created for both providers?');
            this.log('2. Were Tray icons actually created for both providers?');
            this.log('3. Are they properly registered in WindowService and TrayService?');
            this.log('4. What happens during the Close Instance calls?');
        } else {
            this.log('❌ Debugging failed');
        }
        
        return success;
    }
}

// Run the debugger
if (require.main === module) {
    const windowTrayDebugger = new WindowTrayDebugger();
    
    windowTrayDebugger.run()
        .then(success => {
            console.log('\n🏁 Window/Tray debugging completed');
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Debugger failed:', error);
            process.exit(1);
        });
}

module.exports = WindowTrayDebugger;
