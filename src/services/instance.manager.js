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
            // Don't try to acquire lock for CLI commands that don't need it
            if (process.argv.includes('--profiles') && process.argv.includes('list')) {
                return () => {};
            }

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
     * Check if there's a running instance
     * @method hasRunningInstance
     * @returns {Promise<boolean>} True if there's a running instance
     */
    async hasRunningInstance() {
        try {
            // Don't check for running instances for CLI commands that don't need it
            if (process.argv.includes('--profiles') && process.argv.includes('list')) {
                return false;
            }

            const pids = await this.readPidFile();
            return pids.length > 0;
        } catch (error) {
            log.error('Error checking running instances:', error);
            return false;
        }
    }

    /**
     * Check if an instance can handle a profile
     * @method canHandleProfile
     * @param {string} profile - Profile name to check
     * @returns {Promise<boolean>} True if profile can be handled
     */
    async canHandleProfile(profile) {
        try {
            // Don't check profile handling for CLI commands that don't need it
            if (process.argv.includes('--profiles') && process.argv.includes('list')) {
                return false;
            }

            const lockData = await this.readLockFile();
            for (const instance of Object.values(lockData.instances)) {
                if (instance.profile === profile) {
                    return true;
                }
            }
            return false;
        } catch (error) {
            log.error('Error checking profile handling:', error);
            return false;
        }
    }

    /**
     * Read the lock file
     * @method readLockFile
     * @returns {Promise<Object>} Lock file data
     */
    async readLockFile() {
        try {
            const data = await fs.promises.readFile(this.instanceLockFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            log.error('Error reading lock file:', error);
            return { instances: {} };
        }
    }

    /**
     * Read the PID file
     * @method readPidFile
     * @returns {Promise<Array<number>>} List of PIDs
     */
    async readPidFile() {
        try {
            const data = await fs.promises.readFile(this.pidFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            log.error('Error reading PID file:', error);
            return [];
        }
    }

    /**
     * Reset instance locks
     * @method resetLock
     * @returns {Promise<void>}
     */
    async resetLock() {
        try {
            // Kill all processes in PID file
            const pids = await this.readPidFile();
            for (const pid of pids) {
                try {
                    process.kill(pid);
                } catch (error) {
                    log.warn(`Could not kill process ${pid}:`, error);
                }
            }

            // Remove PID file
            await fs.promises.unlink(this.pidFile);

            // Remove instance lock file
            await fs.promises.unlink(this.instanceLockFile);

            // Re-initialize directories
            await this.ensureDirectories();

            log.info('Instance locks reset');
        } catch (error) {
            log.error('Error resetting instance locks:', error);
            throw error;
        }
    }

    /**
     * Clean up instance resources
     * @method cleanup
     * @returns {Promise<void>}
     */
    async cleanup() {
        try {
            // Skip cleanup for CLI commands that don't need it
            if (process.argv.includes('--profiles') && process.argv.includes('list')) {
                return;
            }

            // Remove PID from file
            const pids = await this.readPidFile();
            const newPids = pids.filter(pid => pid !== process.pid);
            await fs.promises.writeFile(this.pidFile, JSON.stringify(newPids, null, 2));

            // Remove instance from lock file
            if (this.instanceId) {
                const lockData = await this.readLockFile();
                delete lockData.instances[this.instanceId];
                await fs.promises.writeFile(this.instanceLockFile, JSON.stringify(lockData, null, 2));
            }

            log.info('Instance cleaned up');
        } catch (error) {
            log.error('Error cleaning up instance:', error);
        }
    }
}

// Export a singleton instance
module.exports = new InstanceManager();
