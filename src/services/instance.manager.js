const { app } = require('electron');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

class InstanceManager {
    constructor() {
        const userData = app.getPath('userData');
        this.instanceLockFile = path.join(userData, 'instance.lock');
        this.pidFile = path.join(userData, 'pids.json');
        this.activeSessions = new Map();
        this.instanceId = null;
        this.isFirstInstance = false;
    }

    async initialize() {
        try {
            this.instanceId = Date.now().toString();
            
            // Handle reset-lock command
            const providerCLI = require('../cli/provider-cli');
            if (providerCLI.shouldResetLock()) {
                await this.resetLock();
                return true;
            }

            // Request single instance lock
            this.isFirstInstance = app.requestSingleInstanceLock();
            if (!this.isFirstInstance && !providerCLI.shouldForceNewInstance()) {
                return false;
            }

            // Initialize lock file if first instance
            if (this.isFirstInstance) {
                app.on('second-instance', (event, argv) => {
                    this.handleSecondInstance(argv);
                });
                await this.initializeLockFile();
            }

            // Register this instance's PID if it's not a CLI command
            if (!providerCLI.isCliCommand()) {
                await this.registerPid();
            }

            return true;
        } catch (error) {
            log.error('Error initializing instance manager:', error);
            return false;
        }
    }

    async registerPid() {
        try {
            const pid = process.pid;
            let pids = [];

            // Read existing PIDs
            if (fs.existsSync(this.pidFile)) {
                try {
                    const data = await fs.promises.readFile(this.pidFile, 'utf8');
                    pids = JSON.parse(data);
                } catch (error) {
                    log.error('Error reading PID file:', error);
                }
            }

            // Clean up stale PIDs
            pids = pids.filter(pid => {
                try {
                    // Check if process exists
                    process.kill(pid, 0);
                    return true;
                } catch (error) {
                    return false;
                }
            });

            // Add current PID if not already present
            if (!pids.includes(pid)) {
                pids.push(pid);
            }

            // Write updated PIDs
            await fs.promises.writeFile(this.pidFile, JSON.stringify(pids, null, 2));

            // Register cleanup on exit
            const cleanup = async () => {
                await this.unregisterPid();
            };

            process.on('exit', cleanup);
            process.on('SIGINT', cleanup);
            process.on('SIGTERM', cleanup);
            process.on('uncaughtException', cleanup);

            log.info(`Registered PID: ${pid}`);
        } catch (error) {
            log.error('Error registering PID:', error);
        }
    }

    async unregisterPid() {
        try {
            if (!fs.existsSync(this.pidFile)) {
                return;
            }

            const pid = process.pid;
            const data = await fs.promises.readFile(this.pidFile, 'utf8');
            let pids = JSON.parse(data);

            // Remove current PID
            pids = pids.filter(p => p !== pid);

            // Write updated PIDs or delete file if empty
            if (pids.length > 0) {
                await fs.promises.writeFile(this.pidFile, JSON.stringify(pids, null, 2));
            } else {
                await fs.promises.unlink(this.pidFile);
            }

            log.info(`Unregistered PID: ${pid}`);
        } catch (error) {
            log.error('Error unregistering PID:', error);
        }
    }

    async killAllInstances() {
        try {
            if (!fs.existsSync(this.pidFile)) {
                return;
            }

            const data = await fs.promises.readFile(this.pidFile, 'utf8');
            const pids = JSON.parse(data);
            const currentPid = process.pid;

            // Kill all processes except current one
            for (const pid of pids) {
                if (pid !== currentPid) {
                    try {
                        if (process.platform === 'win32') {
                            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
                        } else {
                            process.kill(pid, 'SIGTERM');
                        }
                        log.info(`Killed process: ${pid}`);
                    } catch (error) {
                        // Process might not exist anymore
                        log.info(`Process ${pid} not found`);
                    }
                }
            }

            // Delete the PID file
            await fs.promises.unlink(this.pidFile);
            log.info('Removed PID file');
        } catch (error) {
            log.error('Error killing instances:', error);
        }
    }

    async resetLock() {
        try {
            log.info('Resetting instance lock file...');

            // Kill all other instances using PIDs
            await this.killAllInstances();

            // Delete the lock file
            try {
                if (fs.existsSync(this.instanceLockFile)) {
                    log.info('Deleting lock file...');
                    fs.unlinkSync(this.instanceLockFile);
                }
            } catch (error) {
                log.error('Error deleting lock file:', error);
            }

            // Release the single instance lock
            app.releaseSingleInstanceLock();

            // Wait a bit for the OS to clean up
            await new Promise(resolve => setTimeout(resolve, 1000));

            log.info('Instance lock has been reset');
            return true;
        } catch (error) {
            log.error('Error resetting instance lock:', error);
            return false;
        }
    }

    async initializeLockFile() {
        try {
            if (!fs.existsSync(this.instanceLockFile)) {
                await fs.promises.writeFile(this.instanceLockFile, JSON.stringify({
                    instances: {},
                    sessions: {}
                }, null, 2));
            }
        } catch (error) {
            log.error('Error initializing lock file:', error);
            throw error;
        }
    }

    async getLockFileData() {
        try {
            if (!fs.existsSync(this.instanceLockFile)) {
                return { instances: {}, sessions: {} };
            }
            const data = await fs.promises.readFile(this.instanceLockFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            log.error('Error reading lock file:', error);
            return { instances: {}, sessions: {} };
        }
    }

    async updateLockFile(data) {
        try {
            await fs.promises.writeFile(this.instanceLockFile, JSON.stringify(data, null, 2));
        } catch (error) {
            log.error('Error updating lock file:', error);
            throw error;
        }
    }

    async registerSession(provider, profile = 'default') {
        try {
            if (!provider || typeof provider.getPartitionName !== 'function') {
                log.error('Invalid provider or provider.getPartitionName is not a function');
                return false;
            }

            const sessionKey = provider.getPartitionName(profile);
            if (!sessionKey) {
                log.error('Failed to get session key from provider');
                return false;
            }

            const lockData = await this.getLockFileData();

            // Check if instance exists in lock file
            if (!lockData.instances[this.instanceId]) {
                lockData.instances[this.instanceId] = {
                    startTime: Date.now(),
                    sessions: []
                };
            }

            // Check if session exists in another instance
            if (lockData.sessions[sessionKey] && lockData.sessions[sessionKey] !== this.instanceId) {
                // Check if the instance holding the session still exists
                const instanceId = lockData.sessions[sessionKey];
                if (!lockData.instances[instanceId]) {
                    // Instance no longer exists, we can take over the session
                    delete lockData.sessions[sessionKey];
                } else {
                    return false;
                }
            }

            // Register session
            lockData.sessions[sessionKey] = this.instanceId;
            if (!lockData.instances[this.instanceId].sessions.includes(sessionKey)) {
                lockData.instances[this.instanceId].sessions.push(sessionKey);
            }
            
            await this.updateLockFile(lockData);
            this.activeSessions.set(sessionKey, this.instanceId);
            return true;
        } catch (error) {
            log.error('Error registering session:', error);
            return false;
        }
    }

    async unregisterSession(provider, profile = 'default') {
        try {
            if (!provider || typeof provider.getPartitionName !== 'function') {
                log.error('Invalid provider or provider.getPartitionName is not a function');
                return;
            }

            const sessionKey = provider.getPartitionName(profile);
            if (!sessionKey) {
                log.error('Failed to get session key from provider');
                return;
            }

            const lockData = await this.getLockFileData();

            // Remove session registration only if it belongs to this instance
            if (lockData.sessions[sessionKey] === this.instanceId) {
                delete lockData.sessions[sessionKey];
            }
            
            // Update instance sessions
            if (lockData.instances[this.instanceId]) {
                lockData.instances[this.instanceId].sessions = lockData.instances[this.instanceId].sessions.filter(s => s !== sessionKey);
            }

            await this.updateLockFile(lockData);
            this.activeSessions.delete(sessionKey);
        } catch (error) {
            log.error('Error unregistering session:', error);
        }
    }

    async handleSecondInstance(argv) {
        try {
            // Parse arguments from second instance
            const providerCLI = require('../cli/provider-cli');
            providerCLI.args = argv.slice(1);
            
            const providers = providerCLI.parseProviderArgs();
            const forceNewInstance = providerCLI.shouldForceNewInstance();
            const useOneInstance = providerCLI.shouldUseOneInstance();

            if (forceNewInstance) {
                return false; // Allow new instance
            }

            // Check if any provider+profile combination exists in current instance
            const lockData = await this.getLockFileData();
            const sessionExists = providers.some(({ provider, profile }) => {
                if (!provider || typeof provider.getPartitionName !== 'function') {
                    return false;
                }

                const sessionKey = provider.getPartitionName(profile || 'default');
                return lockData.sessions[sessionKey] === this.instanceId;
            });

            return !sessionExists && !useOneInstance;
        } catch (error) {
            log.error('Error handling second instance:', error);
            return false;
        }
    }

    async cleanup() {
        if (!this.instanceId) {
            return;
        }

        try {
            const lockData = await this.getLockFileData();
            
            // Remove all sessions for this instance
            Object.entries(lockData.sessions).forEach(([sessionKey, instanceId]) => {
                if (instanceId === this.instanceId) {
                    delete lockData.sessions[sessionKey];
                }
            });

            // Remove instance data
            delete lockData.instances[this.instanceId];
            
            await this.updateLockFile(lockData);
        } catch (error) {
            log.error('Error during cleanup:', error);
        }
    }
}

module.exports = new InstanceManager();
