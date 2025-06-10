/**
 * @file Instance management service that handles application instance lifecycle,
 * locking, and PID tracking to ensure proper multi-instance behavior.
 *
 * Restored from backup with enhanced transaction management, error recovery,
 * and IPC health monitoring while preserving working functionality.
 */

const { app, ipcMain } = require('electron');
const log = require('./logging.service');
const path = require('path');
const fs = require('fs');
const os = require('os');
const lockfile = require('proper-lockfile');
const net = require('net');
const { spawn } = require('child_process');

// Import transaction utilities
const { createTransaction, createResourceLock, withTransaction } = require('../utils/transaction');

// Import error recovery utilities
const { 
    ErrorCategory, 
    RecoverableError, 
    createError, 
    safeExecute, 
    logDiagnostics, 
    recoverLockFile,
    verifyDataFileIntegrity
} = require('../utils/error-recovery');

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

        /** @property {Object} currentProfile - Current profile */
        this.currentProfile = null;
        
        /** @property {Object} lockFileLock - Resource lock for instance lock file */
        this.lockFileLock = createResourceLock('instance-lock-file');
        
        /** @property {Object} pidFileLock - Resource lock for PID file */
        this.pidFileLock = createResourceLock('instance-pid-file');
        
        /** @property {Map} activeTransactions - Map of active transactions */
        this.activeTransactions = new Map();
        
        /** @property {Object} heartbeatInterval - Heartbeat interval for health monitoring */
        this.heartbeatInterval = null;
        
        /** @property {Number} heartbeatFrequency - Frequency of heartbeat in ms */
        this.heartbeatFrequency = 30000; // 30 seconds
        
        /** @property {Map} lockHistory - History of lock operations for debugging */
        this.lockHistory = new Map();
        
        /** @property {Object} ipcServer - IPC server instance */
        this.ipcServer = null;
    }

    /**
     * Create a transaction for instance operations
     * @method createInstanceTransaction
     * @param {string} name - Transaction name
     * @param {Object} options - Transaction options
     * @returns {Object} Transaction object
     */
    createInstanceTransaction(name, options = {}) {
        try {
            const transaction = createTransaction(name, {
                timeout: options.timeout || 30000,
                retries: options.retries || 3,
                ...options
            });
            
            if (transaction) {
                this.activeTransactions.set(name, transaction);
                
                // Auto-cleanup completed transactions if promise exists
                if (transaction.promise && typeof transaction.promise.finally === 'function') {
                    transaction.promise.finally(() => {
                        this.activeTransactions.delete(name);
                    });
                } else {
                    // Fallback cleanup for non-promise transactions
                    setTimeout(() => {
                        this.activeTransactions.delete(name);
                    }, options.timeout || 30000);
                }
                
                return transaction;
            } else {
                log.warn(`Failed to create transaction: ${name}`);
                return null;
            }
        } catch (error) {
            log.error(`Error creating transaction ${name}:`, error);
            return null;
        }
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
        const transaction = this.createInstanceTransaction('initialization', {
            timeout: 30000,
            retries: 2
        });
        
        return withTransaction(transaction, async () => {
            log.info('Initializing instance manager with enhanced features...');
            
            // Generate unique instance ID
            this.instanceId = `instance-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            log.info(`Instance ID: ${this.instanceId}`);
            
            // Verify and recover data file integrity
            await safeExecute(async () => {
                await verifyDataFileIntegrity(this.getPidFilePath());
                await verifyDataFileIntegrity(this.getLockFilePath());
            }, {
                context: 'Data file integrity check',
                fallback: () => log.warn('Data file integrity check failed, continuing with caution')
            });
            
            // Register cleanup handlers first
            this.registerCleanupHandlers();
            
            // Setup IPC server with enhanced error handling
            await this.setupIpcServer();
            
            // Record initialization in lock history
            this.lockHistory.set(`init-${Date.now()}`, {
                action: 'initialize',
                timestamp: Date.now(),
                instanceId: this.instanceId,
                pid: process.pid,
                success: true
            });
            
            log.info('Instance manager initialization completed successfully');
            return Promise.resolve();
        });
    }
    
    /**
     * Setup IPC server for inter-process communication
     * @method setupIpcServer
     * @private
     */
    setupIpcServer() {
        return safeExecute(async () => {
            // Create server with enhanced error handling
            const server = net.createServer((socket) => {
                log.debug('Client connected to IPC server');
                
                socket.on('data', (data) => {
                    safeExecute(() => {
                        const message = JSON.parse(data.toString());
                        log.debug('Received IPC message:', message);
                        
                        // Handle ping command
                        if (message.command === 'ping') {
                            const response = {
                                status: 'ok',
                                timestamp: Date.now(),
                                instanceId: this.instanceId,
                                sessionCount: this.getSessionCount()
                            };
                            this.sendIpcResponse(socket, response);
                        }
                        
                        // Handle status command
                        if (message.command === 'status') {
                            const response = this.getStatus();
                            this.sendIpcResponse(socket, response);
                        }
                    }, {
                        context: 'IPC message handling',
                        fallback: () => {
                            const errorResponse = {
                                status: 'error',
                                message: 'Failed to process message',
                                timestamp: Date.now()
                            };
                            this.sendIpcResponse(socket, errorResponse);
                        }
                    });
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
                // Attempt recovery
                if (error.code === 'EADDRINUSE') {
                    log.warn('IPC pipe address in use, attempting recovery');
                    setTimeout(() => this.setupIpcServer(), 1000);
                }
            });
            
            // Listen on named pipe with enhanced error handling
            return new Promise((resolve, reject) => {
                server.listen(this.ipcPipeName, () => {
                    log.info(`IPC server listening on ${this.ipcPipeName}`);
                    this.ipcServer = server;
                    this.startHeartbeat(); // Start health monitoring
                    resolve();
                });
                
                server.on('error', reject);
            });
        }, {
            context: 'IPC server setup',
            fallback: () => {
                log.warn('IPC server setup failed, continuing without IPC');
            }
        });
    }
    
    /**
     * Send IPC response safely
     * @method sendIpcResponse
     * @param {Object} socket - Socket connection
     * @param {Object} response - Response data
     * @private
     */
    sendIpcResponse(socket, response) {
        safeExecute(() => {
            if (socket && !socket.destroyed) {
                socket.write(JSON.stringify(response));
            }
        }, {
            context: 'IPC response sending',
            fallback: () => log.warn('Failed to send IPC response')
        });
    }

    /**
     * Clean up instance resources
     * @method cleanup
     * @private
     * @returns {Promise<void>}
     */
    async cleanup() {
        const transaction = this.createInstanceTransaction('cleanup', {
            timeout: 10000,
            retries: 1
        });
        
        return withTransaction(transaction, async () => {
            log.info('Cleaning up instance resources...');
            
            // Stop heartbeat monitoring
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
                this.heartbeatInterval = null;
                log.debug('Heartbeat monitoring stopped');
            }
            
            // Close IPC server
            if (this.ipcServer) {
                await safeExecute(async () => {
                    return new Promise((resolve) => {
                        this.ipcServer.close(() => {
                            log.info('IPC server closed successfully');
                            resolve();
                        });
                        // Force close after timeout
                        setTimeout(resolve, 2000);
                    });
                }, {
                    context: 'IPC server cleanup',
                    fallback: () => log.warn('IPC server cleanup timeout')
                });
                this.ipcServer = null;
            }
            
            // Release lock with resource protection
            if (this.lockRelease) {
                await safeExecute(async () => {
                    await this.lockFileLock.acquire();
                    try {
                        await this.lockRelease();
                        this.lockRelease = null;
                        log.info('Instance lock released successfully');
                        
                        // Record lock history
                        this.lockHistory.set(`release-${Date.now()}`, {
                            action: 'release',
                            timestamp: Date.now(),
                            pid: process.pid,
                            success: true
                        });
                    } finally {
                        this.lockFileLock.release();
                    }
                }, {
                    context: 'Lock release',
                    fallback: () => log.warn('Failed to release instance lock properly')
                });
            }
            
            // Clear all active transactions
            for (const [name, transaction] of this.activeTransactions) {
                try {
                    transaction.cancel();
                    log.debug(`Cancelled active transaction: ${name}`);
                } catch (error) {
                    log.warn(`Error cancelling transaction ${name}:`, error);
                }
            }
            this.activeTransactions.clear();
            
            // Clear all sessions
            this.providerSessions.clear();
            
            log.info('Instance cleanup completed successfully');
            return Promise.resolve();
        });
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
