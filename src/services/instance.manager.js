/**
 * @file Instance management service that handles application instance lifecycle,
 * locking, and PID tracking to ensure proper multi-instance behavior.
 *
 * This is a minimal implementation to restore functionality after file corruption.
 * It implements the essential methods needed for WhatsApp to run properly.
 */

const { app, ipcMain } = require('electron');
const log = require('./logging.service');
const path = require('path');
const fs = require('fs');
const os = require('os');
const lockfile = require('proper-lockfile');
const net = require('net');
const { spawn } = require('child_process');

/**
 * Service for managing application instances.
 * Handles instance lifecycle, locking, and process management.
 * @class InstanceManager
 */
class InstanceManager {
    /**
     * Creates a new InstanceManager instance
     * @constructor
     */
    constructor() {
        // Ensure singleton
        if (InstanceManager.instance) {
            return InstanceManager.instance;
        }
        InstanceManager.instance = this;

        // Ensure app name is set before getting userData path
        if (!app || !app.name) {
            try {
                const packageJson = require('../../package.json');
                if (app) app.name = packageJson.name || 'desk-tray';
            } catch (error) {
                log.error('Could not load package.json:', error);
                if (app) app.name = 'desk-tray';
            }
        }

        /** @property {string} instanceLockFile - Path to instance lock file */
        try {
            this.instanceLockFile = path.join(app.getPath('userData'), 'instance.lock');
        } catch (error) {
            const tempPath = path.join(os.tmpdir(), 'desk-tray');
            log.warn(`Could not get userData path, using temporary path: ${tempPath}`, error);
            this.instanceLockFile = path.join(tempPath, 'instance.lock');
        }
        
        /** @property {string} pidFile - Path to PID tracking file */
        try {
            const pidPath = app && typeof app.getPath === 'function' ? 
                path.join(app.getPath('userData'), 'pids.json') : 
                path.join(os.tmpdir(), 'desk-tray', 'pids.json');
            this.pidFile = pidPath;
        } catch (error) {
            const tempPath = path.join(os.tmpdir(), 'desk-tray', 'pids.json');
            log.warn(`Could not determine PID file path, using temporary path: ${tempPath}`, error);
            this.pidFile = tempPath;
        }
        
        /** @property {string} ipcPipeName - Name of the IPC pipe */
        let appName = 'desk-tray';
        try {
            const packageJson = require('../../package.json');
            appName = packageJson.name || appName;
        } catch (error) {
            log.warn('Could not load package.json for IPC pipe name, using default', error);
        }
        this.ipcPipeName = `\\\\.\\pipe\\${appName}-${process.pid}`;
        
        /** @property {number} lockRetryCount - Number of times to retry acquiring lock */
        this.lockRetryCount = 5;
        
        /** @property {number} lockRetryDelay - Delay in ms between lock retries */
        this.lockRetryDelay = 200;
        
        /** @property {Map<string, Object>} providerSessions - Map of provider sessions */
        this.providerSessions = new Map();
        
        /** @property {string} instanceId - Current instance ID */
        this.instanceId = null;
        
        /** @property {boolean} isFirstInstance - Whether this is the first instance */
        this.isFirstInstance = false;
        
        /** @property {Function} lockRelease - Function to release the instance lock */
        this.lockRelease = null;
    }

    /**
     * Get the IPC pipe name for this instance
     * @method getIpcPipeName
     * @private
     * @returns {string} The IPC pipe name
     */
    getIpcPipeName() {
        return this.ipcPipeName;
    }

    /**
     * Get the lock file path
     * @method getLockFilePath
     * @private
     * @returns {string} The lock file path
     */
    getLockFilePath() {
        return this.instanceLockFile;
    }

    /**
     * Get the PID file path
     * @method getPidFilePath
     * @private
     * @returns {string} The PID file path
     */
    getPidFilePath() {
        const path = require('path');
        const os = require('os');
        let appName = 'desk-tray';
        let userDataPath;

        // Get app name safely
        try {
            const packageJson = require('../../package.json');
            appName = packageJson.name || appName;
        } catch (error) {
            log.warn('Could not load package.json for PID file path, using default', error);
        }

        // Get userData path safely
        try {
            if (app && typeof app.getPath === 'function') {
                userDataPath = app.getPath('userData');
            } else {
                userDataPath = path.join(os.tmpdir(), appName);
                log.warn(`Could not get userData path, using temporary path: ${userDataPath}`);
            }
        } catch (error) {
            userDataPath = path.join(os.tmpdir(), appName);
            log.warn(`Error getting userData path, using temporary path: ${userDataPath}`, error);
        }

        return path.join(userDataPath, `${appName}.pids.json`);
    }

    /**
     * Initialize the instance manager resources
     * @method initialize
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            log.info('Initializing instance manager...');
            
            // Register cleanup handlers
            this.registerCleanupHandlers();
            
            // Setup IPC server
            this.setupIpcServer();
            
            // Generate unique instance ID
            this.instanceId = `instance-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            log.info(`Instance ID: ${this.instanceId}`);
            
            return Promise.resolve();
        } catch (error) {
            log.error('Error initializing instance manager:', error);
            return Promise.reject(error);
        }
    }
    
    /**
     * Setup IPC server for inter-process communication
     * @method setupIpcServer
     * @private
     */
    setupIpcServer() {
        try {
            // Create server
            const server = net.createServer((socket) => {
                log.debug('Client connected to IPC server');
                
                socket.on('data', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        log.debug('Received IPC message:', message);
                        
                        // Handle ping command
                        if (message.command === 'ping') {
                            const response = {
                                status: 'ok',
                                timestamp: Date.now(),
                                instanceId: this.instanceId
                            };
                            socket.write(JSON.stringify(response));
                        }
                    } catch (error) {
                        log.error('Error handling IPC message:', error);
                    }
                });
                
                socket.on('error', (error) => {
                    log.error('IPC socket error:', error);
                });
                
                socket.on('end', () => {
                    log.debug('Client disconnected from IPC server');
                });
            });
            
            server.on('error', (error) => {
                log.error('IPC server error:', error);
            });
            
            // Listen on named pipe
            server.listen(this.ipcPipeName, () => {
                log.info(`IPC server listening on ${this.ipcPipeName}`);
            });
            
            // Store server reference for cleanup
            this.ipcServer = server;
        } catch (error) {
            log.error('Error setting up IPC server:', error);
        }
    }

    /**
     * Clean up instance resources
     * @method cleanup
     * @private
     * @returns {Promise<void>}
     */
    async cleanup() {
        try {
            log.info('Cleaning up instance resources...');
            
            // Close IPC server if it exists
            if (this.ipcServer) {
                try {
                    this.ipcServer.close(() => {
                        log.info('IPC server closed successfully');
                    });
                } catch (error) {
                    log.warn('Error closing IPC server:', error);
                }
            }
            
            // Release lock if it exists
            if (this.lockRelease) {
                try {
                    await this.lockRelease();
                    this.lockRelease = null;
                    log.info('Instance lock released successfully');
                } catch (error) {
                    log.warn('Error releasing instance lock:', error);
                }
            }
            
            // Clear all sessions
            this.providerSessions.clear();
            
            return Promise.resolve();
        } catch (error) {
            log.error('Error cleaning up instance resources:', error);
            return Promise.reject(error);
        }
    }

    /**
     * Register cleanup handlers for process exit
     * @method registerCleanupHandlers
     * @private
     */
    registerCleanupHandlers() {
        const performFullCleanup = async (exitCode = 0) => {
            try {
                log.info(`Performing full cleanup on exit (code: ${exitCode})`);
                await this.cleanup();
                log.info('Cleanup completed successfully');
            } catch (error) {
                log.error('Error during cleanup on exit:', error);
            }
        };

        // Register for app quit event
        if (app && typeof app.on === 'function') {
            app.on('will-quit', async (event) => {
                log.info('App will-quit event triggered, performing cleanup');
                event.preventDefault();
                await performFullCleanup();
                app.exit(0);
            });

            app.on('before-quit', () => {
                log.info('App before-quit event triggered');
            });
        } else {
            log.warn('Electron app object not available, cleanup handlers not registered');
        }

        // Register for process exit events
        process.on('exit', (code) => {
            log.info(`Process exit event with code ${code}`);
            // Sync operations only as process.exit is immediate
            if (this.lockRelease) {
                try {
                    log.info('Attempting to release lock synchronously');
                    // Can't await in exit handler
                } catch (error) {
                    log.error('Error releasing lock on exit:', error);
                }
            }
        });

        process.on('SIGINT', async () => {
            log.info('SIGINT received, cleaning up');
            await performFullCleanup();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            log.info('SIGTERM received, cleaning up');
            await performFullCleanup();
            process.exit(0);
        });

        process.on('uncaughtException', async (error) => {
            log.error('Uncaught exception:', error);
            await performFullCleanup();
            process.exit(1);
        });
    }

    /**
     * Register session for a provider and profile
     * @method registerSession
     * @param {string} name - Provider name
     * @param {string} profile - Profile name
     * @returns {boolean} Success
     */
    registerSession(name, profile) {
        try {
            log.info(`Registering session for ${name}:${profile}`);
            this.providerSessions.set(`${name}:${profile}`, { name, profile, timestamp: Date.now() });
            return true;
        } catch (error) {
            log.error(`Error registering session for ${name}:${profile}:`, error);
            return false;
        }
    }

    /**
     * Unregister session for a provider and profile
     * @method unregisterSession
     * @param {string} name - Provider name
     * @param {string} profile - Profile name
     * @returns {boolean} Success
     */
    unregisterSession(name, profile) {
        try {
            log.info(`Unregistering session for ${name}:${profile}`);
            this.providerSessions.delete(`${name}:${profile}`);
            return true;
        } catch (error) {
            log.error(`Error unregistering session for ${name}:${profile}:`, error);
            return false;
        }
    }
    
    /**
     * Check if this is the first instance
     * @method isFirstInstanceSync
     * @returns {boolean} True if this is the first instance
     */
    isFirstInstanceSync() {
        return this.isFirstInstance;
    }

    /**
     * Check if this is the first instance (async version)
     * @method isFirstInstanceAsync
     * @returns {Promise<boolean>} True if this is the first instance
     */
    async isFirstInstanceAsync() {
        return Promise.resolve(this.isFirstInstance);
    }

    /**
     * Get all active sessions
     * @method getSessions
     * @returns {Array} Array of session objects
     */
    getSessions() {
        return Array.from(this.providerSessions.values());
    }

    /**
     * Get session count
     * @method getSessionCount
     * @returns {number} Number of active sessions
     */
    getSessionCount() {
        return this.providerSessions.size;
    }

    /**
     * Get instance status
     * @method getStatus
     * @returns {Object} Status object
     */
    getStatus() {
        return {
            instanceId: this.instanceId,
            isFirstInstance: this.isFirstInstance,
            sessionCount: this.getSessionCount(),
            pid: process.pid,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            timestamp: Date.now()
        };
    }
}

// Export a singleton instance
module.exports = new InstanceManager();
