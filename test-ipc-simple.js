#!/usr/bin/env node

/**
 * Simple IPC communication test for instance delegation
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class SimpleIPCTest {
    constructor() {
        this.processes = [];
        this.testResults = [];
    }

    async log(message) {
        console.log(`[IPC-TEST] ${message}`);
    }

    async cleanup() {
        this.log('Cleaning up test processes...');
        
        for (const proc of this.processes) {
            try {
                if (proc && proc.pid && !proc.killed) {
                    process.kill(proc.pid, 'SIGTERM');
                    this.log(`Killed process ${proc.pid}`);
                }
            } catch (error) {
                // Process might already be dead
            }
        }
        
        this.processes = [];
        
        // Clean up any lock files
        const userDataPath = path.join(require('os').homedir(), 'AppData', 'Roaming', 'combo-desktop');
        const lockFile = path.join(userDataPath, 'instance.lock');
        
        if (fs.existsSync(lockFile)) {
            try {
                fs.unlinkSync(lockFile);
                this.log('Removed lock file');
            } catch (error) {
                this.log(`Could not remove lock file: ${error.message}`);
            }
        }
    }

    async runTest() {
        this.log('Starting simple IPC communication test...');
        
        try {
            // Test 1: Start WhatsApp 
            this.log('=== Test 1: Starting WhatsApp (default profile) ===');
            const whatsappProc = this.spawnComboDesktop('yarn whatsapp');
            this.processes.push(whatsappProc);
            
            // Wait a bit for the first instance to initialize
            await this.wait(5000);
            
            // Check if lock file exists
            const userDataPath = path.join(require('os').homedir(), 'AppData', 'Roaming', 'combo-desktop');
            const lockFile = path.join(userDataPath, 'instance.lock');
            
            if (fs.existsSync(lockFile)) {
                this.log('✅ Lock file created by first instance');
                try {
                    const lockData = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
                    this.log(`Lock file contains ${Object.keys(lockData.instances || {}).length} instances`);
                    
                    for (const [id, instance] of Object.entries(lockData.instances || {})) {
                        this.log(`  - Instance ${id}: PID ${instance.pid}, Profile: ${instance.profile}, Pipe: ${instance.pipeName}`);
                    }
                } catch (error) {
                    this.log(`❌ Could not read lock file: ${error.message}`);
                }
            } else {
                this.log('❌ Lock file not found');
            }
            
            // Test 2: Start Facebook (should delegate to existing instance)
            this.log('=== Test 2: Starting Facebook (should delegate) ===');
            const facebookProc = this.spawnComboDesktop('yarn facebook');
            this.processes.push(facebookProc);
            
            // Wait for delegation to complete
            await this.wait(8000);
            
            // Check the lock file again
            if (fs.existsSync(lockFile)) {
                try {
                    const lockData = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
                    const instanceCount = Object.keys(lockData.instances || {}).length;
                    this.log(`Lock file now contains ${instanceCount} instances`);
                    
                    if (instanceCount === 1) {
                        this.log('✅ SUCCESS: Only one instance in lock file (delegation worked)');
                        this.testResults.push('PASS: Default profile exclusivity');
                    } else {
                        this.log(`❌ FAIL: Expected 1 instance, found ${instanceCount} (delegation failed)`);
                        this.testResults.push('FAIL: Default profile exclusivity');
                        
                        for (const [id, instance] of Object.entries(lockData.instances || {})) {
                            this.log(`  - Instance ${id}: PID ${instance.pid}, Profile: ${instance.profile}`);
                        }
                    }
                } catch (error) {
                    this.log(`❌ Could not read lock file: ${error.message}`);
                    this.testResults.push('FAIL: Lock file reading error');
                }
            } else {
                this.log('❌ Lock file disappeared');
                this.testResults.push('FAIL: Lock file missing');
            }
            
            // Check if processes are actually running
            const runningProcesses = this.processes.filter(proc => proc && proc.pid && !proc.killed);
            this.log(`Running processes: ${runningProcesses.length}`);
            
        } catch (error) {
            this.log(`❌ Test error: ${error.message}`);
            this.testResults.push('FAIL: Test execution error');
        } finally {
            await this.cleanup();
        }
        
        // Report results
        this.log('\n=== TEST RESULTS ===');
        const passCount = this.testResults.filter(r => r.startsWith('PASS')).length;
        const totalCount = this.testResults.length;
        
        this.testResults.forEach(result => {
            const status = result.startsWith('PASS') ? '✅' : '❌';
            this.log(`${status} ${result}`);
        });
        
        this.log(`\nSummary: ${passCount}/${totalCount} tests passed`);
        
        if (passCount === totalCount) {
            this.log('🎉 All tests passed! IPC delegation is working.');
            process.exit(0);
        } else {
            this.log('⚠️  Some tests failed. IPC delegation needs attention.');
            process.exit(1);
        }
    }

    spawnComboDesktop(command) {
        this.log(`Spawning: ${command}`);
        const proc = spawn('cmd', ['/c', command], {
            detached: false,
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: process.cwd()
        });
        
        if (proc.pid) {
            this.log(`Process spawned with PID: ${proc.pid}`);
        }
        
        // Log output for debugging
        proc.stdout?.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                this.log(`[${proc.pid}] STDOUT: ${output}`);
            }
        });
        
        proc.stderr?.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                this.log(`[${proc.pid}] STDERR: ${output}`);
            }
        });
        
        proc.on('exit', (code) => {
            this.log(`Process ${proc.pid} exited with code: ${code}`);
        });
        
        return proc;
    }

    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the test
if (require.main === module) {
    const test = new SimpleIPCTest();
    
    // Handle cleanup on exit
    process.on('SIGINT', async () => {
        console.log('\nReceived SIGINT, cleaning up...');
        await test.cleanup();
        process.exit(1);
    });
    
    process.on('SIGTERM', async () => {
        console.log('\nReceived SIGTERM, cleaning up...');
        await test.cleanup();
        process.exit(1);
    });
    
    test.runTest().catch(error => {
        console.error('Test failed:', error);
        test.cleanup().then(() => process.exit(1));
    });
}
