const { app } = require('electron');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { setTimeout } = require('timers/promises');

class InstanceManager {
    constructor() {
        const userData = app.getPath('userData');
        this.instanceLockFile = path.join(userData, 'instance.lock');
        this.pidFile = path.join(userData, 'pids.json');
        this.lockRetryCount = 3;
        this.lockRetryDelay = 100; // ms
        this.activeSessions = new Map();
        this.instanceId = null;
        this.isFirstInstance = false;
        this._writeLock = false;
    }

    async acquireWriteLock() {
        let attempts = 0;
        while (attempts < this.lockRetryCount) {
            if (!this._writeLock) {
                this._writeLock = true;
                return true;
            }
            await setTimeout(this.lockRetryDelay);
            attempts++;
        }
        return false;
    }

    releaseWriteLock() {
        this._writeLock = false;
    }

    async initialize() {
        try {
            this.instanceId = Date.now().toString();
            
            // Handle reset-lock command first, before any other initialization
            const providerCLI = require('../cli/provider-cli');
            if (providerCLI.shouldResetLock()) {
                await this.resetLock();
                // Exit after reset since this is a CLI command
                app.exit(0);
                return false;
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

            // Release any existing lock first
            this.releaseWriteLock();

            const data = await fs.promises.readFile(this.pidFile, 'utf8');
            const pids = JSON.parse(data);
            const currentPid = process.pid;

            // Kill all processes except current one
            const killPromises = pids.map(async (pid) => {
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
            });

            // Wait for all kill operations to complete
            await Promise.all(killPromises);

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

            // Release any existing lock first
            this.releaseWriteLock();

            // Kill all other instances using PIDs
            await this.killAllInstances();

            // Delete the lock file
            try {
                if (fs.existsSync(this.instanceLockFile)) {
                    log.info('Deleting lock file...');
                    await fs.promises.unlink(this.instanceLockFile);
                }
            } catch (error) {
                log.error('Error deleting lock file:', error);
            }

            // Release the single instance lock
            app.releaseSingleInstanceLock();

            // Wait a bit for the OS to clean up
            await setTimeout(1000);

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

            // Wait for any pending writes
            if (!await this.acquireWriteLock()) {
                log.warn('Could not acquire read lock, using default data');
                return { instances: {}, sessions: {} };
            }

            try {
                // Read the lock file
                const data = await fs.promises.readFile(this.instanceLockFile, 'utf8');
                
                try {
                    // Try to parse the JSON
                    return JSON.parse(data);
                } catch (parseError) {
                    log.error('Lock file contains invalid JSON, attempting recovery...');
                    
                    // Create backup of corrupted file
                    const backupPath = this.instanceLockFile + '.bak';
                    await fs.promises.writeFile(backupPath, data);
                    log.info(`Created backup of corrupted lock file: ${backupPath}`);
                    
                    // Reset to default state
                    const defaultData = { instances: {}, sessions: {} };
                    await this.updateLockFile(defaultData);
                    log.info('Reset lock file to default state');
                    
                    return defaultData;
                }
            } finally {
                this.releaseWriteLock();
            }
        } catch (error) {
            this.releaseWriteLock();
            log.error('Error reading lock file:', error);
            return { instances: {}, sessions: {} };
        }
    }

    async updateLockFile(data) {
        if (!await this.acquireWriteLock()) {
            throw new Error('Could not acquire write lock');
        }

        try {
            // Validate data structure before writing
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid data structure');
            }
            
            if (!data.instances || typeof data.instances !== 'object') {
                data.instances = {};
            }
            
            if (!data.sessions || typeof data.sessions !== 'object') {
                data.sessions = {};
            }

            // Write the file atomically by writing to temp file first
            const tempFile = this.instanceLockFile + '.tmp';
            await fs.promises.writeFile(tempFile, JSON.stringify(data, null, 2));
            await fs.promises.rename(tempFile, this.instanceLockFile);
        } catch (error) {
            log.error('Error updating lock file:', error);
            throw error;
        } finally {
            this.releaseWriteLock();
        }
    }

    async registerSession(provider, profile = 'default') {
        try {
            // Resolve provider if string is passed
            if (typeof provider === 'string') {
                const providerRegistry = require('../providers/provider.registry');
                // Convert provider name to proper --provider format
                const normalizedProvider = provider.startsWith('--') ? provider : `--${provider.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
                const resolvedProvider = providerRegistry.createProvider([normalizedProvider]);
                if (!resolvedProvider) {
                    log.error('Failed to resolve provider string:', provider);
                    return false;
                }
                provider = resolvedProvider;
            }

            if (!provider || typeof provider.getPartitionName !== 'function') {
                log.error('Invalid provider or provider.getPartitionName is not a function');
                console.trace();
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
            // Resolve provider if string is passed
            if (typeof provider === 'string') {
                const providerRegistry = require('../providers/provider.registry');
                // Convert provider name to proper --provider format
                const normalizedProvider = provider.startsWith('--') ? provider : `--${provider.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
                const resolvedProvider = providerRegistry.createProvider([normalizedProvider]);
                if (!resolvedProvider) {
                    log.error('Failed to resolve provider string:', provider);
                    return;
                }
                provider = resolvedProvider;
            }

            if (!provider || typeof provider.getPartitionName !== 'function') {
                log.error('Invalid provider or provider.getPartitionName is not a function');
                console.trace();
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

            if (useOneInstance) {
                return true; // Force single instance
            }

            // For each provider+profile combination, check if it exists
            for (const { provider: providerArg, profile } of providers) {
                const providerRegistry = require('../providers/provider.registry');
                const provider = providerRegistry.createProvider(['--' + providerArg]);
                
                if (!provider || typeof provider.getPartitionName !== 'function') {
                    continue;
                }

                const sessionKey = provider.getPartitionName(profile || 'default');
                const lockData = await this.getLockFileData();

                // If this exact session doesn't exist, allow new instance
                if (!lockData.sessions[sessionKey]) {
                    return false;
                }
            }

            // All sessions already exist, prevent new instance
            return true;
        } catch (error) {
            log.error('Error handling second instance:', error);
            return true; // Default to preventing new instance on error
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
