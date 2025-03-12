const { app } = require('electron');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { setTimeout } = require('timers/promises');
const properLock = require('proper-lockfile');

class InstanceManager {
    constructor() {
        const userData = app.getPath('userData');
        this.instanceLockFile = path.join(userData, 'instance.lock');
        this.pidFile = path.join(userData, 'pids.json');
        this.lockRetryCount = 5;
        this.lockRetryDelay = 200; // ms
        this.activeSessions = new Map();
        this.instanceId = null;
        this.isFirstInstance = false;
        this.currentProfile = null;
    }

    async acquireWriteLock() {
        // Clear any existing lock timeout
        if (this._lockTimeout) {
            clearTimeout(this._lockTimeout);
            this._lockTimeout = null;
        }

        let attempts = 0;
        while (attempts < this.lockRetryCount) {
            if (!this._writeLock) {
                this._writeLock = true;
                // Auto-release lock after 5 seconds to prevent deadlocks
                this._lockTimeout = setTimeout(() => {
                    this.releaseWriteLock();
                }, 5000);
                return true;
            }
            await setTimeout(this.lockRetryDelay);
            attempts++;
        }
        return false;
    }

    releaseWriteLock() {
        if (this._lockTimeout) {
            clearTimeout(this._lockTimeout);
            this._lockTimeout = null;
        }
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

            // Get the target profile from CLI args
            const profile = providerCLI.getProfile() || 'default';
            this.currentProfile = profile;

            // Check if we should create a new instance based on process isolation rules
            const shouldCreateNewInstance = await this.shouldCreateNewInstance(profile);
            
            // Request single instance lock only if we're not forcing a new instance
            if (!shouldCreateNewInstance) {
                this.isFirstInstance = app.requestSingleInstanceLock();
                if (!this.isFirstInstance) {
                    return false;
                }
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

    async shouldCreateNewInstance(profile) {
        try {
            const providerCLI = require('../cli/provider-cli');
            
            // --new-instance always creates new instance
            if (providerCLI.shouldForceNewInstance()) {
                return true;
            }

            // --one-instance never creates new instance
            if (providerCLI.shouldUseOneInstance()) {
                return false;
            }

            const lockData = await this.getLockFileData();
            
            // If this is the first instance and has no providers, use current process
            if (Object.keys(lockData.instances).length === 0) {
                return false;
            }

            // Check if any instance is running the target profile
            let profileExists = false;
            for (const instance of Object.values(lockData.instances)) {
                for (const sessionKey of instance.sessions) {
                    if (sessionKey.includes(`:${profile}`)) {
                        profileExists = true;
                        break;
                    }
                }
            }

            // Create new instance if profile doesn't exist
            return profileExists;
        } catch (error) {
            log.error('Error checking if should create new instance:', error);
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

            // Try to acquire a lock for reading
            const release = await properLock.lock(this.instanceLockFile, {
                retries: this.lockRetryCount,
                retryWait: this.lockRetryDelay,
                stale: 10000 // Consider lock stale after 10s
            });

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
                await release();
            }
        } catch (error) {
            if (error.code === 'ELOCKED') {
                log.warn('Could not acquire read lock, using default data');
                return { instances: {}, sessions: {} };
            }
            log.error('Error reading lock file:', error);
            return { instances: {}, sessions: {} };
        }
    }

    async updateLockFile(data) {
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

            // Acquire an exclusive lock for writing
            const release = await properLock.lock(this.instanceLockFile, {
                retries: this.lockRetryCount,
                retryWait: this.lockRetryDelay,
                stale: 10000 // Consider lock stale after 10s
            });

            try {
                // Write the file atomically by writing to temp file first
                const tempFile = this.instanceLockFile + '.tmp';
                await fs.promises.writeFile(tempFile, JSON.stringify(data, null, 2));
                await fs.promises.rename(tempFile, this.instanceLockFile);
            } finally {
                await release();
            }
        } catch (error) {
            if (error.code === 'ELOCKED') {
                throw new Error('Could not acquire write lock');
            }
            log.error('Error updating lock file:', error);
            throw error;
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

            // Check if session exists in any instance
            if (lockData.sessions[sessionKey]) {
                log.error(`Session ${sessionKey} already exists in another instance`);
                return false;
            }

            // Check if instance exists in lock file
            if (!lockData.instances[this.instanceId]) {
                lockData.instances[this.instanceId] = {
                    startTime: Date.now(),
                    profile: this.currentProfile,
                    sessions: []
                };
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
            const profile = providerCLI.getProfile() || 'default';

            // --new-instance always creates new instance
            if (forceNewInstance) {
                return false;
            }

            // --one-instance forces all providers to current instance
            if (useOneInstance) {
                return true;
            }

            const lockData = await this.getLockFileData();

            // Check if any requested session already exists
            for (const { provider: providerArg } of providers) {
                const providerRegistry = require('../providers/provider.registry');
                const provider = providerRegistry.createProvider(['--' + providerArg]);
                
                if (!provider || typeof provider.getPartitionName !== 'function') {
                    continue;
                }

                const sessionKey = provider.getPartitionName(profile);
                
                // If session exists, reject new instance
                if (lockData.sessions[sessionKey]) {
                    log.warn(`Session ${sessionKey} already exists, rejecting new instance`);
                    return true;
                }
            }

            // Find instance running the target profile
            let profileInstanceId = null;
            for (const [instanceId, instance] of Object.entries(lockData.instances)) {
                if (instance.profile === profile) {
                    profileInstanceId = instanceId;
                    break;
                }
            }

            // If profile exists, use that instance
            if (profileInstanceId) {
                return true;
            }

            // Allow new instance for new profile
            return false;
        } catch (error) {
            log.error('Error handling second instance:', error);
            return true; // Default to preventing new instance on error
        }
    }

    async cleanup() {
        try {
            // Get current data
            const lockData = await this.getLockFileData();

            // Remove this instance's data
            if (lockData.instances[this.instanceId]) {
                delete lockData.instances[this.instanceId];
            }

            // Remove any sessions owned by this instance
            for (const [sessionKey, instanceId] of Object.entries(lockData.sessions)) {
                if (instanceId === this.instanceId) {
                    delete lockData.sessions[sessionKey];
                }
            }

            // Try to update lock file, but don't throw if we can't
            try {
                await this.updateLockFile(lockData);
            } catch (error) {
                log.warn('Could not update lock file during cleanup:', error);
            }

            // Clear active sessions
            this.activeSessions.clear();
        } catch (error) {
            log.error('Error during instance cleanup:', error);
        }
    }
}

module.exports = new InstanceManager();
