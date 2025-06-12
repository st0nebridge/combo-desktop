#!/usr/bin/env node

/**
 * Debug script to investigate IPC delegation session handling
 * This will help identify the gap between delegation and session registration
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

class IPCDelegationDebugger {
    constructor() {
        this.instanceManager = null;
    }

    log(message) {
        console.log(`[IPC-DEBUG] ${message}`);
    }

    async setup() {
        this.log('Setting up IPC delegation debug environment...');
        
        // Clear require cache to get fresh instances
        delete require.cache[require.resolve('./src/services/instance.manager.js')];
        delete require.cache[require.resolve('./src/cli/index.js')];
        
        // Get instance manager
        this.instanceManager = require('./src/services/instance.manager.js');
        
        // Initialize if needed
        if (!this.instanceManager.instanceId) {
            await this.instanceManager.init({ profile: 'default', profileIsolation: true });
        }
        
        this.log('IPC delegation debug environment ready');
    }

    async debugIPCFlow() {
        this.log('=== Debugging IPC Delegation Flow ===');
        
        // Step 1: Simulate a delegation command like what Facebook would send
        this.log('\nStep 1: Simulating IPC delegation command...');
        this.log('This simulates what happens when Facebook sends a delegation command to WhatsApp process');
        
        // This is what the Facebook process would send via IPC
        const delegationArgs = ['--facebook', '--profile', 'default'];
        
        this.log(`Delegation args: ${delegationArgs.join(' ')}`);
        
        // Step 2: Process the delegation through the CLI system (as it would happen in real scenario)
        this.log('\nStep 2: Processing delegation through CLI system...');
        
        try {
            // Get the CLI system
            const cli = require('./src/cli/index.js');
            
            this.log('Session count before delegation processing:', this.instanceManager.getSessionCount());
            this.log('Sessions before:', Array.from(this.instanceManager.providerSessions.keys()).join(', '));
            
            // Execute the delegated command
            this.log('Executing delegated command...');
            const result = await cli.execute(delegationArgs);
            
            this.log('Delegation result:', JSON.stringify(result, null, 2));
            
            // Check if sessions were created in CLI context
            if (result.context && result.context.sessions && result.context.sessions.length > 0) {
                this.log('✅ CLI correctly parsed sessions:', result.context.sessions);
                
                // Step 2.5: Simulate the appManager.initializeSessions call that happens in real delegation
                this.log('Step 2.5: Simulating appManager.initializeSessions...');
                const appManager = require('./src/services/app.manager');
                
                try {
                    await appManager.initializeSessions(result.context.sessions, result.context);
                    this.log('✅ appManager.initializeSessions completed successfully');
                } catch (error) {
                    this.log('❌ Error in appManager.initializeSessions:', error.message);
                }
            } else {
                this.log('❌ CLI did not create sessions in context');
            }
            
            this.log('Session count after delegation processing:', this.instanceManager.getSessionCount());
            this.log('Sessions after:', Array.from(this.instanceManager.providerSessions.keys()).join(', '));
            
            // Step 3: Test if the delegated session can be unregistered
            this.log('\nStep 3: Testing if delegated Facebook session can be unregistered...');
            
            if (this.instanceManager.providerSessions.has('facebook:default')) {
                this.log('Facebook session found! Testing unregistration...');
                
                // Create a mock Facebook provider to test unregistration
                const BaseProvider = require('./src/providers/abstract/base.provider.js');
                
                class MockFacebookProvider extends BaseProvider {
                    getName() { return 'Facebook'; }
                    getCommandArg() { return '--facebook'; }
                    getUrl() { return 'https://facebook.com'; }
                    getBaseIconPath() { return './assets/icons/facebook'; }
                }
                
                const facebookProvider = new MockFacebookProvider();
                facebookProvider.profile = 'default';
                
                // Test the Close Instance functionality
                this.log('Facebook getSessionName():', facebookProvider.getSessionName());
                this.log('Facebook profile:', facebookProvider.profile);
                
                const closeItem = facebookProvider.getCloseInstanceMenuItem();
                this.log('Executing Facebook Close Instance...');
                await closeItem.click();
                
                this.log('Session count after Facebook close:', this.instanceManager.getSessionCount());
                this.log('Sessions after close:', Array.from(this.instanceManager.providerSessions.keys()).join(', '));
                
            } else {
                this.log('❌ Facebook session not found after delegation! This is the issue.');
                this.log('Available sessions:', Array.from(this.instanceManager.providerSessions.keys()));
            }
            
        } catch (error) {
            this.log(`Error during delegation processing: ${error.message}`);
            console.error(error);
        }
        
        return true;
    }

    async run() {
        try {
            await this.setup();
            await this.debugIPCFlow();
            
            this.log('\n✅ IPC delegation debug completed');
            return true;
        } catch (error) {
            this.log(`❌ IPC delegation debug failed: ${error.message}`);
            console.error(error);
            return false;
        }
    }
}

// Run the debugger
if (require.main === module) {
    const ipcDebugger = new IPCDelegationDebugger();
    
    ipcDebugger.run()
        .then(success => {
            console.log('\nIPC delegation debug completed');
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('IPC delegation debug failed:', error);
            process.exit(1);
        });
}

module.exports = IPCDelegationDebugger;
