#!/usr/bin/env node

/**
 * Debug script to test the REAL window and tray creation flow
 * This follows the actual provider.spawn() flow used in production
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
        loadURL(url) { 
            console.log(`[WINDOW-LOAD] 🌐 Loading URL: ${url}`);
            return Promise.resolve(); 
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
    },
    session: {
        fromPartition: (partition) => {
            console.log(`[SESSION] Created session for partition: ${partition}`);
            return {
                setUserAgent: (userAgent) => {
                    console.log(`[SESSION] Set user agent: ${userAgent}`);
                },
                setPermissionRequestHandler: () => {},
                on: () => {},
                clearStorageData: () => Promise.resolve()
            };
        }
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

class RealFlowDebugger {
    constructor() {
        this.debug = true;
    }

    log(message) {
        console.log(`[REAL-DEBUG] ${message}`);
    }

    async testRealProviderFlow() {
        this.log('🔄 Testing REAL provider spawn flow...');
        this.log('');

        try {
            // Initialize services the real way
            this.log('Step 1: Initializing services...');
            const instanceManager = require('./src/services/instance.manager');
            await instanceManager.init({ profile: 'default', profileIsolation: true });
            
            // Get the provider registry to test real provider spawning
            this.log('Step 2: Getting provider registry...');
            const providerRegistry = require('./src/providers/provider.registry');
            const availableProviders = providerRegistry.getAvailableProviders();
            
            this.log(`Available providers: ${availableProviders.map(p => p.commandArg).join(', ')}`);
            
            // Find WhatsApp provider
            const whatsappProvider = availableProviders.find(p => p.commandArg === '--whatsapp');
            if (!whatsappProvider) {
                throw new Error('WhatsApp provider not found');
            }
            
            this.log('Step 3: Spawning WhatsApp provider (this should create window + tray)...');
            const whatsappInstance = await whatsappProvider.spawn('default');
            
            this.log('Step 4: Checking what was created...');
            
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
            
            // Check instance manager sessions
            this.log(`Sessions registered: ${instanceManager.getSessionCount()}`);
            for (const [sessionKey, session] of instanceManager.providerSessions.entries()) {
                this.log(`  - ${sessionKey}`);
            }
            
            if (whatsappInstance) {
                this.log('Step 5: Spawning Facebook provider (delegation scenario)...');
                
                // Find Facebook provider
                const facebookProvider = availableProviders.find(p => p.commandArg === '--facebook');
                if (!facebookProvider) {
                    throw new Error('Facebook provider not found');
                }
                
                const facebookInstance = await facebookProvider.spawn('default');
                
                this.log('Step 6: Checking final state...');
                this.log(`Windows after Facebook: ${windowService.windows.size}`);
                this.log(`Trays after Facebook: ${trayService.trays.size}`);
                this.log(`Sessions after Facebook: ${instanceManager.getSessionCount()}`);
                
                this.log('Step 7: Testing Close Instance functionality...');
                
                // Test Facebook Close Instance
                if (facebookInstance && facebookInstance.getCloseInstanceMenuItem) {
                    this.log('Testing Facebook Close Instance menu...');
                    const closeMenuItem = facebookInstance.getCloseInstanceMenuItem();
                    if (closeMenuItem && closeMenuItem.click) {
                        this.log('Calling Facebook Close Instance...');
                        await closeMenuItem.click();
                        
                        this.log('State after Facebook Close Instance:');
                        this.log(`Windows: ${windowService.windows.size}`);
                        this.log(`Trays: ${trayService.trays.size}`);
                        this.log(`Sessions: ${instanceManager.getSessionCount()}`);
                    }
                }
                
                // Test WhatsApp Close Instance
                if (whatsappInstance && whatsappInstance.getCloseInstanceMenuItem) {
                    this.log('Testing WhatsApp Close Instance menu...');
                    const closeMenuItem = whatsappInstance.getCloseInstanceMenuItem();
                    if (closeMenuItem && closeMenuItem.click) {
                        this.log('Calling WhatsApp Close Instance...');
                        await closeMenuItem.click();
                        
                        this.log('Final state after WhatsApp Close Instance:');
                        this.log(`Windows: ${windowService.windows.size}`);
                        this.log(`Trays: ${trayService.trays.size}`);
                        this.log(`Sessions: ${instanceManager.getSessionCount()}`);
                    }
                }
            }
            
            return true;
            
        } catch (error) {
            this.log(`❌ Error during real flow testing: ${error.message}`);
            console.error(error.stack);
            return false;
        }
    }

    async run() {
        const success = await this.testRealProviderFlow();
        
        this.log('');
        this.log('🎯 REAL FLOW DEBUG SUMMARY:');
        this.log('==========================');
        
        if (success) {
            this.log('✅ Real flow testing completed successfully');
            this.log('');
            this.log('📊 KEY FINDINGS:');
            this.log('Check the logs above to see:');
            this.log('1. Did provider.spawn() create actual BrowserWindows?');
            this.log('2. Did provider.spawn() create actual Tray icons?');
            this.log('3. Were they properly registered in WindowService and TrayService?');
            this.log('4. Does the Close Instance functionality work correctly?');
            this.log('5. What is different between our test vs real usage?');
        } else {
            this.log('❌ Real flow testing failed');
        }
        
        return success;
    }
}

// Run the debugger
if (require.main === module) {
    const realFlowDebugger = new RealFlowDebugger();
    
    realFlowDebugger.run()
        .then(success => {
            console.log('\n🏁 Real flow debugging completed');
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Real flow debugger failed:', error);
            process.exit(1);
        });
}

module.exports = RealFlowDebugger;
