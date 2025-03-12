const { app, ipcMain } = require('electron');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { setTimeout } = require('timers/promises');
const properLock = require('proper-lockfile');
const cliRegistry = require('../cli/cli.registry');

/**
 * Instance Manager
 * Handles instance management, locking, and PID tracking
 */
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

    /**
     * Ensure required directories exist
     */
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

    /**
     * Register cleanup handlers for process exit
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
     * @param {string} file - File to lock
     * @param {Object} options - Lock options
     * @returns {Promise<Function>} Release function
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
     * Register this instance's PID
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
     * @param {Object} args - Parsed CLI arguments
     * @returns {Promise<boolean>} True if registration successful
     */
    async handleInstanceRegistration(args) {
        try {
            if (!args) {
                log.info('No CLI arguments to process');
                return true;
            }

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
            return false;
        }
    }

    /**
     * Check if we should create a new instance
     * @param {Object} args - CLI arguments
     * @returns {Promise<boolean>} True if we should create a new instance
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
     * Initialize the lock file for this instance
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
     * Check if a process is running
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
     * Reset the instance lock file
     */
    async resetLock() {
        try {
            if (fs.existsSync(this.instanceLockFile)) {
                await fs.promises.unlink(this.instanceLockFile);
                log.info('Instance lock file reset');
            }
        } catch (error) {
            log.error('Error resetting lock file:', error);
            throw error;
        }
    }

    /**
     * Add a provider to the current instance
     * @param {string} provider - Provider name
     * @param {string} profile - Profile name
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
     * Clean up instance data on exit
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

module.exports = new InstanceManager();
