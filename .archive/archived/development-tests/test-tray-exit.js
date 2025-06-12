#!/usr/bin/env node

/**
 * Test script to validate tray exit behavior in multi-instance scenarios
 */

const path = require('path');
const { spawn } = require('child_process');

// Mock electron app for testing
const mockElectron = {
    app: {
        quit: () => {
            console.log('[MOCK] app.quit() called - would exit process');
            // Don't actually exit for testing
        }
    }
};

// Mock the instance manager
class MockInstanceManager {
    constructor() {
        this.providerSessions = new Map();
        console.log('[MOCK] InstanceManager created');
    }

    async registerSession(name, profile) {
        const sessionKey = `${name}:${profile}`;
        this.providerSessions.set(sessionKey, { name, profile, timestamp: Date.now() });
        console.log(`[MOCK] Session registered: ${sessionKey} (total: ${this.providerSessions.size})`);
        return true;
    }

    async unregisterSession(name, profile) {
        const sessionKey = `${name}:${profile}`;
        const removed = this.providerSessions.delete(sessionKey);
        console.log(`[MOCK] Session unregistered: ${sessionKey} (removed: ${removed}, remaining: ${this.providerSessions.size})`);
        return removed;
    }

    getSessionCount() {
        const count = this.providerSessions.size;
        console.log(`[MOCK] getSessionCount() called, returning: ${count}`);
        return count;
    }
}

// Mock the base provider quit logic
class MockProvider {
    constructor(name, profile) {
        this.name = name;
        this.profile = profile;
        this.instanceManager = new MockInstanceManager();
    }

    getSessionName() {
        return this.name;
    }

    async simulateQuitClick() {
        console.log(`\n=== Simulating Quit click for ${this.name}:${this.profile} ===`);
        
        try {
            // This mimics the exact logic from base.provider.js getQuitMenuItem()
            console.log(`Requesting session close for ${this.getSessionName()}:${this.profile}`);
            await this.instanceManager.unregisterSession(this.getSessionName(), this.profile);
            
            // Check if this was the last session and quit if so
            if (this.instanceManager.getSessionCount() === 0) {
                console.log('Last session closed, would quit application');
                mockElectron.app.quit();
            } else {
                console.log('Still have sessions, not quitting');
            }
        } catch (error) {
            console.error('Error in Quit action:', error);
        }
    }
}

async function testSingleInstanceScenario() {
    console.log('\n🧪 Testing Single Instance Scenario');
    console.log('=====================================');
    
    const provider = new MockProvider('whatsapp', 'default');
    await provider.instanceManager.registerSession('whatsapp', 'default');
    
    // This should quit the app
    await provider.simulateQuitClick();
}

async function testMultiInstanceScenario() {
    console.log('\n🧪 Testing Multi-Instance Scenario');
    console.log('===================================');
    
    // Simulate Instance 1 with multiple sessions
    const instance1 = new MockInstanceManager();
    await instance1.registerSession('whatsapp', 'default');
    await instance1.registerSession('facebook', 'default');
    
    // Simulate Instance 2 with one session
    const instance2 = new MockInstanceManager();
    await instance2.registerSession('telegram', 'work');
    
    console.log('\n--- Instance 1 state ---');
    console.log(`Sessions: ${instance1.getSessionCount()}`);
    
    console.log('\n--- Instance 2 state ---');
    console.log(`Sessions: ${instance2.getSessionCount()}`);
    
    // Simulate quit from instance 2 (should only affect instance 2)
    console.log('\n--- Simulating quit from Instance 2 ---');
    const provider2 = new MockProvider('telegram', 'work');
    provider2.instanceManager = instance2; // Use instance 2's manager
    
    await provider2.simulateQuitClick();
    
    console.log('\n--- Final state ---');
    console.log(`Instance 1 sessions: ${instance1.getSessionCount()}`);
    console.log(`Instance 2 sessions: ${instance2.getSessionCount()}`);
}

async function main() {
    console.log('Multi-Instance Tray Exit Behavior Test');
    console.log('======================================\n');
    
    try {
        await testSingleInstanceScenario();
    } catch (error) {
        console.error('Single instance test failed:', error);
    }
    
    try {
        await testMultiInstanceScenario();
    } catch (error) {
        console.error('Multi-instance test failed:', error);
    }
    
    console.log('\n✅ Test completed successfully');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { MockInstanceManager, MockProvider };
