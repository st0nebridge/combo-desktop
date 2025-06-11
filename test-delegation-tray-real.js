/**
 * Test script to simulate real delegation tray menu issue
 * This script more accurately simulates how delegation works in the actual app
 */

const path = require('path');
const { EventEmitter } = require('events');

// Mock logger
const mockLogger = {
    info: (msg, ...args) => console.log('[INFO]', msg, ...args),
    warn: (msg, ...args) => console.log('[WARN]', msg, ...args),
    error: (msg, ...args) => console.log('[ERROR]', msg, ...args),
    debug: (msg, ...args) => console.log('[DEBUG]', msg, ...args)
};

// Mock app manager that handles delegation
const mockAppManager = {
    activeSessions: new Map(), // sessionKey -> provider instance
    
    async startSession(sessionKey, args) {
        console.log(`[APP] Starting session: ${sessionKey} with args:`, args);
        
        // Parse provider from args
        const providerArg = args.find(arg => arg.startsWith('--') && arg !== '--profile');
        if (!providerArg) return false;
        
        const providerName = providerArg.replace('--', '');
        const profileIndex = args.indexOf('--profile');
        const profile = (profileIndex !== -1 && profileIndex + 1 < args.length) ? args[profileIndex + 1] : 'default';
        
        let Provider;
        if (providerName === 'whatsapp') {
            Provider = MockWhatsAppProvider;
        } else if (providerName === 'facebook') {
            Provider = MockFacebookProvider;
        } else {
            console.log(`[APP] Unknown provider: ${providerName}`);
            return false;
        }
        
        // Create provider instance
        const provider = new Provider();
        provider.profile = profile;
        
        // Register session
        mockInstanceManager.registerSession(provider.getSessionName(), profile, provider);
        this.activeSessions.set(sessionKey, provider);
        
        // Create window and tray
        await provider.initializeWindow();
        await mockTrayService.createTray(provider, provider.getWindowName(profile));
        
        console.log(`[APP] Session ${sessionKey} started successfully`);
        return true;
    }
};

// Enhanced mock instance manager 
const mockInstanceManager = {
    sessions: new Map(), // sessionKey -> provider instance
    
    registerSession(sessionName, profile, provider) {
        const key = `${sessionName}:${profile}`;
        this.sessions.set(key, provider);
        console.log(`[INSTANCE] Registered session: ${key}, total sessions: ${this.sessions.size}`);
        return true;
    },
    
    async unregisterSession(sessionName, profile) {
        const key = `${sessionName}:${profile}`;
        if (this.sessions.has(key)) {
            const provider = this.sessions.get(key);
            this.sessions.delete(key);
            
            // Clean up tray
            const windowName = provider.getWindowName(profile);
            mockTrayService.destroyTray(windowName);
            
            console.log(`[INSTANCE] Unregistered session: ${key}, remaining sessions: ${this.sessions.size}`);
            return true;
        }
        return false;
    },
    
    getSessionCount() {
        return this.sessions.size;
    },
    
    listSessions() {
        return Array.from(this.sessions.keys());
    },
    
    // Simulate IPC delegation
    async handleDelegatedCommand(args) {
        console.log(`[INSTANCE] Handling delegated command:`, args);
        
        // Parse provider args into sessions
        const sessions = [];
        let i = 0;
        while (i < args.length) {
            const arg = args[i];
            if (arg.startsWith('--') && arg !== '--profile') {
                const provider = arg.substring(2);
                let profile = 'default';
                
                // Check if next arg is --profile
                if (i + 1 < args.length && args[i + 1] === '--profile') {
                    i += 2; // Skip --profile
                    if (i < args.length) {
                        profile = args[i];
                    }
                }
                
                sessions.push({ provider, profile });
            }
            i++;
        }
        
        // Start each session
        for (const session of sessions) {
            const sessionKey = `${session.provider}:${session.profile}`;
            const sessionArgs = [`--${session.provider}`];
            if (session.profile !== 'default') {
                sessionArgs.push('--profile', session.profile);
            }
            
            await mockAppManager.startSession(sessionKey, sessionArgs);
        }
        
        return { success: true };
    }
};

// Mock services
const mockElectron = {
    app: {
        quit: () => console.log('[MOCK] app.quit() called')
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
        // Important: Create fresh context menu every time
        const contextMenu = provider.getContextMenuOptions();
        this.trays.set(windowName, { 
            provider, 
            contextMenu,
            // Store a reference to the provider for debugging
            providerId: `${provider.getName()}:${provider.profile}`
        });
        console.log(`[TRAY] Created tray for ${windowName} (${provider.getName()}:${provider.profile}) with ${contextMenu.length} menu items`);
        return { mock: true };
    },
    
    destroyTray(windowName) {
        this.trays.delete(windowName);
        console.log(`[TRAY] Destroyed tray for ${windowName}`);
    }
};

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
    
    async initializeWindow() {
        // Mock window initialization
        console.log(`[PROVIDER] ${this.getName()}:${this.profile} window initialized`);
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
        // CRITICAL: Create a closure that captures the current provider state
        const providerName = this.getName();
        const sessionName = this.getSessionName();
        const profile = this.profile;
        
        return {
            label: 'Quit',
            click: async () => {
                try {
                    console.log(`[QUIT] ${providerName}:${profile} quit menu clicked`);
                    console.log(`[QUIT] Requesting session close for ${sessionName}:${profile}`);
                    
                    // This is the key part - unregister THIS specific session
                    await mockInstanceManager.unregisterSession(sessionName, profile);
                    
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

// Mock providers
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

class MockFacebookProvider extends MockBaseProvider {
    getName() { return 'Facebook'; }
    getCommandArg() { return '--facebook'; }
    getUrl() { return 'https://www.messenger.com/login'; }
    
    // Facebook does NOT override getContextMenuOptions, uses base implementation
}

async function testRealDelegationTrayIssue() {
    console.log('\n=== TESTING REAL DELEGATION TRAY ISSUE ===\n');
    
    // Step 1: Simulate first instance startup with WhatsApp
    console.log('--- Step 1: First instance starts with WhatsApp ---');
    await mockAppManager.startSession('whatsapp:default', ['--whatsapp']);
    
    console.log('\n--- Step 2: Simulate delegation of Facebook to existing instance ---');
    // This simulates what happens when a second "combo-desktop --facebook" command is run
    // and gets delegated to the existing instance via IPC
    await mockInstanceManager.handleDelegatedCommand(['--facebook']);
    
    console.log('\n--- Current State ---');
    console.log(`Sessions: ${mockInstanceManager.listSessions().join(', ')}`);
    console.log(`Trays: ${Array.from(mockTrayService.trays.keys()).join(', ')}`);
    
    // Check if providers are correctly isolated
    console.log('\n--- Provider Instance Isolation Check ---');
    for (const [windowName, trayInfo] of mockTrayService.trays.entries()) {
        console.log(`Tray ${windowName} -> Provider: ${trayInfo.providerId}`);
    }
    
    console.log('\n--- Step 3: Test tray menu behavior ---');
    
    // Test WhatsApp tray menu
    console.log('\n>> Testing WhatsApp tray "Quit" menu:');
    const whatsappTray = mockTrayService.trays.get('WhatsApp:default');
    if (whatsappTray) {
        const whatsappQuitItem = whatsappTray.contextMenu.find(item => item.label === 'Quit');
        if (whatsappQuitItem) {
            console.log('Clicking WhatsApp Quit...');
            await whatsappQuitItem.click();
        }
    }
    
    console.log('\n--- State After WhatsApp Quit ---');
    console.log(`Sessions: ${mockInstanceManager.listSessions().join(', ')}`);
    console.log(`Trays: ${Array.from(mockTrayService.trays.keys()).join(', ')}`);
    
    // Test Facebook tray menu (if still exists)
    console.log('\n>> Testing Facebook tray "Quit" menu:');
    const facebookTray = mockTrayService.trays.get('Facebook:default');
    if (facebookTray) {
        const facebookQuitItem = facebookTray.contextMenu.find(item => item.label === 'Quit');
        if (facebookQuitItem) {
            console.log('Clicking Facebook Quit...');
            await facebookQuitItem.click();
        }
    } else {
        console.log('Facebook tray no longer exists');
    }
    
    console.log('\n--- Final State ---');
    console.log(`Sessions: ${mockInstanceManager.listSessions().join(', ')}`);
    console.log(`Trays: ${Array.from(mockTrayService.trays.keys()).join(', ')}`);
}

// Run the test
testRealDelegationTrayIssue().catch(console.error);
