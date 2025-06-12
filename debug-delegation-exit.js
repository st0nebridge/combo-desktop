/**
 * Debug script to investigate why processes don't exit after delegation
 */

const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

class DelegationExitDebugger {
    constructor() {
        this.processes = [];
    }

    log(message) {
        console.log(`[DEBUG-EXIT] ${message}`);
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
        this.processes = [];
    }

    async spawnComboDesktop(command, timeout = 10000) {
        return new Promise((resolve, reject) => {
            this.log(`Spawning: yarn ${command}`);
            const proc = spawn('yarn', [command], {
                cwd: process.cwd(),
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true
            });

            this.processes.push(proc);

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => {
                const text = data.toString();
                stdout += text;
                this.log(`[${proc.pid}] STDOUT: ${text.trim()}`);
            });

            proc.stderr.on('data', (data) => {
                const text = data.toString();
                stderr += text;
                this.log(`[${proc.pid}] STDERR: ${text.trim()}`);
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
            });

            proc.on('error', (error) => {
                clearTimeout(timer);
                reject(error);
            });

            proc.on('exit', (code, signal) => {
                clearTimeout(timer);
                this.log(`Process ${proc.pid} exited with code: ${code}, signal: ${signal}`);
                resolve({
                    pid: proc.pid,
                    process: proc,
                    stdout,
                    stderr,
                    timedOut: false,
                    exitCode: code,
                    exitSignal: signal
                });
            });
        });
    }

    async checkLockFile() {
        const possiblePaths = [
            path.join(os.tmpdir(), 'desk-tray', 'instance.lock'),
            path.join(os.homedir(), 'AppData', 'Roaming', 'combo-desktop', 'instance.lock'),
            path.join(os.homedir(), 'AppData', 'Roaming', 'desk-tray', 'instance.lock')
        ];

        for (const lockPath of possiblePaths) {
            this.log(`Checking: ${lockPath}`);
            if (fs.existsSync(lockPath)) {
                this.log(`✅ Found lock file at: ${lockPath}`);
                try {
                    const content = fs.readFileSync(lockPath, 'utf8');
                    const lockData = JSON.parse(content);
                    this.log(`Lock file content: ${JSON.stringify(lockData, null, 2)}`);
                    return lockData;
                } catch (error) {
                    this.log(`❌ Error reading lock file: ${error.message}`);
                    return null;
                }
            }
        }

        this.log('❌ No lock file found');
        return null;
    }

    async testDelegationExit() {
        this.log('=== Testing Delegation Exit Behavior ===');

        try {
            // Clean up first
            await this.cleanup();
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Step 1: Start WhatsApp and let it fully initialize
            this.log('Step 1: Starting WhatsApp instance...');
            const whatsappResult = await this.spawnComboDesktop('whatsapp', 8000);
            
            // Check if WhatsApp exited early (which it shouldn't on first run)
            if (!whatsappResult.timedOut) {
                this.log(`⚠️ WhatsApp exited early: code=${whatsappResult.exitCode}, signal=${whatsappResult.exitSignal}`);
            } else {
                this.log(`✅ WhatsApp is running (PID: ${whatsappResult.pid})`);
            }

            await new Promise(resolve => setTimeout(resolve, 2000));

            // Check lock file after WhatsApp starts
            this.log('Checking lock file after WhatsApp startup...');
            let lockData = await this.checkLockFile();
            const initialInstanceCount = lockData ? Object.keys(lockData.instances || {}).length : 0;
            this.log(`Initial instance count: ${initialInstanceCount}`);

            // Step 2: Start Facebook - should delegate to WhatsApp and exit
            this.log('Step 2: Starting Facebook (should delegate and exit)...');
            const facebookResult = await this.spawnComboDesktop('facebook', 8000);

            // Check Facebook exit behavior
            if (!facebookResult.timedOut) {
                this.log(`✅ Facebook process exited: code=${facebookResult.exitCode}, signal=${facebookResult.exitSignal}`);
                this.log(`Facebook output length: ${facebookResult.stdout.length + facebookResult.stderr.length} chars`);
            } else {
                this.log(`⚠️ Facebook is still running (PID: ${facebookResult.pid})`);
            }

            await new Promise(resolve => setTimeout(resolve, 2000));

            // Check lock file after Facebook attempt
            this.log('Checking lock file after Facebook startup...');
            lockData = await this.checkLockFile();
            const finalInstanceCount = lockData ? Object.keys(lockData.instances || {}).length : 0;
            this.log(`Final instance count: ${finalInstanceCount}`);

            // Analyze results
            this.log('\n=== Analysis ===');
            this.log(`Initial instances: ${initialInstanceCount}`);
            this.log(`Final instances: ${finalInstanceCount}`);
            this.log(`WhatsApp still running: ${whatsappResult.timedOut}`);
            this.log(`Facebook exited: ${!facebookResult.timedOut}`);

            // Look for delegation messages
            const combinedOutput = facebookResult.stdout + facebookResult.stderr;
            const hasDelegationMessages = combinedOutput.includes('delegation') || 
                                        combinedOutput.includes('delegating') ||
                                        combinedOutput.includes('existing instance');
            this.log(`Has delegation messages: ${hasDelegationMessages}`);

            // Look for exit messages
            const hasExitMessages = combinedOutput.includes('All sessions delegated') ||
                                   combinedOutput.includes('quitting this instance');
            this.log(`Has exit messages: ${hasExitMessages}`);

            // Look for error messages
            const hasErrors = combinedOutput.toLowerCase().includes('error') ||
                            combinedOutput.toLowerCase().includes('epipe') ||
                            combinedOutput.toLowerCase().includes('broken pipe');
            this.log(`Has error messages: ${hasErrors}`);

            this.log('\n=== Facebook Output ===');
            this.log('STDOUT:');
            this.log(facebookResult.stdout);
            this.log('\nSTDERR:');
            this.log(facebookResult.stderr);

        } catch (error) {
            this.log(`Error in test: ${error.message}`);
        }
    }

    async run() {
        await this.testDelegationExit();
        await this.cleanup();
    }
}

// Run the test
if (require.main === module) {
    const exitDebugger = new DelegationExitDebugger();
    
    process.on('SIGINT', async () => {
        console.log('\nTest interrupted. Cleaning up...');
        await exitDebugger.cleanup();
        process.exit(1);
    });
    
    exitDebugger.run()
        .then(() => {
            console.log('\nDebug test completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('Debug test failed:', error);
            exitDebugger.cleanup().then(() => process.exit(1));
        });
}

module.exports = DelegationExitDebugger;
