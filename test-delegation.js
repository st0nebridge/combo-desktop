/**
 * Test script to verify instance delegation and default profile exclusivity
 */

const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

class InstanceDelegationTest {
    constructor() {
        this.processes = [];
        this.testResults = [];
    }

    log(message) {
        console.log(`[TEST] ${message}`);
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

    async spawnComboDesktop(command, timeout = 10000) {
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
                stdout += data.toString();
            });
            
            proc.stderr.on('data', (data) => {
                stderr += data.toString();
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
                }, 3000);
            });
            
            proc.on('error', (error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }

    async checkLockFile() {
        try {
            const lockFileDir = path.join(os.tmpdir(), 'desk-tray');
            const lockFile = path.join(lockFileDir, 'instances.lock');
            
            if (fs.existsSync(lockFile)) {
                const content = fs.readFileSync(lockFile, 'utf8');
                const data = JSON.parse(content);
                this.log(`Lock file content: ${JSON.stringify(data, null, 2)}`);
                return data;
            } else {
                this.log('Lock file does not exist');
                return null;
            }
        } catch (error) {
            this.log(`Error reading lock file: ${error.message}`);
            return null;
        }
    }

    async testDefaultProfileExclusivity() {
        this.log('=== Testing Default Profile Exclusivity ===');
        
        try {
            // Clean up first
            await this.cleanup();
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Start WhatsApp with default profile
            this.log('Starting WhatsApp with default profile...');
            const result1 = await this.spawnComboDesktop('whatsapp');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Check lock file after first instance
            this.log('Checking lock file after WhatsApp startup...');
            let lockData = await this.checkLockFile();
            
            // Start Facebook with default profile - should delegate to existing WhatsApp instance
            this.log('Starting Facebook with default profile (should delegate)...');
            const result2 = await this.spawnComboDesktop('facebook');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Check lock file after second instance attempt
            this.log('Checking lock file after Facebook startup...');
            lockData = await this.checkLockFile();
            
            // Count running processes
            const runningProcesses = this.processes.filter(p => !p.killed);
            this.log(`Running processes: ${runningProcesses.length}`);
            
            // Check outputs for delegation messages
            const delegationFound = result2.stdout.includes('delegation') || 
                                   result2.stderr.includes('delegation') ||
                                   result2.stdout.includes('existing instance') ||
                                   result2.stderr.includes('existing instance');
            
            this.testResults.push({
                test: 'Default Profile Exclusivity',
                passed: delegationFound || runningProcesses.length <= 1,
                details: `Expected delegation or single process. Running: ${runningProcesses.length}, Delegation found: ${delegationFound}`
            });
            
        } catch (error) {
            this.testResults.push({
                test: 'Default Profile Exclusivity',
                passed: false,
                details: `Error: ${error.message}`
            });
        }
    }

    async runTest() {
        this.log('Starting Instance Delegation Test...');
        
        await this.testDefaultProfileExclusivity();
        
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
            this.log('🎉 Instance delegation is working correctly!');
            return true;
        } else {
            this.log('⚠️  Instance delegation needs attention.');
            return false;
        }
    }
}

// Run the test
if (require.main === module) {
    const tester = new InstanceDelegationTest();
    
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

module.exports = InstanceDelegationTest;
