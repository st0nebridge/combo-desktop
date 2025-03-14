/**
 * @file Instance management service that handles application instance lifecycle,
 * locking, and PID tracking to ensure proper multi-instance behavior.
 */

const { app, ipcMain } = require('electron');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const os = require('os');
const lockfile = require('proper-lockfile');
const { spawn } = require('child_process');

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
        
        /** @property {Map<string, number>} profilePidMap - Map of profiles to PIDs */
        this.profilePidMap = new Map();

        // Set up IPC handlers for instance communication
        if (ipcMain) {
            ipcMain.handle('add-provider', async (event, { provider, profile }) => {
                return await this.registerSession(provider, profile);
            });
            ipcMain.handle('remove-provider', async (event, { provider, profile }) => {
                return await this.unregisterSession(provider, profile);
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

            return await lockfile.lock(file, {
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
            release = await lockfile.lock(this.instanceLockFile, {
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

            // Update the profile-to-PID mapping
            this.updateProfilePidMap(lockData);

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
            release = await lockfile.lock(this.instanceLockFile, {
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
            release = await lockfile.lock(this.pidFile, {
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
            release = await lockfile.lock(this.pidFile, {
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
     */
    async cleanup() {
        try {
            log.info('Cleaning up instance manager');

            // Create a copy of session keys to avoid modification during iteration
            const sessionKeys = [...this.providerSessions.keys()];
            log.info(`Cleaning up ${sessionKeys.length} provider sessions`);

            // Clean up each session
            for (const sessionKey of sessionKeys) {
                try {
                    const [provider, profile] = sessionKey.split(':');
                    log.info(`Cleaning up session for ${provider}:${profile}`);
                    await this.unregisterSession(provider, profile);
                } catch (error) {
                    log.error(`Error cleaning up session ${sessionKey}:`, error);
                }
            }

            // Clear all maps
            this.providerSessions.clear();

            log.info('Instance manager cleanup complete');
        } catch (error) {
            log.error('Error during instance cleanup:', error);
            // Force cleanup on error
            this.providerSessions.clear();
        }
    }

    /**
     * Unregister a provider session
     * @method unregisterSession
     * @param {Object} provider - Provider instance
     * @param {string} [profile] - Optional profile name (if not provided, uses provider.profile)
     */
    async unregisterSession(provider, profile) {
        try {
            // Get provider name and profile
            const providerName = provider.getName();
            const profileName = profile || provider.profile;
            
            if (!profileName) {
                log.warn(`Cannot unregister session - no profile for ${providerName}`);
                return;
            }
            
            const sessionKey = `${providerName}:${profileName}`;
            log.info(`Processing unregister for session ${sessionKey}`);
            
            if (this.providerSessions.has(sessionKey)) {
                log.info(`Found session for ${sessionKey}, starting cleanup`);
                const session = this.providerSessions.get(sessionKey);

                // Delete session first to prevent hanging
                this.providerSessions.delete(sessionKey);
                log.info(`Removed session from registry: ${sessionKey}`);

                // Destroy tray icon
                try {
                    const windowName = provider.getWindowName(profileName);
                    const trayService = require('./tray.service');
                    trayService.destroyTray(windowName);
                    log.info(`Destroyed tray icon for ${windowName}`);
                } catch (error) {
                    log.error(`Error destroying tray for ${sessionKey}:`, error);
                }

                // Close the window if it exists
                try {
                    const windowService = require('./window.service');
                    const windowName = provider.getWindowName(profileName);
                    const { window } = windowService.resolveWindow(windowName);
                    if (window && !window.isDestroyed()) {
                        window.forceClose = true;
                        window.close();
                        log.info(`Closed window for ${windowName}`);
                    }
                } catch (error) {
                    log.error(`Error closing window for ${sessionKey}:`, error);
                }

                // Try to clean up session data, but don't wait for it
                try {
                    log.info(`Attempting to clear session data for ${sessionKey}`);
                    // Don't await this - it might be hanging
                    session.clearData().catch(error => {
                        log.error(`Error clearing session data for ${sessionKey}:`, error);
                    });
                    log.info(`Session data cleanup initiated for ${sessionKey}`);
                } catch (error) {
                    log.error(`Error initiating session data cleanup for ${sessionKey}:`, error);
                }

                // Try to remove listeners, but don't wait for it
                try {
                    session.removeAllListeners();
                    log.info(`Removed all session listeners for ${sessionKey}`);
                } catch (error) {
                    log.error(`Error removing session listeners for ${sessionKey}:`, error);
                }
                
                // Emit event when no sessions remain
                if (this.providerSessions.size === 0) {
                    log.info('All sessions closed, emitting last-session-closed event');
                    const { app } = require('electron');
                    app.emit('last-session-closed');
                }
            } else {
                log.warn(`No session found for ${sessionKey}`);
                
                // Still try to close window and destroy tray
                try {
                    const windowName = provider.getWindowName(profileName);
                    
                    // Destroy tray
                    try {
                        const trayService = require('./tray.service');
                        trayService.destroyTray(windowName);
                        log.info(`Destroyed tray icon for ${windowName} (no session)`);
                    } catch (trayError) {
                        log.error(`Error destroying tray for ${windowName} (no session):`, trayError);
                    }
                    
                    // Close window
                    try {
                        const windowService = require('./window.service');
                        const { window } = windowService.resolveWindow(windowName);
                        if (window && !window.isDestroyed()) {
                            window.forceClose = true;
                            window.close();
                            log.info(`Closed window for ${windowName} (no session)`);
                        }
                    } catch (windowError) {
                        log.error(`Error closing window for ${windowName} (no session):`, windowError);
                    }
                } catch (error) {
                    log.error(`Error handling cleanup for ${sessionKey} (no session):`, error);
                }
            }
            
            log.info(`Unregister session completed for ${sessionKey}`);
            return true;
        } catch (error) {
            log.error(`Error unregistering session:`, error);
            
            // Try to get session key even after error
            let sessionKey = null;
            try {
                const providerName = provider.getName();
                const profileName = profile || provider.profile;
                if (providerName && profileName) {
                    sessionKey = `${providerName}:${profileName}`;
                    this.providerSessions.delete(sessionKey);
                    log.info(`Force-removed session from registry: ${sessionKey}`);
                    
                    // Check if this was the last session
                    if (this.providerSessions.size === 0) {
                        log.info('All sessions closed (after error), emitting last-session-closed event');
                        const { app } = require('electron');
                        app.emit('last-session-closed');
                    }
                    
                    return true;
                }
            } catch (keyError) {
                log.error('Error getting session key for cleanup:', keyError);
            }
            
            return false;
        }
    }

    /**
     * Delegate a command to an existing instance
     * @method delegateCommand
     * @param {Array<string>} args - Command line arguments to delegate
     * @param {string} [targetProfile] - Optional profile to target for delegation
     * @returns {Promise<boolean>} True if command was delegated successfully
     */
    async delegateCommand(args, targetProfile = null) {
        try {
            log.info('Delegating command to existing instance:', args);
            
            // Get running instances from PID file
            const pids = await this.readPidFile();
            if (pids.length === 0) {
                log.warn('No running instances found to delegate command to');
                return false;
            }
            
            let targetPid = null;
            let targetInstanceId = null;
            
            // If a target profile is specified, try to find its PID
            if (targetProfile) {
                log.info(`Looking for instance running profile: ${targetProfile}`);
                const instance = await this.getInstanceByProfile(targetProfile);
                
                if (instance && instance.pid && pids.includes(instance.pid)) {
                    targetPid = instance.pid;
                    targetInstanceId = instance.id;
                    log.info(`Found instance ${targetInstanceId} with PID ${targetPid} for profile ${targetProfile}`);
                } else {
                    log.warn(`No running instance found for profile ${targetProfile}`);
                }
            }
            
            // If no target profile or no instance found for the profile, use the first running instance
            if (!targetPid && pids.length > 0) {
                targetPid = pids[0];
                
                // Try to get the instance ID for this PID
                const lockData = await this.readLockFile();
                for (const [id, instance] of Object.entries(lockData.instances)) {
                    if (instance.pid === targetPid) {
                        targetInstanceId = id;
                        break;
                    }
                }
                
                log.info(`Defaulting to instance with PID: ${targetPid}`);
            }
            
            if (targetPid) {
                // Prepare command arguments as a JSON string
                const commandArgs = JSON.stringify(args);
                
                if (targetInstanceId) {
                    return await this.delegateCommandToInstance(targetInstanceId, args);
                } else {
                    log.info(`Command would be delegated to PID ${targetPid} with args: ${commandArgs}`);
                    // In a real implementation, you would use IPC, sockets, or another mechanism
                    // to communicate with the running instance
                    return true;
                }
            }
            
            log.warn('Could not find a suitable instance to delegate to');
            return false;
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

    /**
     * Register a provider session
     * @method registerSession
     * @param {string} provider - Provider name
     * @param {string} profile - Profile name
     * @returns {Promise<void>}
     */
    async registerSession(provider, profile) {
        try {
            const sessionKey = `${provider}:${profile}`;
            this.providerSessions.set(sessionKey, { provider, profile });
            log.info(`Registered session for ${sessionKey}`);
        } catch (error) {
            log.error(`Error registering session for ${provider}:${profile}:`, error);
        }
    }

    /**
     * Process sessions according to instance management rules
     * @method processSessions
     * @param {Array<Object>} sessions - Array of session objects with provider and profile
     * @param {boolean} forceNewInstance - Whether to force a new instance
     * @param {boolean} oneInstance - Whether to force all providers into one instance
     * @param {boolean} profileIsolation - Whether to enforce profile isolation
     * @returns {Promise<{localSessions: Array<Object>, delegatedSessions: Array<Object>}>} Sessions to run locally and those delegated
     */
    async processSessions(sessions, forceNewInstance = false, oneInstance = false, profileIsolation = true) {
        try {
            if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
                log.info('No sessions to process');
                return { localSessions: [], delegatedSessions: [] };
            }

            log.info('Processing sessions according to instance rules:', sessions);
            log.info(`Force new instance: ${forceNewInstance}, One instance: ${oneInstance}, Profile isolation: ${profileIsolation}`);

            // Initialize result
            const result = {
                localSessions: [],
                delegatedSessions: []
            };

            // If --new-instance flag is set, all sessions run in this instance
            if (forceNewInstance) {
                log.info('Forcing new instance, all sessions will run locally');
                result.localSessions = [...sessions];
                return result;
            }

            // Get running instances
            const instances = await this.getInstances();
            const lockData = await this.readLockFile();
            
            // Handle the case where we have multiple sessions of the same provider with different profiles
            // and no running instances
            if (instances.length === 0) {
                log.info('No running instances found, processing sessions');
                
                // If we have multiple sessions of the same provider with different profiles,
                // we should run one locally and delegate the others
                const providerMap = new Map();
                
                // Group sessions by provider
                for (const session of sessions) {
                    const provider = session.provider;
                    if (!providerMap.has(provider)) {
                        providerMap.set(provider, []);
                    }
                    providerMap.get(provider).push(session);
                }
                
                // For each provider, if there are multiple sessions, keep one local and delegate others
                for (const [provider, providerSessions] of providerMap.entries()) {
                    if (providerSessions.length > 1 && profileIsolation) {
                        // Keep the first session local and delegate the rest
                        result.localSessions.push(providerSessions[0]);
                        result.delegatedSessions.push(...providerSessions.slice(1));
                        log.info(`Multiple sessions for provider ${provider}, keeping one local and delegating others`);
                    } else {
                        // If only one session or profile isolation is disabled, keep it local
                        result.localSessions.push(...providerSessions);
                    }
                }
                
                return result;
            }

            // If --one-instance flag is set, delegate to first instance if possible
            if (oneInstance) {
                log.info('One instance mode, attempting to delegate all sessions');
                
                // Check if any session already exists in any instance
                for (const session of sessions) {
                    if (await this.sessionExists(session.provider, session.profile || 'default')) {
                        log.info(`Session ${session.provider}:${session.profile || 'default'} already exists, cannot delegate`);
                        return { 
                            localSessions: [...sessions], 
                            delegatedSessions: [] 
                        };
                    }
                }

                // If we got here, no sessions exist yet, delegate all to first instance
                const firstInstance = instances[0];
                log.info(`No session conflicts found, delegating all to first instance: ${firstInstance.id}`);
                return { 
                    localSessions: [], 
                    delegatedSessions: [...sessions] 
                };
            }

            // Default behavior: profile isolation (following app_instances.md rules)
            if (profileIsolation) {
                log.info('Profile isolation enabled, processing sessions by profile');
                // Group sessions by profile
                const sessionsByProfile = {};
                for (const session of sessions) {
                    const profile = session.profile || 'default';
                    if (!sessionsByProfile[profile]) {
                        sessionsByProfile[profile] = [];
                    }
                    sessionsByProfile[profile].push(session);
                }

                // For each profile group, determine if it can be delegated
                for (const [profile, profileSessions] of Object.entries(sessionsByProfile)) {
                    log.info(`Processing profile group: ${profile} with ${profileSessions.length} sessions`);
                    
                    // Check if any session in this profile already exists in any instance
                    let hasExistingSession = false;
                    let existingSessionInstance = null;
                    
                    for (const session of profileSessions) {
                        const sessionExists = await this.sessionExists(session.provider, profile);
                        if (sessionExists) {
                            hasExistingSession = true;
                            
                            // Find which instance has this session
                            for (const instance of instances) {
                                const instanceSessions = instance.sessions || [];
                                if (instanceSessions.some(s => s.provider === session.provider && s.profile === profile)) {
                                    existingSessionInstance = instance;
                                    break;
                                }
                            }
                            
                            log.info(`Session ${session.provider}:${profile} already exists in instance ${existingSessionInstance?.id || 'unknown'}`);
                            break;
                        }
                    }
                    
                    if (hasExistingSession) {
                        // If any session in this profile exists in an instance, run all sessions in this profile locally
                        // only if this is the instance where the session exists
                        if (existingSessionInstance && existingSessionInstance.id === this.instanceId) {
                            log.info(`Sessions for profile ${profile} will run locally in this instance`);
                            result.localSessions.push(...profileSessions);
                        } else {
                            // Otherwise, delegate to the instance where the session exists
                            log.info(`Sessions for profile ${profile} will be delegated to instance ${existingSessionInstance?.id || 'unknown'}`);
                            result.delegatedSessions.push(...profileSessions);
                        }
                        continue;
                    }
                    
                    // Check if this profile exists in any instance
                    let targetInstance = null;
                    for (const instance of instances) {
                        if (instance.profile === profile) {
                            targetInstance = instance;
                            break;
                        }
                    }

                    if (targetInstance) {
                        log.info(`Found instance ${targetInstance.id} with profile ${profile}, delegating sessions`);
                        result.delegatedSessions.push(...profileSessions);
                    } else {
                        // No instance found with this profile, check if this is the first instance with no providers
                        if (this.isFirstInstance && this.providerSessions.size === 0) {
                            log.info(`This is first instance with no providers, running profile ${profile} locally`);
                            result.localSessions.push(...profileSessions);
                        } else {
                            // Following app_instances.md rules: create new instance for new profile
                            log.info(`No instance found with profile ${profile}, creating new instance`);
                            // Mark these for delegation - they'll be handled by creating a new process
                            result.delegatedSessions.push(...profileSessions);
                        }
                    }
                }
            } else {
                // Profile isolation disabled, all sessions run in this instance
                log.info('Profile isolation disabled, all sessions will run locally');
                result.localSessions = [...sessions];
            }

            log.info('Session processing complete', result);
            return result;
        } catch (error) {
            log.error('Error processing sessions:', error);
            // Default to running all sessions locally on error
            return { localSessions: [...sessions], delegatedSessions: [] };
        }
    }

    /**
     * Delegate sessions to existing instances or create new instances
     * @method delegateSessions
     * @param {Array<Object>} sessions - Array of session objects with provider and profile
     * @param {boolean} profileIsolation - Whether to enforce profile isolation
     * @returns {Promise<boolean>} Success status
     */
    async delegateSessions(sessions, profileIsolation = true) {
        try {
            if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
                log.info('No sessions to delegate');
                return true;
            }

            log.info('Delegating sessions:', sessions);
            log.info(`Profile isolation: ${profileIsolation}`);

            // Group sessions by profile if profile isolation is enabled
            const sessionsByProfile = {};
            
            if (profileIsolation) {
                // Group by profile for profile isolation
                for (const session of sessions) {
                    const profile = session.profile || 'default';
                    if (!sessionsByProfile[profile]) {
                        sessionsByProfile[profile] = [];
                    }
                    sessionsByProfile[profile].push(session);
                }
            } else {
                // If profile isolation is disabled, treat all sessions as one group
                sessionsByProfile['all'] = [...sessions];
            }

            // Get running instances
            const instances = await this.getInstances();
            
            // For each profile group, find a suitable instance or create a new one
            for (const [profile, profileSessions] of Object.entries(sessionsByProfile)) {
                log.info(`Delegating profile group: ${profile} with ${profileSessions.length} sessions`);
                
                let targetInstance = null;
                
                if (profileIsolation) {
                    // Find an instance with the same profile
                    for (const instance of instances) {
                        if (instance.profile === profile) {
                            targetInstance = instance;
                            break;
                        }
                    }
                } else {
                    // If profile isolation is disabled, use the first available instance
                    if (instances.length > 0) {
                        targetInstance = instances[0];
                    }
                }

                if (targetInstance) {
                    // Delegate to existing instance
                    log.info(`Delegating to existing instance: ${targetInstance.id}`);
                    const success = await this.delegateToInstance(targetInstance, profileSessions);
                    if (!success) {
                        log.error(`Failed to delegate to instance ${targetInstance.id}`);
                        return false;
                    }
                } else {
                    // Create new instance
                    log.info(`Creating new instance for profile: ${profile}`);
                    const success = await this.createNewInstance(profileSessions, profile);
                    if (!success) {
                        log.error(`Failed to create new instance for profile ${profile}`);
                        return false;
                    }
                }
            }

            return true;
        } catch (error) {
            log.error('Error delegating sessions:', error);
            return false;
        }
    }

    /**
     * Delegate a command to a specific instance
     * @method delegateCommandToInstance
     * @param {string} instanceId - ID of the instance to delegate to
     * @param {Array<string>} args - Command line arguments to delegate
     * @returns {Promise<boolean>} True if command was delegated successfully
     */
    async delegateCommandToInstance(instanceId, args) {
        try {
            log.info(`Delegating command to instance ${instanceId}:`, args);
            
            // Get instance details
            const instances = await this.getInstances();
            const targetInstance = instances.find(instance => instance.id === instanceId);
            
            if (!targetInstance) {
                log.error(`Instance ${instanceId} not found`);
                return false;
            }
            
            // Prepare command arguments as a JSON string
            const commandArgs = JSON.stringify(args);
            
            // Use IPC or another mechanism to send the command to the running instance
            // For now, we'll use a simple approach by spawning a new process with the args
            const execPath = process.execPath;
            const appArgs = [
                ...process.argv.slice(1, 2), // First arg after execPath
                '--delegate-to',
                targetInstance.pid.toString(),
                ...args
            ];
            
            log.info(`Spawning process for delegation: ${execPath} ${appArgs.join(' ')}`);
            
            // Spawn the process
            const child = spawn(execPath, appArgs, {
                detached: true,
                stdio: 'ignore'
            });
            
            // Unref the child to allow this process to exit
            child.unref();
            
            return true;
        } catch (error) {
            log.error(`Error delegating command to instance ${instanceId}:`, error);
            return false;
        }
    }

    /**
     * Check if a session exists in any running instance
     * @method sessionExists
     * @param {string} provider - Provider name
     * @param {string} profile - Profile name
     * @returns {Promise<boolean>} True if session exists
     */
    async sessionExists(provider, profile) {
        try {
            const sessionKey = `${provider}:${profile || 'default'}`;
            const lockData = await this.readLockFile();
            
            for (const instance of Object.values(lockData.instances)) {
                if (instance.sessions && instance.sessions.includes(sessionKey)) {
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            log.error('Error checking if session exists:', error);
            return false;
        }
    }

    /**
     * Get the status of instance manager
     * @method getStatus
     * @returns {Promise<Object>} Status object
     */
    async getStatus() {
        try {
            const lockExists = fs.existsSync(this.instanceLockFile);
            const instances = await this.getInstances();
            
            return {
                lockFile: this.instanceLockFile,
                lockExists,
                currentId: this.instanceId,
                runningCount: instances.length,
                instances
            };
        } catch (error) {
            log.error('Error getting instance status:', error);
            return {
                lockFile: this.instanceLockFile,
                lockExists: false,
                currentId: null,
                runningCount: 0,
                instances: []
            };
        }
    }

    /**
     * Initialize an instance with the given profile and settings
     * @method initializeInstance
     * @param {string} profile - Profile name for this instance
     * @param {Object} options - Instance initialization options
     * @param {boolean} [options.profileIsolation=true] - Whether to enforce profile isolation
     * @returns {Promise<string>} Instance ID
     */
    async initializeInstance(profile, options = {}) {
        try {
            // Default to profile isolation as per app_instances.md rules
            const profileIsolation = options.profileIsolation !== false;
            
            log.info(`Initializing instance with profile: ${profile}, profileIsolation: ${profileIsolation}`);
            
            // Generate a unique instance ID
            const instanceId = `instance-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
            this.instanceId = instanceId;
            this.currentProfile = profile;
            
            // Update lock file with instance information
            const lockData = await this.readLockFile();
            
            // Add this instance to the lock file
            lockData.instances[instanceId] = {
                pid: process.pid,
                profile,
                startTime: Date.now(),
                sessions: [],
                profileIsolation
            };
            
            await this.writeLockFile(lockData);
            
            // Update PID file
            const pids = await this.readPidFile();
            if (!pids.includes(process.pid)) {
                pids.push(process.pid);
                await this.writePidFile(pids);
            }
            
            // Check if this is the first instance
            if (Object.keys(lockData.instances).length === 1) {
                this.isFirstInstance = true;
                log.info('This is the first instance');
            }
            
            // Update the profile-to-PID mapping
            this.updateProfilePidMap(lockData);
            
            log.info(`Instance initialized with ID: ${instanceId}`);
            return instanceId;
        } catch (error) {
            log.error('Error initializing instance:', error);
            throw error;
        }
    }

    /**
     * Delegate sessions to an existing instance
     * @method delegateToInstance
     * @param {Object} instance - Target instance object
     * @param {Array<Object>} sessions - Array of session objects to delegate
     * @returns {Promise<boolean>} Success status
     */
    async delegateToInstance(instance, sessions) {
        try {
            if (!instance || !instance.id) {
                log.error('Invalid instance provided for delegation');
                return false;
            }

            log.info(`Delegating ${sessions.length} sessions to instance ${instance.id}`);
            
            // Build command line arguments for delegation
            const args = [];
            for (const session of sessions) {
                args.push(`--${session.provider}`);
                if (session.profile && session.profile !== 'default') {
                    args.push(session.profile);
                }
            }

            // Delegate to the target instance
            const result = await this.delegateCommandToInstance(instance.id, args);
            if (!result) {
                log.error(`Failed to delegate to instance ${instance.id}`);
                return false;
            }

            return true;
        } catch (error) {
            log.error('Error delegating to instance:', error);
            return false;
        }
    }

    /**
     * Create a new instance for sessions
     * @method createNewInstance
     * @param {Array<Object>} sessions - Array of session objects
     * @param {string} profile - Profile name for the new instance
     * @returns {Promise<boolean>} Success status
     */
    async createNewInstance(sessions, profile) {
        try {
            log.info(`Creating new instance for profile ${profile} with ${sessions.length} sessions`);
            
            // Build command line arguments for new instance
            const args = ['--new-instance'];
            
            // Add profile isolation flag
            args.push('--profile-isolation');
            
            // Add profile if not default
            if (profile && profile !== 'default') {
                args.push('--profile', profile);
            }
            
            // Add provider arguments
            for (const session of sessions) {
                args.push(`--${session.provider}`);
                if (session.profile && session.profile !== 'default') {
                    args.push(session.profile);
                }
            }

            // Launch new instance process
            const execPath = process.execPath;
            const appArgs = [
                ...process.argv.slice(1, 2), // First arg after execPath
                ...args
            ];
            
            log.info(`Spawning new instance process: ${execPath} ${appArgs.join(' ')}`);
            
            // Spawn the process
            const child = spawn(execPath, appArgs, {
                detached: true,
                stdio: 'ignore'
            });
            
            // Unref the child to allow this process to exit
            child.unref();
            
            return true;
        } catch (error) {
            log.error('Error creating new instance:', error);
            return false;
        }
    }

    /**
     * Update the profile-to-PID mapping based on lock file data
     * @method updateProfilePidMap
     * @param {Object} lockData - Lock file data
     * @private
     */
    updateProfilePidMap(lockData) {
        // Clear the existing map
        this.profilePidMap.clear();
        
        // Populate the map with profile to PID mappings
        for (const instance of Object.values(lockData.instances)) {
            if (instance.profile && instance.pid) {
                this.profilePidMap.set(instance.profile, instance.pid);
                log.debug(`Mapped profile ${instance.profile} to PID ${instance.pid}`);
            }
        }
    }

    /**
     * Get the PID for a specific profile
     * @method getPidForProfile
     * @param {string} profile - Profile name
     * @returns {Promise<number|null>} PID for the profile, or null if not found
     */
    async getPidForProfile(profile) {
        // Refresh the profile-to-PID mapping
        await this.readLockFile();
        
        // Return the PID for the profile
        const pid = this.profilePidMap.get(profile);
        log.debug(`PID for profile ${profile}: ${pid || 'not found'}`);
        return pid || null;
    }

    /**
     * Get instance by profile
     * @method getInstanceByProfile
     * @param {string} profile - Profile name
     * @returns {Promise<Object|null>} Instance object or null if not found
     */
    async getInstanceByProfile(profile) {
        try {
            const lockData = await this.readLockFile();
            
            for (const [id, instance] of Object.entries(lockData.instances)) {
                if (instance.profile === profile) {
                    return {
                        id,
                        pid: instance.pid,
                        profile: instance.profile,
                        startTime: instance.startTime
                    };
                }
            }
            
            return null;
        } catch (error) {
            log.error(`Error getting instance for profile ${profile}:`, error);
            return null;
        }
    }
}

// Export a singleton instance
module.exports = new InstanceManager();
