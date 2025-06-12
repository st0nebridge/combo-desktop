/**
 * Real delegation test - This test attempts to reproduce the actual issue
 * by setting up a more realistic environment that mimics the real app flow
 */

const path = require('path');
const { EventEmitter } = require('events');

// Mock Electron modules
const mockElectron = {
    app: new EventEmitter(),
    Tray: class MockTray extends EventEmitter {
        constructor(icon) {
            super();
            this.icon = icon;
            this.id = Math.random().toString(36).substr(2, 9);
            console.log(`[TRAY] Created tray ${this.id} with icon: ${icon}`);
        }
        
        setContextMenu(menu) {
            this.contextMenu = menu;
            console.log(`[TRAY] Set context menu for tray ${this.id}:`, 
                menu.items?.map(item => item.label || '---') || 'No items');
        }
        
        destroy() {
            console.log(`[TRAY] Destroyed tray ${this.id}`);
            this.emit('destroyed');
        }
        
        // Simulate right-click to show menu
        simulateRightClick() {
            console.log(`[TRAY] Right-click on tray ${this.id}`);
            return this.contextMenu;
        }
        
        // Simulate clicking a menu item
        simulateMenuClick(label) {
            if (!this.contextMenu) {
                console.log(`[TRAY] No context menu for tray ${this.id}`);
                return;
            }
            
            const item = this.contextMenu.items?.find(item => item.label === label);
            if (item && item.click) {
                console.log(`[TRAY] Clicking "${label}" on tray ${this.id}`);
                item.click();
            } else {
                console.log(`[TRAY] Menu item "${label}" not found or no click handler on tray ${this.id}`);
            }
        }
        
        setToolTip(tooltip) {
            console.log(`[TRAY] Set tooltip for tray ${this.id}: ${tooltip}`);
        }
        
        setImage(image) {
            console.log(`[TRAY] Set image for tray ${this.id}: ${image}`);
        }
        
        on(event, callback) {
            console.log(`[TRAY] Added ${event} listener to tray ${this.id}`);
            return super.on(event, callback);
        }
        
        isDestroyed() {
            return false;
        }
    },
    Menu: {
        buildFromTemplate: (template) => {
            return {
                items: template.map(item => ({
                    ...item,
                    click: item.click // Preserve click handlers
                }))
            };
        }
    },
    nativeImage: {
        createFromPath: (iconPath) => ({ path: iconPath })
    },
    BrowserWindow: class MockBrowserWindow extends EventEmitter {
        constructor(options) {
            super();
            this.id = Math.random().toString(36).substr(2, 9);
            this.webContents = new EventEmitter();
            console.log(`[WINDOW] Created window ${this.id}`);
        }
        
        loadURL(url) {
            console.log(`[WINDOW] Loading URL: ${url}`);
        }
        
        close() {
            console.log(`[WINDOW] Closing window ${this.id}`);
            this.emit('closed');
        }
        
        destroy() {
            console.log(`[WINDOW] Destroying window ${this.id}`);
            this.emit('destroyed');
        }
        
        show() {
            console.log(`[WINDOW] Showing window ${this.id}`);
        }
        
        hide() {
            console.log(`[WINDOW] Hiding window ${this.id}`);
        }
        
        isDestroyed() {
            return false;
        }
    }
};

// Override require for electron
const originalRequire = require;
require = function(id) {
    if (id === 'electron') {
        return mockElectron;
    }
    return originalRequire.apply(this, arguments);
};

// Now require the actual services
const InstanceManager = require('./src/services/instance.manager.js');
const TrayService = require('./src/services/tray.service.js');

async function testRealDelegation() {
    console.log('=== STARTING REAL DELEGATION TEST ===\n');
    
    try {
        // Clear any existing state
        const instanceManager = require('./src/services/instance.manager.js');
        const trayService = require('./src/services/tray.service.js');
        
        // Step 1: Start WhatsApp first (primary instance)
        console.log('Step 1: Starting WhatsApp as primary instance...');
        
        // Create WhatsApp provider instance - need a real provider for tray functionality
        const BaseProvider = require('./src/providers/abstract/base.provider.js');
        
        class MockWhatsAppProvider extends BaseProvider {
            constructor() {
                super('whatsapp');
                this.profile = 'default';
            }
            
            getName() {
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
        
        const whatsappProvider = new MockWhatsAppProvider();
        whatsappProvider.window = new mockElectron.BrowserWindow({});
        
        // Register session and create tray
        await instanceManager.registerSession('whatsapp', 'default');
        await trayService.createTray(whatsappProvider, 'whatsapp:default');
        
        console.log(`Session count after WhatsApp: ${instanceManager.getSessionCount()}`);
        
        // Give it a moment to fully initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Step 2: Delegate Facebook to the same instance
        console.log('\nStep 2: Delegating Facebook to the same instance...');
        
        class MockFacebookProvider extends BaseProvider {
            constructor() {
                super('facebook');
                this.profile = 'default';
            }
            
            getName() {
                return 'facebook';
            }
            
            getCommandArg() {
                return '--facebook';
            }
            
            getUrl() {
                return 'https://facebook.com';
            }
            
            getTrayIcon() {
                return {
                    image: path.join(__dirname, 'assets', 'facebook.ico')
                };
            }
        }
        
        const facebookProvider = new MockFacebookProvider();
        facebookProvider.window = new mockElectron.BrowserWindow({});
        
        // Register session and create tray
        await instanceManager.registerSession('facebook', 'default'); 
        await trayService.createTray(facebookProvider, 'facebook:default');
        
        console.log(`Session count after delegation: ${instanceManager.getSessionCount()}`);
        
        // Give it a moment to create trays
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Step 3: Check tray state
        console.log('\nStep 3: Checking tray state...');
        const trayEntries = Array.from(trayService.trays.entries());
        console.log(`Number of trays created: ${trayEntries.length}`);
        
        for (let i = 0; i < trayEntries.length; i++) {
            const [windowName, trayInfo] = trayEntries[i];
            console.log(`Tray ${i + 1}: ${windowName} (${trayInfo.provider?.getName?.()})`);
            
            // Get the context menu from the provider
            if (trayInfo.provider) {
                const contextMenu = trayInfo.provider.getContextMenuOptions();
                contextMenu.forEach(item => {
                    if (item.label) {
                        console.log(`  - ${item.label}${item.click ? ' (has click handler)' : ' (no click handler)'}`);
                    }
                });
            }
        }
        
        // Step 4: Test WhatsApp quit behavior
        console.log('\nStep 4: Testing WhatsApp quit behavior...');
        console.log(`Sessions before WhatsApp quit: ${Object.keys(instanceManager.providerSessions.store || instanceManager.providerSessions || {}).join(', ')}`);
        
        const whatsappTrayInfo = trayService.trays.get('whatsapp:default');
        if (whatsappTrayInfo) {
            console.log('Found WhatsApp tray, getting quit menu item...');
            const quitItem = whatsappTrayInfo.provider.getQuitMenuItem();
            if (quitItem && quitItem.click) {
                console.log('Executing WhatsApp quit...');
                quitItem.click();
                await new Promise(resolve => setTimeout(resolve, 100));
            } else {
                console.log('WhatsApp quit item has no click handler!');
            }
        } else {
            console.log('WhatsApp tray not found!');
            console.log('Available trays:', Array.from(trayService.trays.keys()));
        }
        
        console.log(`Sessions after WhatsApp quit: ${Object.keys(instanceManager.providerSessions.store || instanceManager.providerSessions || {}).join(', ')}`);
        console.log(`Session count after WhatsApp quit: ${instanceManager.getSessionCount()}`);
        
        // Step 5: Test Facebook quit behavior  
        console.log('\nStep 5: Testing Facebook quit behavior...');
        const facebookTrayInfo = trayService.trays.get('facebook:default');
        if (facebookTrayInfo) {
            console.log('Found Facebook tray, getting quit menu item...');
            const quitItem = facebookTrayInfo.provider.getQuitMenuItem();
            if (quitItem && quitItem.click) {
                console.log('Executing Facebook quit...');
                quitItem.click();
                await new Promise(resolve => setTimeout(resolve, 100));
            } else {
                console.log('Facebook quit item has no click handler!');
            }
        } else {
            console.log('Facebook tray not found!');
            console.log('Available trays:', Array.from(trayService.trays.keys()));
        }
        
        console.log(`Sessions after Facebook quit: ${Object.keys(instanceManager.providerSessions.store || instanceManager.providerSessions || {}).join(', ')}`);
        console.log(`Session count after Facebook quit: ${instanceManager.getSessionCount()}`);
        
        // Step 6: Check final tray state
        console.log('\nStep 6: Final tray state...');
        const finalTrayEntries = Array.from(trayService.trays.entries());
        console.log(`Number of trays remaining: ${finalTrayEntries.length}`);
        
    } catch (error) {
        console.error('Test failed:', error);
        console.error(error.stack);
    }
}

// Run the test
testRealDelegation().then(() => {
    console.log('\n=== TEST COMPLETED ===');
    process.exit(0);
}).catch(error => {
    console.error('Test error:', error);
    process.exit(1);
});
