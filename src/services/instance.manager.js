/**
 * @file Instance management service that handles application instance lifecycle,
 * locking, and PID tracking to ensure proper multi-instance behavior.
 */

const { app, ipcMain } = require('electron');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');
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
        let release = null;
        try {
            // Acquire exclusive lock before reading/writing lock file
            release = await properLock.lock(this.instanceLockFile, {
                retries: this.lockRetryCount,
                retryWait: this.lockRetryDelay,
                stale: 10000 // Consider lock stale after 10s
            });

            // Check if file exists first
            if (!fs.existsSync(this.instanceLockFile)) {
                const emptyLockData = { instances: {} };
                await fs.promises.writeFile(this.instanceLockFile, JSON.stringify(emptyLockData, null, 2));
                return emptyLockData;
            }

            const data = await fs.promises.readFile(this.instanceLockFile, 'utf8');
            
            // Handle empty file case
            if (!data.trim()) {
                const emptyLockData = { instances: {} };
                await fs.promises.writeFile(this.instanceLockFile, JSON.stringify(emptyLockData, null, 2));
                return emptyLockData;
            }

            const lockData = JSON.parse(data);
            
            // Validate lock data structure
            if (!lockData || typeof lockData !== 'object' || !lockData.instances || typeof lockData.instances !== 'object') {
                log.warn('Lock file contains invalid data, resetting');
                const emptyLockData = { instances: {} };
                await fs.promises.writeFile(this.instanceLockFile, JSON.stringify(emptyLockData, null, 2));
                return emptyLockData;
            }

            // Clean up stale instances
            const pids = await this.readPidFile();
            let hasStaleInstances = false;
            
            for (const [id, instance] of Object.entries(lockData.instances)) {
                if (!instance.pid || !pids.includes(instance.pid)) {
                    delete lockData.instances[id];
                    hasStaleInstances = true;
                }
            }

            if (hasStaleInstances) {
                await fs.promises.writeFile(this.instanceLockFile, JSON.stringify(lockData, null, 2));
            }

            return lockData;
        } catch (error) {
            log.error('Error reading lock file:', error);
            // Initialize with empty lock data on error
            const emptyLockData = { instances: {} };
            try {
                await fs.promises.writeFile(this.instanceLockFile, JSON.stringify(emptyLockData, null, 2));
            } catch (writeError) {
                log.error('Error writing empty lock file:', writeError);
            }
            return emptyLockData;
        } finally {
            if (release) {
                try {
                    await release();
                } catch (releaseError) {
                    log.error('Error releasing lock file lock:', releaseError);
                }
            }
        }
    }

    /**
     * Write the lock file
     * @method writeLockFile
     * @param {Object} lockData - Lock file data to write
     * @returns {Promise<void>}
     */
    async writeLockFile(lockData) {
        let release = null;
        try {
            // Acquire exclusive lock before writing lock file
            release = await properLock.lock(this.instanceLockFile, {
                retries: this.lockRetryCount,
                retryWait: this.lockRetryDelay,
                stale: 10000 // Consider lock stale after 10s
            });

            await fs.promises.writeFile(this.instanceLockFile, JSON.stringify(lockData, null, 2));
        } catch (error) {
            log.error('Error writing lock file:', error);
            throw error;
        } finally {
            if (release) {
                try {
                    await release();
                } catch (releaseError) {
                    log.error('Error releasing lock file lock:', releaseError);
                }
            }
        }
    }

    /**
     * Read the PID file
     * @method readPidFile
     * @returns {Promise<Array<number>>} List of PIDs
     */
    async readPidFile() {
        let release = null;
        try {
            // Acquire exclusive lock before reading/writing PID file
            release = await properLock.lock(this.pidFile, {
                retries: this.lockRetryCount,
                retryWait: this.lockRetryDelay,
                stale: 10000 // Consider lock stale after 10s
            });

            // Check if file exists first
            if (!fs.existsSync(this.pidFile)) {
                await fs.promises.writeFile(this.pidFile, JSON.stringify([], null, 2));
                return [];
            }

            const data = await fs.promises.readFile(this.pidFile, 'utf8');
            
            // Handle empty file case
            if (!data.trim()) {
                await fs.promises.writeFile(this.pidFile, JSON.stringify([], null, 2));
                return [];
            }

            const pids = JSON.parse(data);
            
            // Ensure the parsed data is an array
            if (!Array.isArray(pids)) {
                log.warn('PID file contains invalid data, resetting');
                await fs.promises.writeFile(this.pidFile, JSON.stringify([], null, 2));
                return [];
            }

            // Filter out any non-number PIDs and validate they still exist
            const validPids = pids.filter(pid => {
                if (typeof pid !== 'number') {
                    return false;
                }
                try {
                    // Check if process exists by sending signal 0
                    process.kill(pid, 0);
                    return true;
                } catch (e) {
                    // Process doesn't exist
                    return false;
                }
            });

            // If we filtered out any PIDs, update the file
            if (validPids.length !== pids.length) {
                await fs.promises.writeFile(this.pidFile, JSON.stringify(validPids, null, 2));
            }

            return validPids;
        } catch (error) {
            log.error('Error reading PID file:', error);
            // Initialize with empty array on error
            try {
                await fs.promises.writeFile(this.pidFile, JSON.stringify([], null, 2));
            } catch (writeError) {
                log.error('Error writing empty PID file:', writeError);
            }
            return [];
        } finally {
            if (release) {
                try {
                    await release();
                } catch (releaseError) {
                    log.error('Error releasing PID file lock:', releaseError);
                }
            }
        }
    }

    /**
     * Write the PID file
     * @method writePidFile
     * @param {Array<number>} pids - List of PIDs to write
     * @returns {Promise<void>}
     */
    async writePidFile(pids) {
        let release = null;
        try {
            // Acquire exclusive lock before writing PID file
            release = await properLock.lock(this.pidFile, {
                retries: this.lockRetryCount,
                retryWait: this.lockRetryDelay,
                stale: 10000 // Consider lock stale after 10s
            });

            await fs.promises.writeFile(this.pidFile, JSON.stringify(pids, null, 2));
        } catch (error) {
            log.error('Error writing PID file:', error);
            throw error;
        } finally {
            if (release) {
                try {
                    await release();
                } catch (releaseError) {
                    log.error('Error releasing PID file lock:', releaseError);
                }
            }
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

            // Reset PID file to empty array
            await this.writePidFile([]);

            // Reset instance lock file to empty object
            await this.writeLockFile({ instances: {} });

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
            await this.writePidFile(newPids);

            // Remove instance from lock file
            if (this.instanceId) {
                const lockData = await this.readLockFile();
                delete lockData.instances[this.instanceId];
                await this.writeLockFile(lockData);
            }

            log.info('Instance cleaned up');
        } catch (error) {
            log.error('Error cleaning up instance:', error);
        }
    }

    /**
     * Delegate a command to an existing instance
     * @method delegateCommand
     * @param {Array<string>} args - Command line arguments to delegate
     * @returns {Promise<boolean>} True if command was delegated successfully
     */
    async delegateCommand(args) {
        try {
            log.info('Delegating command to existing instance:', args);
            
            // Get running instances from PID file
            const pids = await this.readPidFile();
            if (pids.length === 0) {
                log.warn('No running instances found to delegate command to');
                return false;
            }
            
            // Get the first running instance
            const targetPid = pids[0];
            log.info(`Delegating command to instance with PID: ${targetPid}`);
            
            // Prepare command arguments as a JSON string
            const commandArgs = JSON.stringify(args);
            
            // Use IPC or another mechanism to send the command to the running instance
            // For now, we'll just log that we would delegate the command
            log.info(`Command would be delegated to PID ${targetPid} with args: ${commandArgs}`);
            
            // In a real implementation, you would use IPC, sockets, or another mechanism
            // to communicate with the running instance
            
            return true;
        } catch (error) {
            log.error('Error delegating command:', error);
            return false;
        }
    }

    /**
     * Get all running instances
     * @method getInstances
     * @returns {Promise<Array<Object>>} Array of running instances with their details
     */
    async getInstances() {
        try {
            const lockData = await this.readLockFile();
            const pids = await this.readPidFile();
            
            // Filter instances to only include those with valid PIDs
            return Object.entries(lockData.instances)
                .filter(([id, instance]) => {
                    if (!instance.pid) {
                        return false;
                    }
                    return pids.includes(instance.pid);
                })
                .map(([id, instance]) => ({
                    id,
                    pid: instance.pid,
                    profile: instance.profile,
                    startTime: instance.startTime
                }));
        } catch (error) {
            log.error('Error getting instances:', error);
            return [];
        }
    }
}

// Export a singleton instance
module.exports = new InstanceManager();
