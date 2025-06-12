/**
 * Test to verify tray context menu creation and Close Instance functionality
 */

const path = require('path');

// Mock electron first
const mockElectron = {
    app: {
        getPath: (name) => {
            if (name === 'userData') return path.join(__dirname, 'temp-userdata');
            return path.join(__dirname, 'temp');
        },
        getName: () => 'combo-desktop',
        quit: () => {
            console.log('[MOCK] app.quit() called');
            return true;
        }
    },
    BrowserWindow: class MockBrowserWindow {
        constructor(options) {
            this.options = options;
            this.destroyed = false;
            console.log(`[MOCK] BrowserWindow created`);
        }
        close() { 
            console.log('[MOCK] BrowserWindow.close() called'); 
            this.destroyed = true;
        }
        isDestroyed() { return this.destroyed; }
        destroy() { 
            this.destroyed = true; 
            console.log('[MOCK] BrowserWindow.destroy() called');
        }
        show() { console.log('[MOCK] BrowserWindow.show() called'); }
        hide() { console.log('[MOCK] BrowserWindow.hide() called'); }
        focus() { console.log('[MOCK] BrowserWindow.focus() called'); }
        on() {}
        once() {}
        setMenu() {}
        get webContents() {
            return {
                setUserAgent: () => {},
                loadURL: () => Promise.resolve(),
                executeJavaScript: () => Promise.resolve(),
                on: () => {},
                session: {
                    setPermissionRequestHandler: () => {},
                    on: () => {}
                }
            };
        }
    },
    Tray: class MockTray {
        constructor(iconPath) {
            this.iconPath = iconPath;
            this.contextMenu = null;
            console.log(`[MOCK] Tray created with icon: ${iconPath}`);
        }
        setContextMenu(menu) { 
            this.contextMenu = menu;
            console.log(`[MOCK] Tray.setContextMenu() called with ${menu.items?.length || 0} items`);
            
            // Log menu items for debugging
            if (menu.items) {
                menu.items.forEach((item, index) => {
                    if (item.type === 'separator') {
                        console.log(`  ${index}: [separator]`);
                    } else {
                        console.log(`  ${index}: "${item.label}" ${item.click ? '(clickable)' : '(no handler)'}`);
                    }
                });
            }
        }
        destroy() { console.log('[MOCK] Tray.destroy() called'); }
        setToolTip() { console.log('[MOCK] Tray.setToolTip() called'); }
        on() {}
    },
    Menu: {
        buildFromTemplate: (template) => {
            console.log(`[MOCK] Menu.buildFromTemplate() called with ${template.length} items`);
            return { 
                items: template.map(item => ({
                    label: item.label,
                    click: item.click,
                    type: item.type || 'normal',
                    enabled: item.enabled !== false
                }))
            };
        }
    },
    nativeTheme: {
        shouldUseDarkColors: false
    }
};

// Override electron require
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
    if (id === 'electron') {
        return mockElectron;
    }
    return originalRequire.apply(this, arguments);
};

async function testTrayContextMenu() {
    console.log('=== Testing Tray Context Menu Creation ===');
    
    try {
        // Load services
        console.log('Step 1: Loading services...');
        const instanceManager = require('./src/services/instance.manager');
        const trayService = require('./src/services/tray.service');
        const BaseProvider = require('./src/providers/abstract/base.provider');
        
        console.log('Step 2: Creating mock providers...');
        
        // Create mock WhatsApp provider
        class MockWhatsAppProvider extends BaseProvider {
            getSessionName() { return 'WhatsApp'; }
            getName() { return 'WhatsApp'; }
            getUrl() { return 'https://web.whatsapp.com/'; }
            getTrayIcon() {
                return {
                    image: path.join(__dirname, 'assets', 'icons', 'whatsapp', 'icon.ico'),
                    isDarkMode: false,
                    hasNotification: false,
                    isMinimized: false
                };
            }
        }
        
        // Create mock Facebook provider  
        class MockFacebookProvider extends BaseProvider {
            getSessionName() { return 'Facebook'; }
            getName() { return 'Facebook'; }
            getUrl() { return 'https://www.messenger.com/login'; }
            getTrayIcon() {
                return {
                    image: path.join(__dirname, 'assets', 'icons', 'facebook', 'icon.ico'),
                    isDarkMode: false,
                    hasNotification: false,
                    isMinimized: false
                };
            }
        }

        const whatsappProvider = new MockWhatsAppProvider();
        whatsappProvider.profile = 'default';
        
        const facebookProvider = new MockFacebookProvider();
        facebookProvider.profile = 'default';

        console.log('Step 3: Testing provider context menus...');
        
        // Test WhatsApp context menu
        console.log('\\n--- WhatsApp Context Menu ---');
        const whatsappMenu = whatsappProvider.getContextMenuOptions();
        console.log(`WhatsApp menu has ${whatsappMenu.length} items:`);
        whatsappMenu.forEach((item, index) => {
            if (item.type === 'separator') {
                console.log(`  ${index}: [separator]`);
            } else {
                console.log(`  ${index}: "${item.label}" ${item.click ? '(clickable)' : '(no handler)'}`);
            }
        });
        
        // Test Facebook context menu
        console.log('\\n--- Facebook Context Menu ---');
        const facebookMenu = facebookProvider.getContextMenuOptions();
        console.log(`Facebook menu has ${facebookMenu.length} items:`);
        facebookMenu.forEach((item, index) => {
            if (item.type === 'separator') {
                console.log(`  ${index}: [separator]`);
            } else {
                console.log(`  ${index}: "${item.label}" ${item.click ? '(clickable)' : '(no handler)'}`);
            }
        });

        console.log('\\nStep 4: Testing tray creation...');
        
        // Initialize tray service
        await trayService.init();
        
        // Create trays for both providers
        console.log('\\n--- Creating WhatsApp Tray ---');
        const whatsappTray = await trayService.createTray(whatsappProvider, 'WhatsApp:default');
        
        console.log('\\n--- Creating Facebook Tray ---');
        const facebookTray = await trayService.createTray(facebookProvider, 'Facebook:default');

        console.log('\\nStep 5: Testing Close Instance menu items directly...');
        
        // Register sessions first
        instanceManager.providerSessions.clear();
        instanceManager.registerSession('WhatsApp', 'default');
        instanceManager.registerSession('Facebook', 'default');
        
        console.log(`\\nBefore Close Instance tests: ${instanceManager.getSessionCount()} sessions`);
        console.log(`Sessions: ${Array.from(instanceManager.providerSessions.keys())}`);
        
        // Test WhatsApp Close Instance
        console.log('\\n--- Testing WhatsApp Close Instance ---');
        const whatsappCloseItem = whatsappProvider.getCloseInstanceMenuItem();
        console.log(`WhatsApp Close Instance item: ${whatsappCloseItem ? 'Created' : 'Failed'}`);
        console.log(`Label: "${whatsappCloseItem.label}"`);
        console.log(`Has click handler: ${whatsappCloseItem.click ? 'Yes' : 'No'}`);
        
        if (whatsappCloseItem.click) {
            console.log('>>> Clicking WhatsApp Close Instance...');
            await whatsappCloseItem.click();
            console.log(`After WhatsApp close: ${instanceManager.getSessionCount()} sessions`);
            console.log(`Remaining: ${Array.from(instanceManager.providerSessions.keys())}`);
        }
        
        // Test Facebook Close Instance
        console.log('\\n--- Testing Facebook Close Instance ---');
        const facebookCloseItem = facebookProvider.getCloseInstanceMenuItem();
        console.log(`Facebook Close Instance item: ${facebookCloseItem ? 'Created' : 'Failed'}`);
        console.log(`Label: "${facebookCloseItem.label}"`);
        console.log(`Has click handler: ${facebookCloseItem.click ? 'Yes' : 'No'}`);
        
        if (facebookCloseItem.click) {
            console.log('>>> Clicking Facebook Close Instance...');
            await facebookCloseItem.click();
            console.log(`After Facebook close: ${instanceManager.getSessionCount()} sessions`);
            console.log(`Remaining: ${Array.from(instanceManager.providerSessions.keys())}`);
        }

        console.log('\\n=== TEST RESULTS ===');
        
        const finalSessionCount = instanceManager.getSessionCount();
        const bothMenusExist = whatsappCloseItem && facebookCloseItem;
        const bothHaveHandlers = whatsappCloseItem?.click && facebookCloseItem?.click;
        const allSessionsClosed = finalSessionCount === 0;
        
        console.log(`✅ Tray menus created: ${bothMenusExist ? 'Yes' : 'No'}`);
        console.log(`✅ Close Instance items exist: ${bothMenusExist ? 'Yes' : 'No'}`);
        console.log(`✅ Click handlers exist: ${bothHaveHandlers ? 'Yes' : 'No'}`);
        console.log(`✅ Sessions properly closed: ${allSessionsClosed ? 'Yes' : 'No'}`);
        
        if (bothMenusExist && bothHaveHandlers && allSessionsClosed) {
            console.log('\\n🎉 All tests PASSED! Close Instance functionality is working correctly.');
            return true;
        } else {
            console.log('\\n❌ Some tests FAILED. There may be an issue with the implementation.');
            return false;
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        console.error('Stack trace:', error.stack);
        return false;
    }
}

// Run the test
if (require.main === module) {
    testTrayContextMenu()
        .then(success => {
            console.log(`\\nTest ${success ? 'PASSED' : 'FAILED'}`);
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test error:', error);
            process.exit(1);
        });
}

module.exports = testTrayContextMenu;
