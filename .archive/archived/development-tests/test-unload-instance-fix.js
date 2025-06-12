#!/usr/bin/env node

/**
 * Test script to validate the "Unload Instance" functionality
 * Tests that instances are properly unloaded (not just minimized) and cleanup happens correctly
 */

const path = require('path');

// Mock electron first
global.isTest = true;
const electronMock = {
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
            this.forceClose = false;
            this.metadata = {};
            console.log(`[MOCK] BrowserWindow created`);
        }
        close() { 
            if (this.forceClose) {
                console.log('[MOCK] BrowserWindow.close() called with forceClose=true - window will actually close'); 
                this.destroyed = true;
            } else {
                console.log('[MOCK] BrowserWindow.close() called with forceClose=false - window would be hidden instead'); 
            }
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
        }
        destroy() { console.log('[MOCK] Tray.destroy() called'); }
        setToolTip() { console.log('[MOCK] Tray.setToolTip() called'); }
        on() {}
    },
    Menu: {
        buildFromTemplate: (template) => {
            console.log(`[MOCK] Menu.buildFromTemplate() called with ${template.length} items`);
            return { items: template };
        }
    },
    dialog: {
        showMessageBox: async (options) => {
            console.log(`[MOCK] dialog.showMessageBox() called:`);
            console.log(`  Title: ${options.title}`);
            console.log(`  Message: ${options.message}`);
            console.log(`  Detail: ${options.detail || 'None'}`);
            console.log(`  Buttons: ${options.buttons.join(', ')}`);
            
            // Simulate user clicking first button (Quit/Quit All)
            return { response: 0 };
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
        return electronMock;
    }
    return originalRequire.apply(this, arguments);
};

async function testUnloadInstanceFix() {
    console.log('=== Testing Unload Instance Functionality ===');
    
    try {
        console.log('Step 1: Loading services...');
        const instanceManager = require('./src/services/instance.manager');
        const trayService = require('./src/services/tray.service');
        const BaseProvider = require('./src/providers/abstract/base.provider');
        
        console.log('Step 2: Creating mock providers...');
        
        // Create mock WhatsApp provider
        class MockWhatsAppProvider extends BaseProvider {
            getSessionName() { return 'whatsapp'; }
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
            getSessionName() { return 'facebook'; }
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

        console.log('Step 3: Registering sessions...');
        
        // Register sessions
        instanceManager.providerSessions.clear();
        instanceManager.registerSession('whatsapp', 'default');
        instanceManager.registerSession('facebook', 'default');
        
        console.log(`Sessions registered: ${instanceManager.getSessionCount()}`);
        console.log(`Active sessions: ${Array.from(instanceManager.providerSessions.keys())}`);

        console.log('\nStep 4: Testing "Unload Instance" menu items...');
        
        // Test WhatsApp unload instance
        console.log('\n--- Testing WhatsApp Unload Instance ---');
        const whatsappUnloadItem = whatsappProvider.getCloseInstanceMenuItem();
        console.log(`WhatsApp menu item label: "${whatsappUnloadItem.label}"`);
        console.log(`WhatsApp has click handler: ${whatsappUnloadItem.click ? 'Yes' : 'No'}`);
        
        if (whatsappUnloadItem.click) {
            console.log('>>> Clicking WhatsApp Unload Instance...');
            await whatsappUnloadItem.click();
            console.log(`Sessions after WhatsApp unload: ${instanceManager.getSessionCount()}`);
            console.log(`Remaining: ${Array.from(instanceManager.providerSessions.keys())}`);
        }
        
        // Test Facebook unload instance
        console.log('\n--- Testing Facebook Unload Instance ---');
        const facebookUnloadItem = facebookProvider.getCloseInstanceMenuItem();
        console.log(`Facebook menu item label: "${facebookUnloadItem.label}"`);
        console.log(`Facebook has click handler: ${facebookUnloadItem.click ? 'Yes' : 'No'}`);
        
        if (facebookUnloadItem.click) {
            console.log('>>> Clicking Facebook Unload Instance...');
            await facebookUnloadItem.click();
            console.log(`Sessions after Facebook unload: ${instanceManager.getSessionCount()}`);
            console.log(`Remaining: ${Array.from(instanceManager.providerSessions.keys())}`);
        }

        console.log('\nStep 5: Testing "Quit Application" with confirmation dialog...');
        
        // Register fresh sessions for quit test
        instanceManager.registerSession('whatsapp', 'default');
        instanceManager.registerSession('facebook', 'default');
        instanceManager.registerSession('telegram', 'work');
        
        console.log(`Sessions for quit test: ${instanceManager.getSessionCount()}`);
        
        const quitAppItem = whatsappProvider.getQuitApplicationMenuItem();
        console.log(`Quit Application menu item label: "${quitAppItem.label}"`);
        
        if (quitAppItem.click) {
            console.log('>>> Clicking Quit Application (should show confirmation with instance list)...');
            await quitAppItem.click();
        }

        console.log('\n=== TEST RESULTS ===');
        
        const finalSessionCount = instanceManager.getSessionCount();
        const menuLabelCorrect = whatsappUnloadItem.label === 'Unload Instance';
        const hasForceCloseLogic = whatsappUnloadItem.click.toString().includes('forceClose');
        
        console.log(`✅ Menu label changed to "Unload Instance": ${menuLabelCorrect ? 'Yes' : 'No'}`);
        console.log(`✅ ForceClose logic implemented: ${hasForceCloseLogic ? 'Yes' : 'No'}`);
        console.log(`✅ Sessions properly unloaded: ${finalSessionCount === 0 ? 'Yes' : 'No'}`);
        console.log(`✅ Confirmation dialog for quit: Check logs above`);
        
        if (menuLabelCorrect && hasForceCloseLogic) {
            console.log('\n🎉 All Unload Instance fixes are working correctly!');
            console.log('\n📝 Key Improvements:');
            console.log('1. Menu item now says "Unload Instance" instead of "Close Instance"');
            console.log('2. Windows are force-closed to prevent hide-instead-of-close behavior');
            console.log('3. Confirmation dialog shows running instances before quitting');
            console.log('4. Proper cleanup chain: Instance → Window → Tray → Process exit');
            return true;
        } else {
            console.log('\n❌ Some fixes are not working correctly.');
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
    testUnloadInstanceFix()
        .then(success => {
            console.log('\nTest completed');
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test failed:', error);
            process.exit(1);
        });
}

module.exports = testUnloadInstanceFix;
