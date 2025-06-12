#!/usr/bin/env node

/**
 * Debug script to investigate tray close instance behavior
 * This will set up the delegation scenario and then debug the session state
 */

const { spawn } = require('child_process');
const path = require('path');

class TrayCloseDebugger {
    constructor() {
        this.processes = [];
    }

    log(message) {
        console.log(`[TRAY-DEBUG] ${message}`);
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

    async spawnAndWait(command, timeoutMs = 15000) {
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
                // Only log important messages to reduce noise
                if (text.includes('[info]') || text.includes('[error]') || text.includes('Done in')) {
                    this.log(`[${proc.pid}] ${text.trim()}`);
                }
            });

            proc.stderr.on('data', (data) => {
                const text = data.toString();
                stderr += text;
                this.log(`[${proc.pid}] ERROR: ${text.trim()}`);
            });

            const timer = setTimeout(() => {
                resolve({
                    pid: proc.pid,
                    process: proc,
                    stdout,
                    stderr,
                    timedOut: true
                });
            }, timeoutMs);

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

    async setupDelegationScenario() {
        this.log('=== Setting up delegation scenario ===');

        // Start WhatsApp first
        this.log('Starting WhatsApp...');
        const whatsappResult = await this.spawnAndWait('whatsapp', 15000);
        
        if (!whatsappResult.timedOut) {
            this.log(`⚠️ WhatsApp exited early: code=${whatsappResult.exitCode}`);
            return false;
        }

        await new Promise(resolve => setTimeout(resolve, 3000));

        // Start Facebook (should delegate)
        this.log('Starting Facebook (should delegate)...');
        const facebookResult = await this.spawnAndWait('facebook', 10000);
        
        if (facebookResult.timedOut) {
            this.log('⚠️ Facebook should have exited after delegation');
            return false;
        }

        this.log('✅ Delegation scenario setup complete');
        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
    }

    async debugSessionState() {
        this.log('=== Debugging session state ===');
        
        // The WhatsApp process should now have both sessions
        this.log('Both WhatsApp and Facebook should be running in the same process');
        this.log('Now we need to manually test the tray behavior...');
        
        return true;
    }

    async run() {
        try {
            await this.cleanup();
            
            const setupSuccess = await this.setupDelegationScenario();
            if (!setupSuccess) {
                this.log('❌ Failed to set up delegation scenario');
                return false;
            }

            await this.debugSessionState();
            
            this.log('\n=== Manual Testing Instructions ===');
            this.log('1. Both WhatsApp and Facebook tray icons should be visible');
            this.log('2. Right-click WhatsApp tray → "Close Instance" (should close WhatsApp only)');
            this.log('3. Right-click Facebook tray → "Close Instance" (should close Facebook only)');
            this.log('4. Check which one actually works vs which one just logs but does nothing');
            this.log('\nKeeping process running for 60 seconds for manual testing...');
            
            await new Promise(resolve => setTimeout(resolve, 60000));
            
            return true;
        } catch (error) {
            this.log(`Error: ${error.message}`);
            return false;
        } finally {
            await this.cleanup();
        }
    }
}

// Run the debugger
if (require.main === module) {
    const debugger = new TrayCloseDebugger();
    
    process.on('SIGINT', async () => {
        console.log('\nDebugger interrupted. Cleaning up...');
        await debugger.cleanup();
        process.exit(1);
    });
    
    debugger.run()
        .then(success => {
            console.log('\nDebugger completed');
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Debugger failed:', error);
            debugger.cleanup().then(() => process.exit(1));
        });
}

module.exports = TrayCloseDebugger;
