/**
 * @file Instance management service that handles application instance lifecycle,
 * locking, and PID tracking to ensure proper multi-instance behavior.
 */

const { app, ipcMain } = require('electron');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const properLock = require('proper-lockfile');

/**
 * Service for managing application instances.
 * Handles instance lifecycle, locking, and process management:
 * - Instance creation and cleanup
 * - File locking and PID tracking
 * - Profile-based instance management
 * - IPC communication for instances
 * @class InstanceManager
 */
class InstanceManager {
    /**
     * Creates a new InstanceManager instance
     * @constructor
     */
    constructor() {
        // Ensure app name is set before getting userData path
        if (!app.name) {
            const packageJson = require('../../package.json');
            app.name = packageJson.name;
        }

        /** @property {string} instanceLockFile - Path to instance lock file */
        this.instanceLockFile = path.join(app.getPath('userData'), 'instance.lock');
        
        /** @property {string} pidFile - Path to PID tracking file */
        this.pidFile = path.join(app.getPath('userData'), 'pids.json');
        
        /** @property {number} lockRetryCount - Number of times to retry acquiring lock */
        this.lockRetryCount = 5;
        
        /** @property {number} lockRetryDelay - Delay in ms between lock retries */
        this.lockRetryDelay = 200;
        
        /** @property {Map<string, Object>} activeSessions - Map of active provider sessions */
        this.activeSessions = new Map();
        
        /** @property {string|null} instanceId - Unique ID for this instance */
        this.instanceId = null;
        
        /** @property {boolean} isFirstInstance - Whether this is the first instance */
        this.isFirstInstance = false;
        
        /** @property {string|null} currentProfile - Current active profile */
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

    /**
     * Ensure required directories exist for instance management
     * @method ensureDirectories
     * @throws {Error} If directory creation fails
     */
    async ensureDirectories() {
        try {
            // Get user data directory
            const userDataDir = app.getPath('userData');

            // Create user data directory if it doesn't exist
            await fs.promises.mkdir(userDataDir, { recursive: true });

            // Create instance lock file if it doesn't exist
            if (!fs.existsSync(this.instanceLockFile)) {
                await fs.promises.writeFile(this.instanceLockFile, JSON.stringify({ instances: {} }, null, 2));
            }

            // Create PID file if it doesn't exist
            if (!fs.existsSync(this.pidFile)) {
                await fs.promises.writeFile(this.pidFile, JSON.stringify([], null, 2));
            }

            log.info('Instance management directories initialized');
        } catch (error) {
            log.error('Error creating directories:', error);
            throw error;
        }
    }

    /**
     * Register cleanup handlers for process exit
     * @method registerCleanupHandlers
     */
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

    /**
     * Acquire a write lock on a file
     * @method acquireWriteLock
     * @param {string} file - File to lock
     * @param {Object} [options={}] - Lock options
     * @returns {Promise<Function>} Release function
     * @throws {Error} If lock cannot be acquired
     */
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

    /**
     * Register this instance's PID in the PID file
     * @method registerPid
     * @throws {Error} If PID registration fails
     */
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
            }

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

    /**
     * Handle instance registration based on CLI arguments
     * @method handleInstanceRegistration
     * @param {Object} args - Parsed CLI arguments
     * @returns {Promise<boolean>} True if registration successful
     * @throws {Error} If registration fails
     */
    async handleInstanceRegistration(args) {
        try {
            if (!args) {
                log.info('No CLI arguments to process');
                return true;
            }

            // Ensure directories exist first
            await this.ensureDirectories();

            // Handle reset-lock command first
            if (args.resetLock) {
                await this.resetLock();
                log.info('Reset lock command executed successfully');
                return true;
            }

            // Get profile from args
            const profile = args.profile ?? 'default';
            this.currentProfile = profile;

            // Check if we should create a new instance
            const shouldCreateNew = await this.shouldCreateNewInstance(args);
            if (!shouldCreateNew) {
                log.info('Another instance is already running with this profile');
                return false;
            }

            // Initialize lock file
            await this.initializeLockFile();

            // Register this instance's PID if not a CLI command
            if (!args.cliCommand) {
                await this.registerPid();
            }

            this.isFirstInstance = true;
            log.info(`Instance ${this.instanceId} initialized successfully`);
            return true;
        } catch (error) {
            log.error('Failed to handle instance registration:', error);
            throw error; // Re-throw to allow proper error handling
        }
    }

    /**
     * Check if we should create a new instance
     * @method shouldCreateNewInstance
     * @param {Object} args - CLI arguments
     * @returns {Promise<boolean>} True if we should create a new instance
     * @throws {Error} If check fails
     */
    async shouldCreateNewInstance(args) {
        try {
            // Always create new instance if forced
            if (args.newInstance) {
                log.info('Forcing new instance creation');
                return true;
            }

            // Check if lock file exists
            if (!fs.existsSync(this.instanceLockFile)) {
                log.info('No lock file found, creating new instance');
                return true;
            }

            // Try to read lock file
            let lockData;
            try {
                const data = await fs.promises.readFile(this.instanceLockFile, 'utf8');
                lockData = JSON.parse(data);
            } catch (error) {
                log.warn('Error reading lock file, creating new instance:', error);
                return true;
            }

            // Check if lock file is valid
            if (!lockData || !lockData.instances || typeof lockData.instances !== 'object') {
                log.warn('Invalid lock file format, creating new instance');
                return true;
            }

            // Check if any instance is running with the same profile
            const profile = args.profile ?? 'default';
            for (const instance of Object.values(lockData.instances)) {
                if (instance.profile === profile && this.isProcessRunning(instance.pid)) {
                    if (args.oneInstance) {
                        log.info(`Found running instance with profile ${profile}, enforcing single instance`);
                        return false;
                    }
                }
            }

            return true;
        } catch (error) {
            log.error('Error checking instance creation:', error);
            return true;
        }
    }

    /**
     * Initialize the instance lock file
     * @method initializeLockFile
     * @throws {Error} If lock file initialization fails
     */
    async initializeLockFile() {
        let release;
        try {
            // Acquire lock for file operations
            release = await this.acquireWriteLock(this.instanceLockFile);

            // Read existing lock data or create new
            let lockData = { instances: {} };
            if (fs.existsSync(this.instanceLockFile)) {
                try {
                    const data = await fs.promises.readFile(this.instanceLockFile, 'utf8');
                    lockData = JSON.parse(data);
                } catch (error) {
                    log.warn('Error reading lock file, creating new one:', error);
                }
            }

            // Add this instance
            this.instanceId = Date.now().toString();
            lockData.instances[this.instanceId] = {
                pid: process.pid,
                profile: this.currentProfile,
                providers: []
            };

            // Write updated lock data
            await fs.promises.writeFile(this.instanceLockFile, JSON.stringify(lockData, null, 2));
            log.info(`Initialized lock file for instance ${this.instanceId}`);
        } catch (error) {
            log.error('Error initializing lock file:', error);
            throw error;
        } finally {
            if (release) {
                await release();
            }
        }
    }

    /**
     * Reset the instance lock file and terminate all running instances
     * @method resetLock
     * @throws {Error} If lock reset fails
     * @returns {Promise<void>} Resolves when lock is reset and instances are terminated
     */
    async resetLock() {
        let release;
        try {
            // Try to acquire lock to ensure we have exclusive access
            try {
                release = await this.acquireWriteLock(this.pidFile);
            } catch (lockError) {
                log.warn('Could not acquire lock, proceeding with force reset:', lockError.message);
            }

            // Read and handle PIDs
            let pids = [];
            if (fs.existsSync(this.pidFile)) {
                try {
                    const data = await fs.promises.readFile(this.pidFile, 'utf8');
                    pids = JSON.parse(data);
                    log.debug('Found PIDs:', pids);
                } catch (readError) {
                    log.warn('Error reading PIDs file:', readError.message);
                }
            }

            // Terminate running processes
            let terminatedCount = 0;
            for (const pid of pids) {
                if (this.isProcessRunning(pid)) {
                    try {
                        process.kill(pid);
                        terminatedCount++;
                        log.info(`Terminated process ${pid}`);
                    } catch (killError) {
                        log.warn(`Failed to terminate process ${pid}:`, killError.message);
                    }
                } else {
                    log.debug(`Process ${pid} is not running`);
                }
            }

            // Remove lock and PID files
            const filesToRemove = [this.instanceLockFile, this.pidFile];
            for (const file of filesToRemove) {
                if (fs.existsSync(file)) {
                    try {
                        await fs.promises.unlink(file);
                        log.info(`Removed file: ${file}`);
                    } catch (unlinkError) {
                        log.error(`Failed to remove ${file}:`, unlinkError.message);
                        throw unlinkError;
                    }
                }
            }

            if (terminatedCount > 0) {
                console.log(`\nTerminated ${terminatedCount} running instance${terminatedCount !== 1 ? 's' : ''}.`);
            } else {
                console.log('\nNo running instances found.');
            }
            console.log('Instance lock reset successfully.\n');

        } catch (error) {
            log.error('Error resetting instance lock:', error);
            throw error;
        } finally {
            if (release) {
                try {
                    await release();
                } catch (releaseError) {
                    log.warn('Error releasing lock:', releaseError.message);
                }
            }
        }
    }

    /**
     * Add a provider to this instance
     * @method addProviderToInstance
     * @param {string} provider - Provider command argument
     * @param {string} profile - Profile name
     * @returns {Promise<boolean>} True if provider added successfully
     * @throws {Error} If provider addition fails
     */
    async addProviderToInstance(provider, profile) {
        let release;
        try {
            if (!this.instanceId) {
                throw new Error('Instance not initialized');
            }

            // Acquire lock for file operations
            release = await this.acquireWriteLock(this.instanceLockFile);

            // Read lock data
            const data = await fs.promises.readFile(this.instanceLockFile, 'utf8');
            const lockData = JSON.parse(data);

            // Add provider to instance
            if (!lockData.instances[this.instanceId].providers) {
                lockData.instances[this.instanceId].providers = [];
            }
            lockData.instances[this.instanceId].providers.push({ provider, profile });

            // Write updated lock data
            await fs.promises.writeFile(this.instanceLockFile, JSON.stringify(lockData, null, 2));
            log.info(`Added provider ${provider} to instance ${this.instanceId}`);
            return true;
        } catch (error) {
            log.error('Error adding provider to instance:', error);
            return false;
        } finally {
            if (release) {
                await release();
            }
        }
    }

    /**
     * Check if a process is running
     * @method isProcessRunning
     * @param {number} pid - Process ID to check
     * @returns {boolean} True if process is running
     */
    isProcessRunning(pid) {
        try {
            if (process.platform === 'win32') {
                const output = execSync(`tasklist /FI "PID eq ${pid}" /NH`, { stdio: 'pipe' }).toString();
                return output.includes(pid.toString());
            } else {
                process.kill(pid, 0);
                return true;
            }
        } catch (error) {
            return false;
        }
    }

    /**
     * Register a provider session with this instance
     * @method registerSession
     * @param {BaseProvider} provider - Provider instance
     * @param {string} profile - Profile name
     * @returns {Promise<boolean>} True if registration successful
     * @throws {Error} If registration fails
     */
    async registerSession(provider, profile) {
        if (!provider || !profile) {
            log.error('Invalid provider or profile for session registration');
            throw new Error('Invalid provider or profile');
        }

        let release;
        try {
            // Acquire lock for file operations
            release = await this.acquireWriteLock(this.instanceLockFile);

            // Read current lock data
            let lockData;
            try {
                const data = await fs.promises.readFile(this.instanceLockFile, 'utf8');
                lockData = JSON.parse(data);
            } catch (error) {
                log.error('Error reading lock file:', error);
                throw error;
            }

            // Ensure instance exists in lock file
            if (!lockData.instances[this.instanceId]) {
                log.error('Instance not found in lock file');
                throw new Error('Instance not found');
            }

            // Add provider to instance's providers list if not already present
            const providerData = {
                name: provider.getName(),
                profile,
                timestamp: Date.now()
            };

            const instance = lockData.instances[this.instanceId];
            const existingProvider = instance.providers.find(p => 
                p.name === providerData.name && p.profile === providerData.profile
            );

            if (!existingProvider) {
                instance.providers.push(providerData);
                log.info(`Added provider ${provider.getName()} with profile ${profile} to instance ${this.instanceId}`);
            } else {
                log.info(`Provider ${provider.getName()} with profile ${profile} already registered`);
            }

            // Write updated lock data
            await fs.promises.writeFile(this.instanceLockFile, JSON.stringify(lockData, null, 2));

            // Store session in memory
            const sessionKey = `${provider.getName()}:${profile}`;
            this.activeSessions.set(sessionKey, {
                provider,
                profile,
                timestamp: Date.now()
            });

            return true;
        } catch (error) {
            log.error('Failed to register provider session:', error);
            throw error;
        } finally {
            if (release) {
                await release();
            }
        }
    }

    /**
     * Clean up instance resources
     * @method cleanup
     * @throws {Error} If cleanup fails
     */
    async cleanup() {
        let release;
        try {
            if (!this.instanceId) {
                return;
            }

            // Acquire lock for file operations
            release = await this.acquireWriteLock(this.instanceLockFile);

            // Read lock data
            if (fs.existsSync(this.instanceLockFile)) {
                const data = await fs.promises.readFile(this.instanceLockFile, 'utf8');
                const lockData = JSON.parse(data);

                // Remove this instance
                if (lockData.instances && lockData.instances[this.instanceId]) {
                    delete lockData.instances[this.instanceId];
                }

                // Write updated lock data or remove file if no instances
                if (Object.keys(lockData.instances).length > 0) {
                    await fs.promises.writeFile(this.instanceLockFile, JSON.stringify(lockData, null, 2));
                } else {
                    await fs.promises.unlink(this.instanceLockFile);
                }
            }

            log.info(`Cleaned up instance ${this.instanceId}`);
        } catch (error) {
            log.error('Error during cleanup:', error);
        } finally {
            if (release) {
                await release();
            }
        }
    }
}

// Export a singleton instance
module.exports = new InstanceManager();
