/**
 * Simple test to verify if Close Instance is working
 * This will simulate the actual flow and check the problem
 */

const path = require('path');

// Set up the test environment
process.env.NODE_ENV = 'test';

async function testCloseInstance() {
    console.log('=== Testing Close Instance Functionality ===');
    
    try {
        // Mock electron for the test
        global.isTest = true;
        
        // Mock electron components
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
                    console.log(`[MOCK] BrowserWindow created with options:`, options);
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
                    console.log(`[MOCK] Tray created with icon: ${iconPath}`);
                }
                setContextMenu(menu) { 
                    console.log('[MOCK] Tray.setContextMenu() called'); 
                    this.contextMenu = menu;
                }
                destroy() { console.log('[MOCK] Tray.destroy() called'); }
            },
            Menu: {
                buildFromTemplate: (template) => {
                    console.log(`[MOCK] Menu.buildFromTemplate() called with ${template.length} items`);
                    return { items: template };
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

        console.log('Step 1: Loading instance manager...');
        const instanceManager = require('./src/services/instance.manager');
        
        console.log('Step 2: Loading base provider...');
        const BaseProvider = require('./src/providers/abstract/base.provider');
        
        console.log('Step 3: Creating mock providers...');
        
        // Create mock WhatsApp provider
        class MockWhatsAppProvider extends BaseProvider {
            getSessionName() { return 'WhatsApp'; }
            getName() { return 'WhatsApp'; }
            getUrl() { return 'https://web.whatsapp.com/'; }
        }
        
        // Create mock Facebook provider  
        class MockFacebookProvider extends BaseProvider {
            getSessionName() { return 'Facebook'; }
            getName() { return 'Facebook'; }
            getUrl() { return 'https://www.messenger.com/login'; }
        }

        const whatsappProvider = new MockWhatsAppProvider();
        whatsappProvider.profile = 'default';
        
        const facebookProvider = new MockFacebookProvider();
        facebookProvider.profile = 'default';

        console.log('Step 4: Registering sessions...');
        
        // Clear any existing sessions
        instanceManager.providerSessions.clear();
        
        // Register sessions (simulating the spawn process)
        const whatsappRegistered = instanceManager.registerSession('WhatsApp', 'default');
        const facebookRegistered = instanceManager.registerSession('Facebook', 'default');
        
        console.log(`WhatsApp session registered: ${whatsappRegistered}`);
        console.log(`Facebook session registered: ${facebookRegistered}`);
        console.log(`Total sessions: ${instanceManager.getSessionCount()}`);
        console.log(`Registered sessions: ${Array.from(instanceManager.providerSessions.keys())}`);

        console.log('\\nStep 5: Testing WhatsApp Close Instance...');
        const whatsappCloseItem = whatsappProvider.getCloseInstanceMenuItem();
        console.log(`WhatsApp Close Instance menu item created: ${whatsappCloseItem ? 'Yes' : 'No'}`);
        
        if (whatsappCloseItem && whatsappCloseItem.click) {
            console.log('Clicking WhatsApp Close Instance...');
            await whatsappCloseItem.click();
            
            console.log(`Sessions after WhatsApp close: ${instanceManager.getSessionCount()}`);
            console.log(`Remaining sessions: ${Array.from(instanceManager.providerSessions.keys())}`);
        }

        console.log('\\nStep 6: Testing Facebook Close Instance...');
        const facebookCloseItem = facebookProvider.getCloseInstanceMenuItem();
        console.log(`Facebook Close Instance menu item created: ${facebookCloseItem ? 'Yes' : 'No'}`);
        
        if (facebookCloseItem && facebookCloseItem.click) {
            console.log('Clicking Facebook Close Instance...');
            await facebookCloseItem.click();
            
            console.log(`Sessions after Facebook close: ${instanceManager.getSessionCount()}`);
            console.log(`Remaining sessions: ${Array.from(instanceManager.providerSessions.keys())}`);
        }

        console.log('\\n=== TEST RESULTS ===');
        const finalSessionCount = instanceManager.getSessionCount();
        if (finalSessionCount === 0) {
            console.log('✅ Both Close Instance operations worked correctly');
            console.log('✅ All sessions were properly unregistered');
            return true;
        } else {
            console.log(`❌ Close Instance failed - ${finalSessionCount} sessions remain`);
            console.log(`❌ Remaining sessions: ${Array.from(instanceManager.providerSessions.keys())}`);
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
    testCloseInstance()
        .then(success => {
            console.log(`\\nTest ${success ? 'PASSED' : 'FAILED'}`);
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test error:', error);
            process.exit(1);
        });
}

module.exports = testCloseInstance;
