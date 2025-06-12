/**
 * Test script to verify that sessions can be properly unregistered
 * This simulates the Close Instance functionality
 */

const { spawn } = require('child_process');
const path = require('path');

class CloseInstanceSimulationTest {
    constructor() {
        this.results = [];
    }

    log(message) {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        console.log(`[${timestamp}] ${message}`);
    }

    async runTest() {
        this.log('Starting Close Instance Simulation Test...');
        
        try {
            // Create a test script that simulates the close instance flow
            const testScript = `
                const instanceManager = require('./src/services/instance.manager');
                const log = require('electron-log');
                
                async function testCloseInstance() {
                    try {
                        // Test session registration
                        log.info('Testing session registration...');
                        const registerResult1 = instanceManager.registerSession('WhatsApp', 'default');
                        const registerResult2 = instanceManager.registerSession('Facebook', 'default');
                        
                        log.info('WhatsApp session registration result:', registerResult1);
                        log.info('Facebook session registration result:', registerResult2);
                        
                        // Check if sessions exist
                        const sessions = instanceManager.providerSessions;
                        log.info('Registered sessions:', Array.from(sessions.keys()));
                        
                        // Test session unregistration (simulating Close Instance)
                        log.info('Testing session unregistration...');
                        const unregisterResult1 = await instanceManager.unregisterSession('WhatsApp', 'default');
                        const unregisterResult2 = await instanceManager.unregisterSession('Facebook', 'default');
                        
                        log.info('WhatsApp session unregistration result:', unregisterResult1);
                        log.info('Facebook session unregistration result:', unregisterResult2);
                        
                        // Final check
                        const remainingSessions = instanceManager.providerSessions;
                        log.info('Remaining sessions after unregistration:', Array.from(remainingSessions.keys()));
                        
                        const success = unregisterResult1 && unregisterResult2 && remainingSessions.size === 0;
                        log.info('Overall test result:', success ? 'SUCCESS' : 'FAILED');
                        
                        process.exit(success ? 0 : 1);
                    } catch (error) {
                        log.error('Test failed with error:', error);
                        process.exit(1);
                    }
                }
                
                testCloseInstance();
            `;
            
            // Write the test script to a temporary file
            const fs = require('fs');
            const testFilePath = path.join(__dirname, 'temp-close-instance-test.js');
            fs.writeFileSync(testFilePath, testScript);
            
            // Run the test
            await this.runCloseInstanceTest(testFilePath);
            
            // Clean up
            fs.unlinkSync(testFilePath);
            
        } catch (error) {
            this.log(`Test failed with error: ${error.message}`);
            this.results.push({
                test: 'Close Instance Simulation',
                status: 'FAILED',
                error: error.message
            });
        } finally {
            this.displayResults();
        }
    }

    async runCloseInstanceTest(testFilePath) {
        this.log('Running close instance simulation...');
        
        return new Promise((resolve, reject) => {
            const testProcess = spawn('node', [testFilePath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                detached: false,
                cwd: __dirname
            });

            let output = '';
            let errorOutput = '';
            
            testProcess.stdout.on('data', (data) => {
                const text = data.toString().trim();
                if (text) {
                    output += text + '\n';
                    this.log(`Test output: ${text}`);
                }
            });

            testProcess.stderr.on('data', (data) => {
                const text = data.toString().trim();
                if (text) {
                    errorOutput += text + '\n';
                    this.log(`Test error: ${text}`);
                }
            });

            testProcess.on('close', (code) => {
                if (code === 0) {
                    this.results.push({
                        test: 'Close Instance Simulation',
                        status: 'PASSED',
                        details: 'Session registration and unregistration working correctly'
                    });
                } else {
                    this.results.push({
                        test: 'Close Instance Simulation',
                        status: 'FAILED',
                        details: `Process exited with code ${code}`,
                        output: output,
                        errorOutput: errorOutput
                    });
                }
                resolve();
            });

            testProcess.on('error', (error) => {
                this.results.push({
                    test: 'Close Instance Simulation',
                    status: 'FAILED',
                    error: error.message
                });
                reject(error);
            });
        });
    }

    displayResults() {
        this.log('\n=== CLOSE INSTANCE SIMULATION TEST RESULTS ===');
        
        this.results.forEach(result => {
            const status = result.status === 'PASSED' ? '✅' : '❌';
            
            this.log(`${status} ${result.test}: ${result.status}`);
            if (result.details) {
                this.log(`   Details: ${result.details}`);
            }
            if (result.error) {
                this.log(`   Error: ${result.error}`);
            }
            if (result.output) {
                this.log(`   Output: ${result.output}`);
            }
            if (result.errorOutput) {
                this.log(`   Error Output: ${result.errorOutput}`);
            }
        });
        
        const passed = this.results.filter(r => r.status === 'PASSED').length;
        const total = this.results.length;
        
        this.log(`\nSummary: ${passed}/${total} tests passed`);
        
        if (passed === total) {
            this.log('🎉 Close Instance simulation successful! The fix should work properly.');
        } else {
            this.log('❌ Close Instance simulation failed. Review the results above.');
        }
    }
}

// Run the test
if (require.main === module) {
    const test = new CloseInstanceSimulationTest();
    test.runTest().catch(console.error);
}

module.exports = CloseInstanceSimulationTest;
