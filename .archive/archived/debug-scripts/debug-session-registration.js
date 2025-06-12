#!/usr/bin/env node

/**
 * Debug script to investigate session registration/unregistration for delegated instances
 * This will help identify why Facebook's "Close Instance" doesn't work after delegation
 */

const path = require('path');

// Mock electron to avoid GUI
global.isTest = true;
const electronMock = {
    app: {
        getPath: (name) => {
            if (name === 'userData') return 'm:\\Dev\\Tools\\combo-desktop\\temp-userdata';
            return 'm:\\Dev\\Tools\\combo-desktop\\temp';
        },
        getName: () => 'combo-desktop',
        quit: () => console.log('[APP] Application quit called')
    },
    BrowserWindow: class MockBrowserWindow {
        constructor() {
            this.metadata = {};
            this.destroyed = false;
        }
        close() { console.log('[WINDOW] Window closed'); }
        isDestroyed() { return this.destroyed; }
        destroy() { this.destroyed = true; }
    },
    Tray: class MockTray {
        constructor(iconPath) {
            this.iconPath = iconPath;
            console.log(`[TRAY] Created tray with icon: ${iconPath}`);
        }
        setContextMenu(menu) { console.log('[TRAY] Set context menu'); }
        destroy() { console.log('[TRAY] Tray destroyed'); }
        isDestroyed() { return false; }
    },
    Menu: {
        buildFromTemplate: (template) => ({ items: template })
    },
    nativeImage: {
        createFromPath: (path) => ({ path })
    }
};

// Mock the electron module
require.cache[require.resolve('electron')] = {
    exports: electronMock
};

class SessionRegistrationDebugger {
    constructor() {
        this.instanceManager = null;
        this.providers = new Map();
    }

    log(message) {
        console.log(`[SESSION-DEBUG] ${message}`);
    }

    async setup() {
        this.log('Setting up debug environment...');
        
        // Clear require cache to get fresh instances
        delete require.cache[require.resolve('./src/services/instance.manager.js')];
        delete require.cache[require.resolve('./src/providers/abstract/base.provider.js')];
        delete require.cache[require.resolve('./src/providers/modules/whatsapp.provider.js')];
        delete require.cache[require.resolve('./src/providers/modules/facebook.provider.js')];
        
        // Get instance manager
        this.instanceManager = require('./src/services/instance.manager.js');
        
        // Initialize if needed
        if (!this.instanceManager.instanceId) {
            await this.instanceManager.init({ profile: 'default', profileIsolation: true });
        }
        
        this.log('Debug environment ready');
    }

    async createMockProvider(name, profile = 'default') {
        const BaseProvider = require('./src/providers/abstract/base.provider.js');
        const self = this; // Store reference for inner class
        
        class MockProvider extends BaseProvider {
            constructor() {
                super();
                this.name = name;
                this.profile = profile;
            }
            
            getName() { return this.name; }
            getCommandArg() { return `--${this.name.toLowerCase()}`; }
            getUrl() { return `https://${this.name.toLowerCase()}.com`; }
            getBaseIconPath() { return `./assets/icons/${this.name.toLowerCase()}`; }
            
            async initialize() {
                self.log(`Initializing ${this.name} provider with profile: ${this.profile}`);
                const result = self.instanceManager.registerSession(this.getSessionName(), this.profile);
                self.log(`Registration result for ${this.getSessionName()}:${this.profile} = ${result}`);
                return result;
            }
        }
        
        const provider = new MockProvider();
        this.providers.set(`${name}:${profile}`, provider);
        return provider;
    }

    async debugSessionRegistration() {
        this.log('=== Debugging Session Registration Flow ===');
        
        // Step 1: Create WhatsApp provider and register
        this.log('\nStep 1: Creating and registering WhatsApp provider...');
        const whatsapp = await this.createMockProvider('WhatsApp', 'default');
        await whatsapp.initialize();
        
        this.log(`Session count after WhatsApp: ${this.instanceManager.getSessionCount()}`);
        this.log(`Sessions: ${Array.from(this.instanceManager.providerSessions.keys()).join(', ')}`);
        
        // Step 2: Create Facebook provider and register
        this.log('\nStep 2: Creating and registering Facebook provider...');
        const facebook = await this.createMockProvider('Facebook', 'default');
        await facebook.initialize();
        
        this.log(`Session count after Facebook: ${this.instanceManager.getSessionCount()}`);
        this.log(`Sessions: ${Array.from(this.instanceManager.providerSessions.keys()).join(', ')}`);
        
        // Step 3: Debug session keys and provider instances
        this.log('\nStep 3: Debugging session keys and provider references...');
        for (const [sessionKey, sessionData] of this.instanceManager.providerSessions.entries()) {
            this.log(`Session: ${sessionKey}`);
            this.log(`  Data: ${JSON.stringify(sessionData)}`);
        }
        
        // Step 4: Test WhatsApp unregistration
        this.log('\nStep 4: Testing WhatsApp unregistration...');
        this.log(`WhatsApp getSessionName(): ${whatsapp.getSessionName()}`);
        this.log(`WhatsApp profile: ${whatsapp.profile}`);
        
        const whatsappCloseItem = whatsapp.getCloseInstanceMenuItem();
        this.log('Executing WhatsApp Close Instance...');
        await whatsappCloseItem.click();
        
        this.log(`Session count after WhatsApp close: ${this.instanceManager.getSessionCount()}`);
        this.log(`Sessions: ${Array.from(this.instanceManager.providerSessions.keys()).join(', ')}`);
        
        // Step 5: Test Facebook unregistration
        this.log('\nStep 5: Testing Facebook unregistration...');
        this.log(`Facebook getSessionName(): ${facebook.getSessionName()}`);
        this.log(`Facebook profile: ${facebook.profile}`);
        
        const facebookCloseItem = facebook.getCloseInstanceMenuItem();
        this.log('Executing Facebook Close Instance...');
        await facebookCloseItem.click();
        
        this.log(`Session count after Facebook close: ${this.instanceManager.getSessionCount()}`);
        this.log(`Sessions: ${Array.from(this.instanceManager.providerSessions.keys()).join(', ')}`);
        
        return true;
    }

    async debugDelegationScenario() {
        this.log('\n=== Debugging Delegation Scenario ===');
        
        // Simulate what happens during delegation
        this.log('\nSimulating delegation scenario...');
        
        // Step 1: Clear and start fresh
        this.instanceManager.providerSessions.clear();
        
        // Step 2: Register WhatsApp (first instance)
        this.log('\nStep 2: Registering WhatsApp as first instance...');
        const whatsapp = await this.createMockProvider('WhatsApp', 'default');
        await whatsapp.initialize();
        
        this.log(`Session count: ${this.instanceManager.getSessionCount()}`);
        this.log(`Sessions: ${Array.from(this.instanceManager.providerSessions.keys()).join(', ')}`);
        
        // Step 3: Simulate Facebook delegation by manually registering its session
        // This simulates what should happen when Facebook delegates to WhatsApp's process
        this.log('\nStep 3: Simulating Facebook delegation...');
        const facebook = await this.createMockProvider('Facebook', 'default');
        
        // Register the session manually (simulating delegation IPC)
        const facebookRegistered = this.instanceManager.registerSession(facebook.getSessionName(), facebook.profile);
        this.log(`Facebook session registration result: ${facebookRegistered}`);
        
        this.log(`Session count after delegation: ${this.instanceManager.getSessionCount()}`);
        this.log(`Sessions: ${Array.from(this.instanceManager.providerSessions.keys()).join(', ')}`);
        
        // Step 4: Debug what happens when we try to unregister Facebook
        this.log('\nStep 4: Testing Facebook Close Instance after delegation...');
        this.log(`Facebook getSessionName(): ${facebook.getSessionName()}`);
        this.log(`Facebook profile: ${facebook.profile}`);
        this.log(`Expected session key: ${facebook.getSessionName()}:${facebook.profile}`);
        
        // Check if the session exists before unregistration
        const sessionKey = `${facebook.getSessionName()}:${facebook.profile}`;
        const sessionExists = this.instanceManager.providerSessions.has(sessionKey);
        this.log(`Session exists in providerSessions: ${sessionExists}`);
        
        if (sessionExists) {
            const sessionData = this.instanceManager.providerSessions.get(sessionKey);
            this.log(`Session data: ${JSON.stringify(sessionData)}`);
        }
        
        // Try to unregister
        const facebookCloseItem = facebook.getCloseInstanceMenuItem();
        this.log('Executing Facebook Close Instance...');
        await facebookCloseItem.click();
        
        this.log(`Session count after Facebook close: ${this.instanceManager.getSessionCount()}`);
        this.log(`Sessions: ${Array.from(this.instanceManager.providerSessions.keys()).join(', ')}`);
        
        return true;
    }

    async run() {
        try {
            await this.setup();
            await this.debugSessionRegistration();
            await this.debugDelegationScenario();
            
            this.log('\n✅ Debug completed successfully');
            return true;
        } catch (error) {
            this.log(`❌ Debug failed: ${error.message}`);
            console.error(error);
            return false;
        }
    }
}

// Run the debugger
if (require.main === module) {
    const sessionDebugger = new SessionRegistrationDebugger();
    
    sessionDebugger.run()
        .then(success => {
            console.log('\nDebug completed');
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Debug failed:', error);
            process.exit(1);
        });
}

module.exports = SessionRegistrationDebugger;
