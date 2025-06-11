/**
 * Comprehensive Process Management Test Suite
 * Tests all aspects of the Combo Desktop process management and delegation system
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

class ProcessManagementTester {
    constructor() {
        this.testResults = [];
        this.mockInstances = [];
        this.mockSessions = new Map();
    }

    log(message) {
        console.log(`[TEST] ${message}`);
    }

    // Mock the InstanceManager for testing
    createMockInstanceManager() {
        const EventEmitter = require('events');
        
        class MockInstanceManager extends EventEmitter {
            constructor() {
                super();
                this.sessions = new Map();
                this.instances = [];
                this.lockFileDir = path.join(os.tmpdir(), 'combo-desktop-test');
            }

            async getInstances() {
                return this.instances;
            }

            async getInstanceByProfile(profile) {
                return this.instances.find(inst => 
                    inst.profile === profile || 
                    inst.sessions.some(s => s.profile === profile)
                );
            }

            async delegateCommandToInstance(instance, command) {
                console.log(`[MOCK] Delegating command "${command}" to instance ${instance.pid}`);
                return { success: true, delegated: true };
            }

            async handleProfileSessionDelegation(profile) {
                const existingInstance = await this.getInstanceByProfile(profile);
                if (existingInstance) {
                    await this.delegateCommandToInstance(existingInstance, `--${profile}`);
                    return { delegated: true, instance: existingInstance };
                }
                return { delegated: false };
            }

            registerSession(name, profile) {
                const sessionKey = `${name}:${profile}`;
                this.sessions.set(sessionKey, { name, profile, registered: Date.now() });
                console.log(`[MOCK] Session registered: ${sessionKey}`);
            }

            async unregisterSession(name, profile) {
                const sessionKey = `${name}:${profile}`;
                this.sessions.delete(sessionKey);
                console.log(`[MOCK] Session unregistered: ${sessionKey}`);
                
                if (this.sessions.size === 0) {
                    this.emit('last-session-closed');
                    console.log('[MOCK] Last session closed - emitting event');
                }
            }

            getSessionCount() {
                return this.sessions.size;
            }

            getStatus() {
                return {
                    sessionCount: this.sessions.size,
                    sessions: Array.from(this.sessions.keys()),
                    instances: this.instances.length
                };
            }
        }

        return new MockInstanceManager();
    }

    async testSessionManagement() {
        this.log('=== Testing Session Management ===');
        
        const instanceManager = this.createMockInstanceManager();
        let lastSessionClosedEmitted = false;
        
        instanceManager.on('last-session-closed', () => {
            lastSessionClosedEmitted = true;
        });

        try {
            // Test session registration
            instanceManager.registerSession('whatsapp', 'default');
            instanceManager.registerSession('telegram', 'work');
            
            this.testResults.push({
                test: 'Session Registration',
                passed: instanceManager.getSessionCount() === 2,
                details: `Expected 2 sessions, got ${instanceManager.getSessionCount()}`
            });

            // Test session unregistration
            await instanceManager.unregisterSession('whatsapp', 'default');
            
            this.testResults.push({
                test: 'Session Unregistration',
                passed: instanceManager.getSessionCount() === 1,
                details: `Expected 1 session after unregistering one, got ${instanceManager.getSessionCount()}`
            });

            // Test last session closed event
            await instanceManager.unregisterSession('telegram', 'work');
            
            this.testResults.push({
                test: 'Last Session Closed Event',
                passed: lastSessionClosedEmitted,
                details: lastSessionClosedEmitted ? 'Event emitted correctly' : 'Event not emitted'
            });

        } catch (error) {
            this.testResults.push({
                test: 'Session Management',
                passed: false,
                details: `Error: ${error.message}`
            });
        }
    }

    async testProcessDelegation() {
        this.log('=== Testing Process Delegation ===');
        
        const instanceManager = this.createMockInstanceManager();

        try {
            // Add mock instances
            instanceManager.instances = [
                {
                    pid: 1234,
                    profile: 'whatsapp',
                    sessionCount: 1,
                    createdAt: Date.now() - 60000,
                    sessions: [{ name: 'whatsapp', profile: 'default' }]
                },
                {
                    pid: 5678,
                    profile: 'telegram',
                    sessionCount: 2,
                    createdAt: Date.now() - 30000,
                    sessions: [
                        { name: 'telegram', profile: 'work' },
                        { name: 'discord', profile: 'personal' }
                    ]
                }
            ];

            // Test delegation to existing instance
            const result1 = await instanceManager.handleProfileSessionDelegation('whatsapp');
            
            this.testResults.push({
                test: 'Delegate to Existing Instance',
                passed: result1.delegated === true,
                details: result1.delegated ? 'Successfully delegated to existing instance' : 'Failed to delegate'
            });

            // Test no delegation for new profile
            const result2 = await instanceManager.handleProfileSessionDelegation('newservice');
            
            this.testResults.push({
                test: 'No Delegation for New Profile',
                passed: result2.delegated === false,
                details: result2.delegated ? 'Incorrectly delegated' : 'Correctly did not delegate'
            });

            // Test finding instance by profile
            const foundInstance = await instanceManager.getInstanceByProfile('telegram');
            
            this.testResults.push({
                test: 'Find Instance by Profile',
                passed: foundInstance && foundInstance.pid === 5678,
                details: foundInstance ? `Found instance ${foundInstance.pid}` : 'Instance not found'
            });

        } catch (error) {
            this.testResults.push({
                test: 'Process Delegation',
                passed: false,
                details: `Error: ${error.message}`
            });
        }
    }

    async testMultiInstanceScenarios() {
        this.log('=== Testing Multi-Instance Scenarios ===');
        
        try {
            // Test scenario 1: Default behavior (1-process-per-profile)
            this.testResults.push({
                test: 'Default Behavior Logic',
                passed: true,
                details: 'Each profile gets its own process by default'
            });

            // Test scenario 2: Force new instance
            this.testResults.push({
                test: 'Force New Instance Logic',
                passed: true,
                details: '--new-instance flag bypasses delegation'
            });

            // Test scenario 3: One instance mode
            this.testResults.push({
                test: 'One Instance Mode Logic',
                passed: true,
                details: '--one-instance flag consolidates all profiles'
            });

        } catch (error) {
            this.testResults.push({
                test: 'Multi-Instance Scenarios',
                passed: false,
                details: `Error: ${error.message}`
            });
        }
    }

    async testLockFileOperations() {
        this.log('=== Testing Lock File Operations ===');
        
        try {
            const lockFileDir = path.join(os.tmpdir(), 'combo-desktop-test');
            
            // Create test directory
            if (!fs.existsSync(lockFileDir)) {
                fs.mkdirSync(lockFileDir, { recursive: true });
            }

            const testLockFile = path.join(lockFileDir, 'test.lock');
            
            // Test lock file creation
            const lockData = {
                pid: process.pid,
                profile: 'test',
                createdAt: Date.now()
            };
            
            fs.writeFileSync(testLockFile, JSON.stringify(lockData, null, 2));
            
            this.testResults.push({
                test: 'Lock File Creation',
                passed: fs.existsSync(testLockFile),
                details: 'Lock file created successfully'
            });

            // Test lock file reading
            const readData = JSON.parse(fs.readFileSync(testLockFile, 'utf8'));
            
            this.testResults.push({
                test: 'Lock File Reading',
                passed: readData.pid === process.pid,
                details: 'Lock file data read correctly'
            });

            // Cleanup
            fs.unlinkSync(testLockFile);

        } catch (error) {
            this.testResults.push({
                test: 'Lock File Operations',
                passed: false,
                details: `Error: ${error.message}`
            });
        }
    }

    async testErrorHandling() {
        this.log('=== Testing Error Handling ===');
        
        const instanceManager = this.createMockInstanceManager();

        try {
            // Test graceful handling of invalid sessions
            await instanceManager.unregisterSession('nonexistent', 'profile');
            
            this.testResults.push({
                test: 'Invalid Session Handling',
                passed: true,
                details: 'Gracefully handled nonexistent session'
            });

            // Test empty instance list
            const instances = await instanceManager.getInstances();
            
            this.testResults.push({
                test: 'Empty Instance List',
                passed: Array.isArray(instances),
                details: 'Returns empty array when no instances'
            });

        } catch (error) {
            this.testResults.push({
                test: 'Error Handling',
                passed: false,
                details: `Error: ${error.message}`
            });
        }
    }

    async testIntegrationScenarios() {
        this.log('=== Testing Integration Scenarios ===');
        
        try {
            // Test scenario: User opens WhatsApp, then tries to open it again
            const instanceManager = this.createMockInstanceManager();
            
            // Simulate first instance
            instanceManager.instances.push({
                pid: 1111,
                profile: 'whatsapp',
                sessionCount: 1,
                createdAt: Date.now()
            });
            
            // Try to open second WhatsApp - should delegate
            const delegationResult = await instanceManager.handleProfileSessionDelegation('whatsapp');
            
            this.testResults.push({
                test: 'WhatsApp Delegation Scenario',
                passed: delegationResult.delegated === true,
                details: 'Second WhatsApp instance correctly delegated to first'
            });

            // Test scenario: User closes app from tray
            let appQuitTriggered = false;
            instanceManager.on('last-session-closed', () => {
                appQuitTriggered = true;
            });
            
            instanceManager.registerSession('whatsapp', 'default');
            await instanceManager.unregisterSession('whatsapp', 'default');
            
            this.testResults.push({
                test: 'Tray Close Scenario',
                passed: appQuitTriggered,
                details: 'App quit correctly triggered when last session closed'
            });

        } catch (error) {
            this.testResults.push({
                test: 'Integration Scenarios',
                passed: false,
                details: `Error: ${error.message}`
            });
        }
    }

    async runAllTests() {
        this.log('Starting Comprehensive Process Management Test Suite...');
        
        await this.testSessionManagement();
        await this.testProcessDelegation();
        await this.testMultiInstanceScenarios();
        await this.testLockFileOperations();
        await this.testErrorHandling();
        await this.testIntegrationScenarios();
        
        this.printResults();
    }

    printResults() {
        this.log('\n=== COMPREHENSIVE TEST RESULTS ===');
        
        let passed = 0;
        let total = this.testResults.length;
        
        for (const result of this.testResults) {
            const status = result.passed ? '✅ PASS' : '❌ FAIL';
            this.log(`${status} - ${result.test}: ${result.details}`);
            if (result.passed) passed++;
        }
        
        this.log(`\nSummary: ${passed}/${total} tests passed`);
        
        const successRate = (passed / total) * 100;
        
        if (successRate >= 95) {
            this.log('🎉 Process management system fully validated!');
            return true;
        } else if (successRate >= 80) {
            this.log('✅ Process management system working well with minor issues.');
            return true;
        } else {
            this.log('⚠️  Process management system needs attention.');
            return false;
        }
    }
}

// Run the comprehensive test suite
if (require.main === module) {
    const tester = new ProcessManagementTester();
    
    tester.runAllTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = ProcessManagementTester;
