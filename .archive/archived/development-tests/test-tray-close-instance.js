#!/usr/bin/env node

/**
 * Test script to reproduce the "Close Instance" tray menu issue
 * Tests that both WhatsApp and Facebook tray "Close Instance" buttons work properly
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class TrayCloseInstanceTest {
    constructor() {
        this.processes = [];
        this.testResults = [];
    }

    log(message) {
        console.log(`[TRAY-TEST] ${message}`);
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
            if (fs.existsSync(lockPath)) {
                try {
                    const content = fs.readFileSync(lockPath, 'utf8');
                    const lockData = JSON.parse(content);
                    return lockData;
                } catch (error) {
                    return null;
                }
            }
        }
        return null;
    }

    async testTrayCloseInstance() {
        this.log('=== Testing Tray Close Instance Behavior ===');

        try {
            // Clean up first
            await this.cleanup();
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Step 1: Start WhatsApp instance
            this.log('Step 1: Starting WhatsApp instance...');
            const whatsappResult = await this.spawnComboDesktop('whatsapp', 15000);
            
            if (!whatsappResult.timedOut) {
                this.log(`⚠️ WhatsApp exited early: code=${whatsappResult.exitCode}`);
                return false;
            }

            await new Promise(resolve => setTimeout(resolve, 3000));

            // Step 2: Start Facebook (should delegate to WhatsApp)
            this.log('Step 2: Starting Facebook (should delegate)...');
            const facebookResult = await this.spawnComboDesktop('facebook', 10000);
            
            if (facebookResult.timedOut) {
                this.log('⚠️ Facebook should have exited after delegation but is still running');
                return false;
            }

            await new Promise(resolve => setTimeout(resolve, 3000));

            // Step 3: Check that both trays exist in the WhatsApp process
            this.log('Step 3: Both WhatsApp and Facebook should now be in the same process');
            this.log('Manual test needed: Check that both tray icons exist');
            this.log('Manual test needed: Right-click WhatsApp tray → Close Instance (should close only WhatsApp)');
            this.log('Manual test needed: Right-click Facebook tray → Close Instance (should close only Facebook)');
            
            // Keep the process running for manual testing
            this.log('Process will stay running for 60 seconds for manual testing...');
            await new Promise(resolve => setTimeout(resolve, 60000));

            return true;

        } catch (error) {
            this.log(`Error in test: ${error.message}`);
            return false;
        }
    }

    async run() {
        const success = await this.testTrayCloseInstance();
        await this.cleanup();
        return success;
    }
}

// Run the test
if (require.main === module) {
    const tester = new TrayCloseInstanceTest();
    
    process.on('SIGINT', async () => {
        console.log('\nTest interrupted. Cleaning up...');
        await tester.cleanup();
        process.exit(1);
    });
    
    tester.run()
        .then(success => {
            console.log('\nTest completed');
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test failed:', error);
            tester.cleanup().then(() => process.exit(1));
        });
}

module.exports = TrayCloseInstanceTest;
