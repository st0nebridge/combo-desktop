const { app, ipcMain } = require('electron');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { setTimeout } = require('timers/promises');
const properLock = require('proper-lockfile');

class InstanceManager {
    constructor() {
        // Ensure app name is set before getting userData path
        if (!app.name) {
            const packageJson = require('../../package.json');
            app.name = packageJson.name;
        }

        const userData = app.getPath('userData');
        this.instanceLockFile = path.join(userData, 'instance.lock');
        this.pidFile = path.join(userData, 'pids.json');
        this.lockRetryCount = 5;
        this.lockRetryDelay = 200; // ms
        this.activeSessions = new Map();
        this.instanceId = null;
        this.isFirstInstance = false;
        this.currentProfile = null;

        // Ensure directories exist
        this.ensureDirectories();
        
        // Set up IPC handlers for instance communication
        if (ipcMain) {
            ipcMain.handle('add-provider', async (event, { provider, profile }) => {
                return await this.addProviderToInstance(provider, profile);
            });
        }

        // Register cleanup handlers
        this.registerCleanupHandlers();
    }

    async ensureDirectories() {
        try {
            // Ensure parent directories exist
            const userDataDir = path.dirname(this.instanceLockFile);
            await fs.promises.mkdir(userDataDir, { recursive: true });

            // Create PID file if it doesn't exist
            if (!fs.existsSync(this.pidFile)) {
                await fs.promises.writeFile(this.pidFile, '[]', 'utf8');
            }
        } catch (error) {
            log.error('Error creating directories:', error);
            throw error;
        }
    }

    registerCleanupHandlers() {
        const cleanup = async () => {
            await this.cleanup();
        };

        process.on('exit', cleanup);
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('uncaughtException', (error) => {
            log.error('Uncaught exception:', error);
            cleanup().then(() => process.exit(1));
        });
    }

    async acquireWriteLock(file, options = {}) {
        try {
            return await properLock.lock(file, {
                retries: this.lockRetryCount,
                retryWait: this.lockRetryDelay,
                stale: 10000, // Consider lock stale after 10s
                ...options
            });
        } catch (error) {
            if (error.code === 'ELOCKED') {
                throw new Error(`Could not acquire write lock for ${file}`);
            }
            throw error;
        }
    }

    async initialize() {
        try {
            this.instanceId = Date.now().toString();
            
            // Handle reset-lock command first, before any other initialization
            const providerCLI = require('../cli/provider-cli');
            if (providerCLI.shouldResetLock()) {
                await this.resetLock();
                log.info('Reset lock command executed successfully');
                return true; // Return true to allow proper exit
            }

            // Get the target profile from CLI args, default to 'default' if not specified
            const profile = providerCLI.getProfile() ?? 'default';
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
            
            // --new-instance always creates new instance (highest priority)
            if (providerCLI.shouldForceNewInstance()) {
                return true;
            }

            // --one-instance never creates new instance (lowest priority)
            if (providerCLI.shouldUseOneInstance()) {
                return false;
            }

            const lockData = await this.getLockFileData();
            
            // If this is the first instance and has no providers, use current process
            if (Object.keys(lockData.instances).length === 0) {
                return false;
            }

            // Check if any instance is running the target profile
            for (const [instanceId, instance] of Object.entries(lockData.instances)) {
                if (instance.profile === profile) {
                    // Found an instance with the same profile, don't create new instance
                    return false;
                }
            }

            // Create new instance if no instance with this profile exists
            return true;
        } catch (error) {
            log.error('Error checking if should create new instance:', error);
            return false;
        }
    }

    async registerPid() {
        let release;
        try {
            const pid = process.pid;
            let pids = [];

            // Ensure directory exists
            await this.ensureDirectories();

            // Acquire lock for PID file operations
            release = await this.acquireWriteLock(this.pidFile);

            // Read existing PIDs or create empty file
            if (fs.existsSync(this.pidFile)) {
                try {
                    const data = await fs.promises.readFile(this.pidFile, 'utf8');
                    pids = JSON.parse(data);
                } catch (error) {
                    log.error('Error parsing PID file, creating new one:', error);
                }
            } else {
                // Create empty PID file
                await fs.promises.writeFile(this.pidFile, '[]');
            }

            // Clean up stale PIDs
            pids = await this.cleanupStalePids(pids);

            // Add current PID if not already present
            if (!pids.includes(pid)) {
                pids.push(pid);
            }

            // Write updated PIDs
            await fs.promises.writeFile(this.pidFile, JSON.stringify(pids, null, 2));
            log.info(`Registered PID: ${pid}`);
        } catch (error) {
            log.error('Error registering PID:', error);
            throw error;
        } finally {
            if (release) {
                await release();
            }
        }
    }

    async cleanupStalePids(pids) {
        const validPids = [];
        for (const pid of pids) {
            try {
                if (process.platform === 'win32') {
                    // Check if process exists AND is an electron process from our app
                    const output = execSync(`wmic process where "processid='${pid}'" get commandline /format:value`, { stdio: 'pipe' }).toString();
                    if (output.includes('desk-tray') || output.includes('combo-desktop')) {
                        validPids.push(pid);
                    }
                } else {
                    // On Unix, check process exists and verify it's our app
                    process.kill(pid, 0);
                    const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
                    if (cmdline.includes('desk-tray') || cmdline.includes('combo-desktop')) {
                        validPids.push(pid);
                    }
                }
            } catch (error) {
                // Process doesn't exist or we can't access it
                log.info(`Removing stale PID: ${pid}`);
            }
        }
        return validPids;
    }

    async unregisterPid() {
        let release;
        try {
            if (!fs.existsSync(this.pidFile)) {
                return;
            }

            // Acquire lock for PID file operations
            release = await this.acquireWriteLock(this.pidFile);

            const pid = process.pid;
            let pids = [];

            try {
                const data = await fs.promises.readFile(this.pidFile, 'utf8');
                pids = JSON.parse(data);
            } catch (error) {
                log.error('Error reading PID file:', error);
                return;
            }

            // Remove current PID
            pids = pids.filter(p => p !== pid);

            // Write updated PIDs or delete file if empty
            if (pids.length > 0) {
                await fs.promises.writeFile(this.pidFile, JSON.stringify(pids, null, 2));
            } else {
                await fs.promises.unlink(this.pidFile);
            }
        } catch (error) {
            log.error('Error unregistering PID:', error);
        } finally {
            if (release) {
                await release();
            }
        }
    }

    async killAllInstances() {
        let release;
        try {
            const currentPid = process.pid;
            log.info('Killing registered instances...');

            // Only kill processes listed in PID file
            if (fs.existsSync(this.pidFile)) {
                try {
                    // Acquire lock for PID file operations
                    release = await this.acquireWriteLock(this.pidFile);

                    const data = await fs.promises.readFile(this.pidFile, 'utf8');
                    let pids = JSON.parse(data);

                    // Clean up stale PIDs first
                    pids = await this.cleanupStalePids(pids);

                    // Kill each registered process
                    for (const pid of pids) {
                        if (pid !== currentPid) {
                            try {
                                if (process.platform === 'win32') {
                                    log.info(`Killing process by PID: ${pid}`);
                                    execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
                                } else {
                                    process.kill(pid, 'SIGTERM');
                                }
                                log.info(`Killed process: ${pid}`);
                            } catch (error) {
                                log.info(`Process ${pid} not found or already terminated`);
                            }
                        }
                    }

                    // Wait for processes to terminate
                    await setTimeout(2000);

                    // Verify PIDs are gone
                    const remainingPids = await this.cleanupStalePids(pids);
                    if (remainingPids.length > 1) {
                        log.warn('Some registered processes could not be terminated');
                        // Try one more time with force
                        for (const pid of remainingPids) {
                            if (pid !== currentPid) {
                                try {
                                    if (process.platform === 'win32') {
                                        execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
                                    } else {
                                        process.kill(pid, 'SIGKILL');
                                    }
                                } catch (error) {
                                    // Process might be gone now
                                }
                            }
                        }
                    }

                    // Reset PID file to only include current process if it exists
                    const finalPids = await this.cleanupStalePids([currentPid]);
                    await fs.promises.writeFile(this.pidFile, JSON.stringify(finalPids, null, 2), 'utf8');
                } catch (error) {
                    log.error('Error killing processes:', error);
                    throw error;
                }
            }
        } catch (error) {
            log.error('Error in killAllInstances:', error);
        } finally {
            if (release) {
                await release();
            }
        }
    }

    async resetLock() {
        try {
            log.info('Resetting instance lock file...');

            // Kill all other instances first
            await this.killAllInstances();

            // Delete the PID file
            try {
                if (fs.existsSync(this.pidFile)) {
                    await fs.promises.unlink(this.pidFile);
                }
            } catch (error) {
                log.error('Error deleting PID file:', error);
            }

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

            // Initialize a fresh lock file
            await this.initializeLockFile();

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
            const release = await this.acquireWriteLock(this.instanceLockFile, { read: true });

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
            const release = await this.acquireWriteLock(this.instanceLockFile);

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
            const profile = providerCLI.getProfile() ?? 'default';

            // --new-instance always creates new instance
            if (forceNewInstance) {
                return false;
            }

            // --one-instance forces all providers to current instance
            if (useOneInstance) {
                return true;
            }

            const lockData = await this.getLockFileData();

            // Find instance running the target profile
            let targetInstanceId = null;
            for (const [instanceId, instance] of Object.entries(lockData.instances)) {
                if (instance.profile === profile) {
                    targetInstanceId = instanceId;
                    break;
                }
            }

            // If no instance exists for this profile, allow new instance
            if (!targetInstanceId) {
                return false;
            }

            // Check if any requested sessions already exist
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

            // Delegate providers to existing instance
            for (const { provider: providerArg } of providers) {
                const providerRegistry = require('../providers/provider.registry');
                const provider = providerRegistry.createProvider(['--' + providerArg]);
                
                if (!provider) {
                    continue;
                }

                await this.delegateProviderToInstance(provider, profile, targetInstanceId);
            }

            // Exit this instance since we've delegated to existing one
            log.info('Providers delegated to existing instance, exiting...');
            app.exit(0);
            return true;
        } catch (error) {
            log.error('Error handling second instance:', error);
            return true; // Default to preventing new instance on error
        }
    }

    async delegateProviderToInstance(provider, profile, targetInstanceId) {
        try {
            const sessionKey = provider.getPartitionName(profile);
            const lockData = await this.getLockFileData();

            // Update lock file to register session with target instance
            if (!lockData.instances[targetInstanceId]) {
                log.error('Target instance no longer exists');
                return false;
            }

            // Register session with target instance
            lockData.sessions[sessionKey] = targetInstanceId;
            if (!lockData.instances[targetInstanceId].sessions.includes(sessionKey)) {
                lockData.instances[targetInstanceId].sessions.push(sessionKey);
            }

            await this.updateLockFile(lockData);
            log.info(`Delegated provider ${provider.getName()} to instance ${targetInstanceId}`);
            return true;
        } catch (error) {
            log.error('Error delegating provider:', error);
            return false;
        }
    }

    async addProviderToInstance(provider, profile = 'default') {
        try {
            // Register the session for this instance
            const success = await this.registerSession(provider, profile);
            if (!success) {
                return false;
            }

            // Create window for the provider
            await provider.spawnWindow(profile);
            return true;
        } catch (error) {
            log.error('Error adding provider to instance:', error);
            return false;
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
