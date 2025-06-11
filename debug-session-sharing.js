/**
 * Simple debug script to understand session state sharing issue
 */

const path = require('path');

// Mock Electron components
const electronMock = {
    app: {
        getPath: (name) => {
            if (name === 'userData') return '/mock/userData';
            return '/mock/path';
        },
        quit: () => {
            console.log('[APP] Application quit called');
        }
    }
};

// Mock require for electron
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(...args) {
    if (args[0] === 'electron') {
        return electronMock;
    }
    return originalRequire.apply(this, args);
};

async function debugSessionSharing() {
    console.log('=== DEBUGGING SESSION SHARING ===');
    
    try {
        // Clear require cache
        delete require.cache[require.resolve('./src/services/instance.manager.js')];
        
        // Get the instance manager
        const instanceManager = require('./src/services/instance.manager.js');
        
        console.log('\nStep 1: Manually registering WhatsApp session...');
        await instanceManager.registerSession('whatsapp', 'default');
        console.log(`Session count: ${instanceManager.getSessionCount()}`);
        console.log(`Sessions: ${Array.from(instanceManager.providerSessions.keys()).join(', ')}`);
        
        console.log('\nStep 2: Manually registering Facebook session...');
        await instanceManager.registerSession('facebook', 'default');
        console.log(`Session count: ${instanceManager.getSessionCount()}`);
        console.log(`Sessions: ${Array.from(instanceManager.providerSessions.keys()).join(', ')}`);
        
        console.log('\nStep 3: Creating a second instance manager reference...');
        // This simulates what happens when different provider instances get the instance manager
        const instanceManager2 = require('./src/services/instance.manager.js');
        console.log(`Are they the same instance? ${instanceManager === instanceManager2}`);
        console.log(`Session count from manager2: ${instanceManager2.getSessionCount()}`);
        
        console.log('\nStep 4: Unregistering WhatsApp from first manager...');
        await instanceManager.unregisterSession('whatsapp', 'default');
        console.log(`Session count from manager1: ${instanceManager.getSessionCount()}`);
        console.log(`Session count from manager2: ${instanceManager2.getSessionCount()}`);
        console.log(`Sessions from manager1: ${Array.from(instanceManager.providerSessions.keys()).join(', ')}`);
        console.log(`Sessions from manager2: ${Array.from(instanceManager2.providerSessions.keys()).join(', ')}`);
        
        console.log('\nStep 5: Simulating Facebook quit check...');
        const sessionCountBeforeFacebookQuit = instanceManager2.getSessionCount();
        console.log(`Facebook sees session count: ${sessionCountBeforeFacebookQuit}`);
        
        if (sessionCountBeforeFacebookQuit === 1) {
            console.log('✅ Facebook correctly sees 1 remaining session');
        } else {
            console.log(`❌ Facebook incorrectly sees ${sessionCountBeforeFacebookQuit} sessions`);
        }
        
        console.log('\nStep 6: Unregistering Facebook...');
        await instanceManager2.unregisterSession('facebook', 'default');
        console.log(`Final session count: ${instanceManager2.getSessionCount()}`);
        
        if (instanceManager2.getSessionCount() === 0) {
            console.log('✅ Correctly detected last session');
        } else {
            console.log('❌ Incorrectly still has sessions');
        }
        
    } catch (error) {
        console.error('Error in debug session sharing:', error);
    }
}

// Run the test
debugSessionSharing().catch(console.error);
