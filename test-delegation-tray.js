/**
 * Test script to investigate delegation tray menu issue
 * This script simulates the delegation scenario described:
 * 1. WhatsApp starts first
 * 2. Facebook is delegated to the same instance 
 * 3. Check tray menu behavior for both providers
 */

const path = require('path');

// Mock logger to capture debug info
const mockLogger = {
    info: (msg, ...args) => console.log('[INFO]', msg, ...args),
    warn: (msg, ...args) => console.log('[WARN]', msg, ...args),
    error: (msg, ...args) => console.log('[ERROR]', msg, ...args),
    debug: (msg, ...args) => console.log('[DEBUG]', msg, ...args)
};

// Mock require cache
const mockRequireCache = new Map();

// Mock electron and services
const mockElectron = {
    app: {
        quit: () => console.log('[MOCK] app.quit() called')
    }
};

const mockInstanceManager = {
    sessions: new Map(), // sessionName:profile -> provider instance
    
    registerSession(sessionName, profile, provider) {
        const key = `${sessionName}:${profile}`;
        this.sessions.set(key, provider);
        console.log(`[INSTANCE] Registered session: ${key}, total sessions: ${this.sessions.size}`);
    },
    
    async unregisterSession(sessionName, profile) {
        const key = `${sessionName}:${profile}`;
        if (this.sessions.has(key)) {
            this.sessions.delete(key);
            console.log(`[INSTANCE] Unregistered session: ${key}, remaining sessions: ${this.sessions.size}`);
        }
    },
    
    getSessionCount() {
        return this.sessions.size;
    },
    
    listSessions() {
        return Array.from(this.sessions.keys());
    }
};

const mockWindowService = {
    resolveWindow(windowName) {
        return {
            window: {
                show: () => console.log(`[WINDOW] Show: ${windowName}`),
                focus: () => console.log(`[WINDOW] Focus: ${windowName}`),
                hide: () => console.log(`[WINDOW] Hide: ${windowName}`),
                isDestroyed: () => false
            }
        };
    }
};

const mockTrayService = {
    trays: new Map(),
    
    async createTray(provider, windowName) {
        const contextMenu = provider.getContextMenuOptions();
        this.trays.set(windowName, { provider, contextMenu });
        console.log(`[TRAY] Created tray for ${windowName} with ${contextMenu.length} menu items`);
        return { mock: true };
    },
    
    destroyTray(windowName) {
        this.trays.delete(windowName);
        console.log(`[TRAY] Destroyed tray for ${windowName}`);
    }
};

// Setup require mocking
function mockRequire(modulePath) {
    if (modulePath === 'electron-log') return mockLogger;
    if (modulePath === 'electron') return mockElectron;
    if (modulePath === '../../services/instance.manager') return mockInstanceManager;
    if (modulePath === '../../services/window.service') return mockWindowService;
    if (modulePath === '../../services/tray.service') return mockTrayService;
    if (modulePath === 'path') return path;
    
    // For relative imports, try to resolve them
    if (modulePath.startsWith('../')) {
        const cached = mockRequireCache.get(modulePath);
        if (cached) return cached;
    }
    
    throw new Error(`Module not mocked: ${modulePath}`);
}

// Mock BaseProvider
class MockBaseProvider {
    constructor() {
        this.profile = null;
        this.window = null;
        this.hasNotification = false;
        this.eventsSetup = false;
        this.isQuitting = false;
        this.windowShowBehavior = 'auto';
    }
    
    getName() { throw new Error('getName() must be implemented'); }
    getCommandArg() { throw new Error('getCommandArg() must be implemented'); }
    getUrl() { throw new Error('getUrl() must be implemented'); }
    
    getSessionName() {
        return this.getCommandArg().replace(/^--/, '');
    }
    
    getWindowName(profile) {
        return `${this.getName()}:${profile}`;
    }
    
    getContextMenuOptions() {
        const windowName = this.getWindowName(this.profile || 'default');
        return [
            {
                label: 'Show',
                click: () => {
                    const { window } = mockWindowService.resolveWindow(windowName);
                    if (window && !window.isDestroyed()) {
                        window.show();
                        window.focus();
                    }
                }
            },
            {
                label: 'Hide',
                click: () => {
                    const { window } = mockWindowService.resolveWindow(windowName);
                    if (window && !window.isDestroyed()) {
                        window.hide();
                    }
                }
            },
            { type: 'separator' },
            this.getQuitMenuItem()
        ];
    }
    
    getQuitMenuItem() {
        return {
            label: 'Quit',
            click: async () => {
                try {
                    console.log(`[QUIT] ${this.getName()}:${this.profile} quit menu clicked`);
                    console.log(`[QUIT] Requesting session close for ${this.getSessionName()}:${this.profile}`);
                    await mockInstanceManager.unregisterSession(this.getSessionName(), this.profile);
                    
                    // Check if this was the last session and quit if so
                    if (mockInstanceManager.getSessionCount() === 0) {
                        console.log('[QUIT] Last session closed, quitting application');
                        mockElectron.app.quit();
                    } else {
                        console.log(`[QUIT] ${mockInstanceManager.getSessionCount()} sessions remaining: ${mockInstanceManager.listSessions().join(', ')}`);
                    }
                } catch (error) {
                    console.log('[QUIT] Error in Quit action:', error);
                }
            }
        };
    }
}

// Mock WhatsApp Provider
class MockWhatsAppProvider extends MockBaseProvider {
    getName() { return 'WhatsApp'; }
    getCommandArg() { return '--whatsapp'; }
    getUrl() { return 'https://web.whatsapp.com'; }
    
    getContextMenuOptions() {
        const baseOptions = super.getContextMenuOptions();
        return [
            {
                label: 'Open WhatsApp',
                click: () => {
                    if (this.window) {
                        this.window.show();
                        this.window.focus();
                    }
                }
            },
            { type: 'separator' },
            ...baseOptions
        ];
    }
}

// Mock Facebook Provider 
class MockFacebookProvider extends MockBaseProvider {
    getName() { return 'Facebook'; }
    getCommandArg() { return '--facebook'; }
    getUrl() { return 'https://www.messenger.com/login'; }
    
    // Facebook does NOT override getContextMenuOptions, uses base implementation
}

async function testDelegationTrayIssue() {
    console.log('\n=== TESTING DELEGATION TRAY ISSUE ===\n');
    
    // Step 1: Create WhatsApp provider and register session (simulates first instance)
    console.log('--- Step 1: WhatsApp starts first ---');
    const whatsapp = new MockWhatsAppProvider();
    whatsapp.profile = 'default';
    mockInstanceManager.registerSession(whatsapp.getSessionName(), whatsapp.profile, whatsapp);
    
    // Create tray for WhatsApp
    await mockTrayService.createTray(whatsapp, whatsapp.getWindowName(whatsapp.profile));
    
    console.log('\n--- Step 2: Facebook is delegated to same instance ---');
    const facebook = new MockFacebookProvider();
    facebook.profile = 'default';
    mockInstanceManager.registerSession(facebook.getSessionName(), facebook.profile, facebook);
    
    // Create tray for Facebook
    await mockTrayService.createTray(facebook, facebook.getWindowName(facebook.profile));
    
    console.log('\n--- Current State ---');
    console.log(`Sessions: ${mockInstanceManager.listSessions().join(', ')}`);
    console.log(`Trays: ${Array.from(mockTrayService.trays.keys()).join(', ')}`);
    
    console.log('\n--- Step 3: Test tray menu behavior ---');
    
    // Get WhatsApp tray menu and test quit
    console.log('\n>> Testing WhatsApp tray "Quit" menu:');
    const whatsappTray = mockTrayService.trays.get('WhatsApp:default');
    const whatsappQuitItem = whatsappTray.contextMenu.find(item => item.label === 'Quit');
    console.log(`WhatsApp quit menu item bound to: ${whatsappQuitItem ? 'found' : 'not found'}`);
    
    if (whatsappQuitItem) {
        console.log('Clicking WhatsApp Quit...');
        await whatsappQuitItem.click();
    }
    
    console.log('\n>> Testing Facebook tray "Quit" menu:');
    const facebookTray = mockTrayService.trays.get('Facebook:default');
    const facebookQuitItem = facebookTray.contextMenu.find(item => item.label === 'Quit');
    console.log(`Facebook quit menu item bound to: ${facebookQuitItem ? 'found' : 'not found'}`);
    
    if (facebookQuitItem) {
        console.log('Clicking Facebook Quit...');
        await facebookQuitItem.click();
    }
    
    console.log('\n--- Final State ---');
    console.log(`Sessions: ${mockInstanceManager.listSessions().join(', ')}`);
    console.log(`Trays: ${Array.from(mockTrayService.trays.keys()).join(', ')}`);
}

// Run the test
testDelegationTrayIssue().catch(console.error);
