#!/usr/bin/env node

/**
 * Test script to check current delegation behavior after tray fix
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class DelegationBehaviorTest {
    constructor() {
        this.processes = [];
        this.testResults = [];
    }

    log(message) {
        console.log(`[DELEGATION-TEST] ${message}`);
    }

    async cleanup() {
        this.log('Cleaning up test processes...');
        
        for (const proc of this.processes) {
            if (!proc.killed) {
                proc.kill('SIGTERM');
                await new Promise(resolve => setTimeout(resolve, 1000));
                if (!proc.killed) {
                    proc.kill('SIGKILL');
                }
            }
        }

        // Clean up lock files
        try {
            const lockFileDir = path.join(os.tmpdir(), 'desk-tray');
            if (fs.existsSync(lockFileDir)) {
                const files = fs.readdirSync(lockFileDir);
                for (const file of files) {
                    if (file.endsWith('.lock') || file.endsWith('.json')) {
                        const filePath = path.join(lockFileDir, file);
                        try {
                            fs.unlinkSync(filePath);
                            this.log(`Cleaned up ${file}`);
                        } catch (error) {
                            // Ignore cleanup errors
                        }
                    }
                }
            }
        } catch (error) {
            this.log(`Cleanup warning: ${error.message}`);
        }
    }

    async checkLockFile() {
        try {
            // Check multiple possible locations
            const possiblePaths = [
                // Temp directory fallback
                path.join(os.tmpdir(), 'desk-tray', 'instance.lock'),
                // Common Electron userData paths
                path.join(os.homedir(), 'AppData', 'Roaming', 'combo-desktop', 'instance.lock'),
                path.join(os.homedir(), 'AppData', 'Roaming', 'desk-tray', 'instance.lock'),
                // Check package.json name
                path.join(os.homedir(), 'AppData', 'Roaming', 'Combo Desktop', 'instance.lock'),
                // Check current directory
                path.join(process.cwd(), 'instance.lock')
            ];
            
            for (const lockFile of possiblePaths) {
                this.log(`Checking: ${lockFile}`);
                if (fs.existsSync(lockFile)) {
                    const content = fs.readFileSync(lockFile, 'utf8');
                    const data = JSON.parse(content);
                    this.log(`✅ Found lock file at: ${lockFile}`);
                    this.log(`Lock file content: ${JSON.stringify(data, null, 2)}`);
                    return data;
                }
            }
            
            this.log('❌ Lock file not found in any expected location');
            return null;
        } catch (error) {
            this.log(`Error reading lock file: ${error.message}`);
            return null;
        }
    }

    async spawnComboDesktop(command, timeout = 15000) {
        return new Promise((resolve, reject) => {
            this.log(`Spawning: yarn ${command}`);
            
            const proc = spawn('yarn', [command], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: __dirname,
                shell: true
            });

            this.processes.push(proc);
            
            let stdout = '';
            let stderr = '';
            
            proc.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                // Log real-time output for debugging
                this.log(`[${proc.pid || 'unknown'}] STDOUT: ${output.trim()}`);
            });
            
            proc.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                // Log real-time output for debugging  
                this.log(`[${proc.pid || 'unknown'}] STDERR: ${output.trim()}`);
            });
            
            const timer = setTimeout(() => {
                resolve({
                    pid: proc.pid,
                    process: proc,
                    stdout,
                    stderr,
                    timedOut: true
                });
            }, timeout);
            
            proc.on('spawn', () => {
                this.log(`Process spawned with PID: ${proc.pid}`);
                // Give the process time to initialize
                setTimeout(() => {
                    clearTimeout(timer);
                    resolve({
                        pid: proc.pid,
                        process: proc,
                        stdout,
                        stderr,
                        timedOut: false
                    });
                }, 5000); // Wait 5 seconds for initialization
            });
            
            proc.on('error', (error) => {
                clearTimeout(timer);
                reject(error);
            });

            proc.on('exit', (code) => {
                this.log(`Process ${proc.pid} exited with code: ${code}`);
            });
        });
    }

    async testDelegationAfterTrayFix() {
        this.log('=== Testing Delegation Behavior After Tray Fix ===');
        
        try {
            // Clean up first
            await this.cleanup();
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Step 1: Start WhatsApp instance
            this.log('Step 1: Starting WhatsApp instance...');
            const result1 = await this.spawnComboDesktop('whatsapp');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Check lock file after first instance
            this.log('Checking lock file after WhatsApp startup...');
            let lockData = await this.checkLockFile();
            const initialInstanceCount = lockData ? Object.keys(lockData.instances || {}).length : 0;
            this.log(`Initial instance count: ${initialInstanceCount}`);
            
            // Step 2: Start Facebook - should delegate to existing instance
            this.log('Step 2: Starting Facebook (should delegate to WhatsApp instance)...');
            const result2 = await this.spawnComboDesktop('facebook');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Check lock file after delegation attempt
            this.log('Checking lock file after Facebook startup...');
            lockData = await this.checkLockFile();
            const finalInstanceCount = lockData ? Object.keys(lockData.instances || {}).length : 0;
            this.log(`Final instance count: ${finalInstanceCount}`);
            
            // Analyze delegation behavior
            const delegationWorked = (finalInstanceCount === 1 && initialInstanceCount === 1);
            const delegationFailed = (finalInstanceCount > initialInstanceCount);
            
            // Check stdout/stderr for delegation messages
            const whatsappOutput = `${result1.stdout}\n${result1.stderr}`;
            const facebookOutput = `${result2.stdout}\n${result2.stderr}`;
            
            // Look for delegation-related messages
            const delegationMessages = [
                'delegation', 'delegating', 'delegated',
                'existing instance', 'instance found',
                'handleProfileSessionDelegation',
                'IPC', 'pipe'
            ];
            
            const hasDelegationMessages = delegationMessages.some(msg => 
                facebookOutput.toLowerCase().includes(msg.toLowerCase()) ||
                whatsappOutput.toLowerCase().includes(msg.toLowerCase())
            );
            
            // Check for error messages that might indicate delegation failure
            const errorMessages = [
                'error', 'failed', 'exception', 
                'connection refused', 'timeout',
                'not found', 'no suitable instance'
            ];
            
            const hasErrors = errorMessages.some(msg => 
                facebookOutput.toLowerCase().includes(msg.toLowerCase()) ||
                whatsappOutput.toLowerCase().includes(msg.toLowerCase())
            );
            
            this.log('\n=== Delegation Analysis ===');
            this.log(`Initial instances: ${initialInstanceCount}`);
            this.log(`Final instances: ${finalInstanceCount}`);
            this.log(`Delegation worked: ${delegationWorked}`);
            this.log(`Delegation failed: ${delegationFailed}`);
            this.log(`Has delegation messages: ${hasDelegationMessages}`);
            this.log(`Has error messages: ${hasErrors}`);
            
            this.testResults.push({
                test: 'Delegation After Tray Fix',
                passed: delegationWorked,
                details: `Expected: 1 instance, Got: ${finalInstanceCount}. Delegation messages: ${hasDelegationMessages}, Errors: ${hasErrors}`
            });
            
            // Log outputs for debugging
            this.log('\n=== WhatsApp Output ===');
            this.log(whatsappOutput);
            this.log('\n=== Facebook Output ===');
            this.log(facebookOutput);
            
        } catch (error) {
            this.testResults.push({
                test: 'Delegation After Tray Fix',
                passed: false,
                details: `Error: ${error.message}`
            });
        }
    }

    async runTest() {
        this.log('Starting Delegation Behavior Test...');
        
        await this.testDelegationAfterTrayFix();
        
        this.printResults();
    }

    printResults() {
        this.log('\n=== TEST RESULTS ===');
        
        let passed = 0;
        let total = this.testResults.length;
        
        for (const result of this.testResults) {
            const status = result.passed ? '✅ PASS' : '❌ FAIL';
            this.log(`${status} - ${result.test}: ${result.details}`);
            if (result.passed) passed++;
        }
        
        this.log(`\nSummary: ${passed}/${total} tests passed`);
        
        if (passed === total) {
            this.log('🎉 Delegation is working correctly after tray fix!');
            return true;
        } else {
            this.log('⚠️  Delegation issue detected after tray fix.');
            return false;
        }
    }
}

// Run the test
if (require.main === module) {
    const tester = new DelegationBehaviorTest();
    
    process.on('SIGINT', async () => {
        console.log('\nTest interrupted. Cleaning up...');
        await tester.cleanup();
        process.exit(1);
    });
    
    tester.runTest()
        .then(success => {
            return tester.cleanup().then(() => {
                process.exit(success ? 0 : 1);
            });
        })
        .catch(error => {
            console.error('Test suite failed:', error);
            tester.cleanup().then(() => process.exit(1));
        });
}

module.exports = DelegationBehaviorTest;
