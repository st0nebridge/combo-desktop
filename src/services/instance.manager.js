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
        
        /** @property {Map<string, Object>} providerSessions - Map of provider sessions */
        this.providerSessions = new Map();
        
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
                return await this.registerSession(provider, profile);
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
     * Register a provider session
     * @method registerSession
     * @param {BaseProvider} provider - Provider instance
     * @param {string} profile - Profile name
     * @returns {Promise<void>}
     * @throws {Error} If no active instance or session registration fails
     */
    async registerSession(provider, profile) {
        if (!this.instanceId) {
            throw new Error('No active instance');
        }

        const providerName = provider.getName();
        const sessionKey = `${providerName}:${profile}`;

        // Check if session already exists
        if (this.providerSessions.has(sessionKey)) {
            log.warn(`Session already exists for ${sessionKey}`);
            return;
        }

        try {
            // Add to memory
            this.providerSessions.set(sessionKey, {
                provider: providerName,
                profile,
                timestamp: Date.now()
            });

            // Update lock file
            await this.updateLockFile();

            log.info(`Added provider ${providerName} with profile ${profile} to instance ${this.instanceId}`);
        } catch (error) {
            log.error(`Error registering session for ${sessionKey}:`, error);
            throw error;
        }
    }

    /**
     * Unregister a provider session
     * @method unregisterSession
     * @param {BaseProvider} provider - Provider instance
     * @param {string} profile - Profile name
     * @returns {Promise<void>}
     * @throws {Error} If no active instance or session unregistration fails
     */
    async unregisterSession(provider, profile) {
        if (!this.instanceId) {
            throw new Error('No active instance');
        }

        const providerName = provider.getName();
        const sessionKey = `${providerName}:${profile}`;

        try {
            // Remove from memory
            if (this.providerSessions.has(sessionKey)) {
                this.providerSessions.delete(sessionKey);
                log.info(`Removed session ${sessionKey} from instance ${this.instanceId}`);
            }

            // Update lock file
            await this.updateLockFile();
        } catch (error) {
            log.error(`Error unregistering session for ${sessionKey}:`, error);
            throw error;
        }
    }

    /**
     * Update the instance lock file
     * @method updateLockFile
     * @throws {Error} If lock file update fails
     */
    async updateLockFile() {
        let release;
        try {
            // Acquire lock for file operations
            release = await this.acquireWriteLock(this.instanceLockFile);

            // Read existing lock data
            const data = await fs.promises.readFile(this.instanceLockFile, 'utf8');
            const lockData = JSON.parse(data);

            // Update this instance's providers
            if (!lockData.instances[this.instanceId]) {
                throw new Error('Instance not found in lock file');
            }

            // Convert provider sessions to array format
            const providers = Array.from(this.providerSessions.values());
            lockData.instances[this.instanceId].providers = providers;

            // Write updated lock data
            await fs.promises.writeFile(this.instanceLockFile, JSON.stringify(lockData, null, 2));
            log.info(`Updated lock file for instance ${this.instanceId}`);
        } catch (error) {
            log.error('Error updating lock file:', error);
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
     * @param {Array<string>} args - CLI arguments
     * @returns {Promise<boolean>} Whether registration was successful
     */
    async handleInstanceRegistration(args) {
        try {
            // Check if we should create a new instance
            const shouldCreateNew = await this.shouldCreateNewInstance(args);
            if (!shouldCreateNew) {
                // Pass args to existing instance and exit
                await this.notifyExistingInstance(args);
                return false;
            }

            // Initialize instance lock file
            const instanceId = Date.now();
            await this.initializeLockFile(instanceId);

            // Register PID
            await this.registerPid(instanceId);
            log.info(`Instance ${instanceId} initialized successfully`);

            // Store instance ID
            this.instanceId = instanceId;

            return true;
        } catch (error) {
            log.error('Error handling instance registration:', error);
            return false;
        }
    }

    /**
     * Check if we should create a new instance
     * @method shouldCreateNewInstance
     * @param {Array<string>} args - CLI arguments
     * @returns {Promise<boolean>} Whether to create new instance
     */
    async shouldCreateNewInstance(args) {
        try {
            // Get existing instances
            const instances = await this.getRunningInstances();
            if (instances.length === 0) {
                return true;
            }

            // Check if any instance has this provider active
            for (const arg of args) {
                if (!arg.startsWith('--')) continue;
                const provider = arg.substring(2);
                
                for (const instance of instances) {
                    const sessions = await this.getInstanceSessions(instance);
                    for (const session of sessions) {
                        if (session.provider === provider) {
                            log.info(`Provider ${provider} already active in instance ${instance}`);
                            return false;
                        }
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
     * @param {string} instanceId - Unique ID for this instance
     * @throws {Error} If lock file initialization fails
     */
    async initializeLockFile(instanceId) {
        let release;
        try {
            // Acquire lock for file operations
            release = await this.acquireWriteLock(this.instanceLockFile);

            // Default lock data structure
            let lockData = {
                instances: {}
            };

            try {
                // Try to read existing lock data
                const data = await fs.promises.readFile(this.instanceLockFile, 'utf8');
                if (data && data.trim()) {
                    lockData = JSON.parse(data);
                    
                    // Ensure the structure is valid
                    if (!lockData.instances) {
                        lockData.instances = {};
                    }
                }
            } catch (readError) {
                // If file doesn't exist or is corrupted, use default structure
                log.warn(`Lock file could not be read, creating new one: ${readError.message}`);
            }

            // Add new instance
            lockData.instances[instanceId] = {
                pid: process.pid,
                timestamp: Date.now(),
                providers: []
            };

            // Write updated lock data
            await fs.promises.writeFile(this.instanceLockFile, JSON.stringify(lockData, null, 2));
            log.info(`Lock file initialized for instance ${instanceId}`);
        } catch (error) {
            log.error('Error initializing lock file:', error);
            throw error;
        } finally {
            if (release) {
                release();
            }
        }
    }

    /**
     * Register this instance's PID in the PID file
     * @method registerPid
     * @throws {Error} If PID registration fails
     */
    async registerPid(instanceId) {
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
                release();
            }
        }
    }

    /**
     * Notify an existing instance
     * @method notifyExistingInstance
     * @param {Array<string>} args - CLI arguments
     * @throws {Error} If notification fails
     */
    async notifyExistingInstance(args) {
        try {
            // Get existing instances
            const instances = await this.getRunningInstances();
            if (instances.length === 0) {
                throw new Error('No running instances found');
            }

            // Send notification to first instance
            const instance = instances[0];
            // TODO: Implement IPC notification
            log.info(`Notifying instance ${instance} with args: ${args.join(' ')}`);
        } catch (error) {
            log.error('Error notifying existing instance:', error);
            throw error;
        }
    }

    /**
     * Get running instances
     * @method getRunningInstances
     * @returns {Promise<Array<string>>} List of running instance IDs
     */
    async getRunningInstances() {
        try {
            // Read lock data
            if (!fs.existsSync(this.instanceLockFile)) {
                return [];
            }

            const data = await fs.promises.readFile(this.instanceLockFile, 'utf8');
            const lockData = JSON.parse(data);

            // Filter running instances
            const instances = Object.keys(lockData.instances).filter(instanceId => {
                const instance = lockData.instances[instanceId];
                return this.isProcessRunning(instance.pid);
            });

            return instances;
        } catch (error) {
            log.error('Error getting running instances:', error);
            return [];
        }
    }

    /**
     * Get sessions for an instance
     * @method getInstanceSessions
     * @param {string} instanceId - Instance ID
     * @returns {Promise<Array<Object>>} List of sessions for the instance
     */
    async getInstanceSessions(instanceId) {
        try {
            // Read lock data
            if (!fs.existsSync(this.instanceLockFile)) {
                return [];
            }

            const data = await fs.promises.readFile(this.instanceLockFile, 'utf8');
            const lockData = JSON.parse(data);

            // Get sessions for instance
            const instance = lockData.instances[instanceId];
            if (!instance) {
                return [];
            }

            return instance.providers;
        } catch (error) {
            log.error('Error getting instance sessions:', error);
            return [];
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
                release();
            }
        }
    }

    /**
     * Initialize instance manager and create instance ID
     * @method initialize
     * @returns {Promise<void>}
     * @throws {Error} If initialization fails
     */
    async initialize() {
        try {
            // Generate unique instance ID
            const timestamp = Date.now();
            const random = Math.floor(Math.random() * 1000000);
            this.instanceId = `${timestamp}-${random}`;

            // Initialize lock file with instance data
            await this.initializeLockFile(this.instanceId);

            // Register PID
            await this.registerPid();

            log.info(`Instance manager initialized with ID: ${this.instanceId}`);
        } catch (error) {
            log.error('Error initializing instance manager:', error);
            throw error;
        }
    }

    /**
     * Initialize the instance lock file
     * @method initializeLockFile
     * @param {string} instanceId - Unique ID for this instance
     * @returns {Promise<void>}
     * @throws {Error} If lock file initialization fails
     */
    async initializeLockFile(instanceId) {
        let release;
        try {
            // Acquire lock for file operations
            release = await this.acquireWriteLock(this.instanceLockFile);

            // Default lock data structure
            let lockData = {
                instances: {}
            };

            try {
                // Try to read existing lock data
                const data = await fs.promises.readFile(this.instanceLockFile, 'utf8');
                if (data && data.trim()) {
                    lockData = JSON.parse(data);
                    
                    // Ensure the structure is valid
                    if (!lockData.instances) {
                        lockData.instances = {};
                    }
                }
            } catch (readError) {
                // If file doesn't exist or is corrupted, use default structure
                log.warn(`Lock file could not be read, creating new one: ${readError.message}`);
            }

            // Add new instance
            lockData.instances[instanceId] = {
                pid: process.pid,
                timestamp: Date.now(),
                providers: []
            };

            // Write updated lock data
            await fs.promises.writeFile(this.instanceLockFile, JSON.stringify(lockData, null, 2));
            log.info(`Lock file initialized for instance ${instanceId}`);
        } catch (error) {
            log.error('Error initializing lock file:', error);
            throw error;
        } finally {
            if (release) {
                release();
            }
        }
    }
}

// Export a singleton instance
module.exports = new InstanceManager();
