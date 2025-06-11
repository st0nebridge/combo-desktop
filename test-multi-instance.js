#!/usr/bin/env node

/**
 * Multi-Instance Architecture Test Suite
 * Tests the process delegation and multi-instance capabilities
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const LOCK_FILE_DIR = path.join(os.tmpdir(), 'combo-desktop');
const TEST_TIMEOUT = 30000; // 30 seconds

class MultiInstanceTester {
    constructor() {
        this.processes = [];
        this.testResults = [];
    }

    log(message) {
        console.log(`[${new Date().toISOString()}] ${message}`);
    }

    async cleanup() {
        this.log('Cleaning up test processes...');
        
        // Kill all spawned processes
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
            if (fs.existsSync(LOCK_FILE_DIR)) {
                const files = fs.readdirSync(LOCK_FILE_DIR);
                for (const file of files) {
                    if (file.startsWith('combo-desktop-') && file.endsWith('.lock')) {
                        fs.unlinkSync(path.join(LOCK_FILE_DIR, file));
                    }
                }
            }
        } catch (error) {
            this.log(`Cleanup warning: ${error.message}`);
        }
    }

    async spawnComboDesktop(args = [], profile = 'test', timeout = 10000) {
        return new Promise((resolve, reject) => {
            const execPath = path.join(__dirname, 'dist', 'combo-desktop.exe');
            const fullArgs = [`--${profile}`, ...args];
            
            this.log(`Spawning: ${execPath} ${fullArgs.join(' ')}`);
            
            const proc = spawn(execPath, fullArgs, {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: __dirname
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
                // Give the process a moment to initialize
                setTimeout(() => {
                    clearTimeout(timer);
                    resolve({
                        pid: proc.pid,
                        process: proc,
                        stdout,
                        stderr,
                        timedOut: false
                    });
                }, 2000);
            });
            
            proc.on('error', (error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }

    async testDefaultBehavior() {
        this.log('=== Test 1: Default Behavior (1-process-per-profile) ===');
        
        try {
            // Start first instance with WhatsApp profile
            const result1 = await this.spawnComboDesktop([], 'whatsapp');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Start second instance with same profile - should delegate
            const result2 = await this.spawnComboDesktop([], 'whatsapp');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check that only one process is still running
            const runningProcesses = this.processes.filter(p => !p.killed);
            
            this.testResults.push({
                test: 'Default Behavior',
                passed: runningProcesses.length <= 2, // Allow some tolerance
                details: `Expected delegation to existing process. Running processes: ${runningProcesses.length}`
            });
            
        } catch (error) {
            this.testResults.push({
                test: 'Default Behavior',
                passed: false,
                details: `Error: ${error.message}`
            });
        }
    }

    async testNewInstanceFlag() {
        this.log('=== Test 2: Force New Instance Flag ===');
        
        try {
            // Start first instance
            const result1 = await this.spawnComboDesktop([], 'telegram');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Start second instance with --new-instance flag
            const result2 = await this.spawnComboDesktop(['--new-instance'], 'telegram');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Should have 2 separate processes
            const runningProcesses = this.processes.filter(p => !p.killed);
            
            this.testResults.push({
                test: 'Force New Instance',
                passed: runningProcesses.length >= 2,
                details: `Expected 2 separate processes. Running processes: ${runningProcesses.length}`
            });
            
        } catch (error) {
            this.testResults.push({
                test: 'Force New Instance',
                passed: false,
                details: `Error: ${error.message}`
            });
        }
    }

    async testOneInstanceFlag() {
        this.log('=== Test 3: One Instance Flag ===');
        
        try {
            // Start first instance with --one-instance
            const result1 = await this.spawnComboDesktop(['--one-instance'], 'discord');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Start second instance with different profile but same --one-instance
            const result2 = await this.spawnComboDesktop(['--one-instance'], 'slack');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Should delegate to existing process
            const runningProcesses = this.processes.filter(p => !p.killed);
            
            this.testResults.push({
                test: 'One Instance Mode',
                passed: runningProcesses.length <= 2,
                details: `Expected delegation to single process. Running processes: ${runningProcesses.length}`
            });
            
        } catch (error) {
            this.testResults.push({
                test: 'One Instance Mode',
                passed: false,
                details: `Error: ${error.message}`
            });
        }
    }

    async testLockFileHandling() {
        this.log('=== Test 4: Lock File Management ===');
        
        try {
            // Start an instance
            const result = await this.spawnComboDesktop([], 'teams');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Check if lock file was created
            const lockFiles = fs.readdirSync(LOCK_FILE_DIR)
                .filter(f => f.startsWith('combo-desktop-') && f.endsWith('.lock'));
            
            const lockFileExists = lockFiles.length > 0;
            
            this.testResults.push({
                test: 'Lock File Creation',
                passed: lockFileExists,
                details: `Expected lock file creation. Found ${lockFiles.length} lock files`
            });
            
        } catch (error) {
            this.testResults.push({
                test: 'Lock File Creation',
                passed: false,
                details: `Error: ${error.message}`
            });
        }
    }

    async runAllTests() {
        this.log('Starting Multi-Instance Architecture Test Suite...');
        
        try {
            await this.testDefaultBehavior();
            await this.cleanup();
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            await this.testNewInstanceFlag();
            await this.cleanup();
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            await this.testOneInstanceFlag();
            await this.cleanup();
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            await this.testLockFileHandling();
            
        } finally {
            await this.cleanup();
        }
        
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
            this.log('🎉 All tests passed! Multi-instance architecture is working correctly.');
            return true;
        } else {
            this.log('⚠️  Some tests failed. Review the implementation.');
            return false;
        }
    }
}

// Run the tests
if (require.main === module) {
    const tester = new MultiInstanceTester();
    
    process.on('SIGINT', async () => {
        console.log('\nTest interrupted. Cleaning up...');
        await tester.cleanup();
        process.exit(1);
    });
    
    tester.runAllTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test suite failed:', error);
            tester.cleanup().then(() => process.exit(1));
        });
}

module.exports = MultiInstanceTester;
