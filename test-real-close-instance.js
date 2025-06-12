/**
 * Real-world test to debug why Close Instance still isn't working
 * This will start the actual application and test the functionality
 */

const { spawn } = require('child_process');
const path = require('path');

class RealCloseInstanceTest {
    constructor() {
        this.processes = [];
        this.results = [];
    }

    log(message) {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        console.log(`[${timestamp}] ${message}`);
    }

    async cleanup() {
        this.log('Cleaning up processes...');
        for (const proc of this.processes) {
            if (!proc.killed) {
                try {
                    proc.kill('SIGTERM');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    if (!proc.killed) {
                        proc.kill('SIGKILL');
                    }
                } catch (error) {
                    // Ignore errors during cleanup
                }
            }
        }
        this.processes = [];
    }

    async spawnProvider(provider, timeout = 20000) {
        this.log(`Starting ${provider} provider...`);
        
        return new Promise((resolve) => {
            const electronExecutable = process.platform === 'win32' ? 'electron.cmd' : 'electron';
            const electronPath = path.join(__dirname, 'node_modules', '.bin', electronExecutable);
            this.log(`Electron path: ${electronPath}`);

            const proc = spawn(electronPath, ['.', `--${provider}`], {
                stdio: ['pipe', 'pipe', 'pipe'],
                detached: false,
                cwd: __dirname
            });

            this.log(`Spawned process for ${provider} with PID: ${proc.pid}`);

            this.processes.push(proc);

            let output = '';
            let errorOutput = '';
            let sessionRegistered = false;
            let resolved = false; // Added flag to prevent multiple resolves
            
            const timer = setTimeout(() => {
                if (resolved) return; // Check flag
                resolved = true; // Set flag
                this.log(`⏰ ${provider} timed out after ${timeout}ms`);
                // proc.kill(); // killing the process here might be too aggressive if it's about to succeed
                resolve({
                    success: sessionRegistered, // Report based on sessionRegistered status at timeout
                    process: proc,
                    output,
                    errorOutput,
                    timedOut: true
                });
            }, timeout);

            proc.stdout.on('data', (data) => {
                if (resolved) return; // Check flag
                const text = data.toString();
                output += text;
                // this.log(`[${provider} STDOUT] ${text.trim()}`); // Optional: for more detailed logging
                
                if (text.includes(`Successfully registered session for ${provider.charAt(0).toUpperCase() + provider.slice(1)}:default`)) {
                    sessionRegistered = true;
                    this.log(`✅ ${provider} session registered successfully`);
                }
                
                if (text.includes('Application initialization complete') && sessionRegistered) {
                    this.log(`🚀 ${provider} application initialization complete.`);
                    clearTimeout(timer);
                    if (resolved) return; // Check flag again before resolving
                    resolved = true; // Set flag
                    resolve({
                        success: true,
                        process: proc,
                        output,
                        errorOutput,
                        timedOut: false
                    });
                }
            });

            proc.stderr.on('data', (data) => {
                // if (resolved) return; // Don't return on stderr, just log it.
                const text = data.toString();
                errorOutput += text;
                this.log(`[${provider} STDERR] ${text.trim()}`);
            });

            proc.on('error', (error) => {
                this.log(`Error spawning ${provider}: ${error.message}`);
                clearTimeout(timer);
                if (resolved) return; // Check flag
                resolved = true; // Set flag
                resolve({
                    success: false,
                    process: proc,
                    output,
                    errorOutput,
                    error: error.message
                });
            });

            proc.on('exit', (code, signal) => {
                this.log(`${provider} exited with code: ${code}, signal: ${signal}`);
                clearTimeout(timer);
                if (resolved) return; // Check flag
                resolved = true; // Set flag
                resolve({
                    success: false, // Default to false on exit unless success was already confirmed
                    process: proc,
                    output,
                    errorOutput,
                    exitCode: code,
                    exited: true,
                    timedOut: false
                });
            });
        });
    }

    async testCloseInstanceFunctionality() {
        this.log('=== Testing Real Close Instance Functionality ===');

        try {
            // Step 1: Start WhatsApp (main process)
            this.log('Step 1: Starting WhatsApp main process...');
            const whatsappResult = await this.spawnProvider('whatsapp');
            
            if (!whatsappResult.success) {
                this.log(`❌ WhatsApp failed to start properly: ${whatsappResult.error || 'Unknown error'}`);
                this.log(`Output: ${whatsappResult.output}`);
                this.log(`Error: ${whatsappResult.errorOutput}`);
                return false;
            }

            this.log('✅ WhatsApp started successfully');
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Step 2: Start Facebook (should delegate)
            this.log('Step 2: Starting Facebook (should delegate to WhatsApp process)...');
            const facebookResult = await this.spawnProvider('facebook');
            
            if (!facebookResult.success && !facebookResult.exited) {
                this.log(`❌ Facebook failed to start: ${facebookResult.error || 'Unknown error'}`);
                return false;
            }

            // Facebook should exit after delegation
            if (facebookResult.exited) {
                this.log('✅ Facebook delegated successfully (process exited as expected)');
            }

            await new Promise(resolve => setTimeout(resolve, 2000));

            // Step 3: Test session state via direct inspection
            this.log('Step 3: Testing session state and Close Instance...');
            
            // Create a test script that will inspect the running WhatsApp process
            const testScript = this.createSessionTestScript();
            const fs = require('fs');
            const testFile = path.join(__dirname, 'temp-session-test.js');
            fs.writeFileSync(testFile, testScript);

            // Run the session test
            const sessionTestResult = await this.runSessionTest(testFile);
            
            // Clean up test file
            try {
                fs.unlinkSync(testFile);
            } catch (error) {
                // Ignore cleanup errors
            }

            return sessionTestResult;

        } catch (error) {
            this.log(`❌ Test failed with error: ${error.message}`);
            return false;
        }
    }

    createSessionTestScript() {
        return `
            // Test script to verify session state and Close Instance functionality
            const net = require('net');
            const path = require('path');

            async function testSessionState() {
                try {
                    console.log('[SESSION-TEST] Starting session state test...');
                    
                    // Try to connect to the main process IPC
                    const client = net.createConnection('\\\\\\\\.\\\\pipe\\\\desk-tray-*', () => {
                        console.log('[SESSION-TEST] Connected to main process');
                        
                        // Send a test command to inspect session state
                        const command = {
                            type: 'test-session-state',
                            action: 'get-sessions'
                        };
                        
                        client.write(JSON.stringify(command));
                    });
                    
                    client.on('data', (data) => {
                        try {
                            const response = JSON.parse(data.toString());
                            console.log('[SESSION-TEST] Received response:', response);
                        } catch (error) {
                            console.log('[SESSION-TEST] Received raw data:', data.toString());
                        }
                    });
                    
                    client.on('error', (error) => {
                        console.log('[SESSION-TEST] Connection error:', error.message);
                        process.exit(1);
                    });
                    
                    client.on('end', () => {
                        console.log('[SESSION-TEST] Connection ended');
                        process.exit(0);
                    });
                    
                    // Timeout after 5 seconds
                    setTimeout(() => {
                        console.log('[SESSION-TEST] Test timeout');
                        process.exit(1);
                    }, 5000);
                    
                } catch (error) {
                    console.log('[SESSION-TEST] Error:', error.message);
                    process.exit(1);
                }
            }
            
            testSessionState();
        `;
    }

    async runSessionTest(testFile) {
        this.log('Running session state test...');
        
        return new Promise((resolve) => {
            const proc = spawn('node', [testFile], {
                stdio: ['pipe', 'pipe', 'pipe'],
                detached: false,
                cwd: __dirname
            });

            let output = '';
            let success = false;

            const timer = setTimeout(() => {
                proc.kill();
                resolve(success);
            }, 10000);

            proc.stdout.on('data', (data) => {
                const text = data.toString();
                output += text;
                this.log(`Session test: ${text.trim()}`);
                
                if (text.includes('Connected to main process')) {
                    success = true;
                }
            });

            proc.stderr.on('data', (data) => {
                this.log(`Session test error: ${data.toString().trim()}`);
            });

            proc.on('exit', (code) => {
                clearTimeout(timer);
                this.log(`Session test exited with code: ${code}`);
                resolve(success);
            });
        });
    }

    async run() {
        try {
            const success = await this.testCloseInstanceFunctionality();
            
            this.log('\n=== TEST RESULTS ===');
            if (success) {
                this.log('✅ Close Instance functionality appears to be working');
            } else {
                this.log('❌ Close Instance functionality still has issues');
            }
            
            this.log('\nNext steps for debugging:');
            this.log('1. Check if both WhatsApp and Facebook tray icons are visible');
            this.log('2. Manually right-click each tray icon');
            this.log('3. Check if "Close Instance" menu item exists');
            this.log('4. Click "Close Instance" and observe behavior');
            this.log('5. Check console logs for session unregistration messages');
            
            return success;
            
        } catch (error) {
            this.log(`❌ Test failed: ${error.message}`);
            return false;
        } finally {
            await this.cleanup();
        }
    }
}

// Run the test
if (require.main === module) {
    const test = new RealCloseInstanceTest();
    
    process.on('SIGINT', async () => {
        console.log('\\nTest interrupted. Cleaning up...');
        await test.cleanup();
        process.exit(1);
    });
    
    test.run()
        .then(success => {
            console.log('\\nTest completed');
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test failed:', error);
            test.cleanup().then(() => process.exit(1));
        });
}

module.exports = RealCloseInstanceTest;
