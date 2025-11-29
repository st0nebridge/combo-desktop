/**
 * @module services/instance.manager
 * @description Instance management service that handles application instance lifecycle,
 * locking, and PID tracking to ensure proper multi-instance behavior.
 * 
 * @input {Array<Object>} sessions - Session configurations to process
 * @input {boolean} forceNewInstance - Whether to force creation of new instance
 * @input {boolean} oneInstance - Whether to restrict to one instance per provider
 * @input {boolean} profileIsolation - Whether to isolate sessions by profile
 * @output {Object} result - Instance registration and session processing results
 * 
 * @dependencies
 * - utils/transaction - Transaction management for atomic operations
 * - utils/error-recovery - Error handling and recovery utilities
 * - services/logging.service - Application logging
 * 
 * @emits last-session-closed - When the last active session is closed
 * @emits session-registered - When a new session is successfully registered
 * @emits session-unregistered - When a session is unregistered
 * 
 * @example
 * const instanceManager = require('./services/instance.manager');
 * await instanceManager.initialize();
 * await instanceManager.registerSession('whatsapp', 'default', provider);
 */

const { app } = require('electron');
const { EventEmitter } = require('events');
const log = require('./logging.service');
const path = require('path');
const os = require('os');
const net = require('net');

// Import transaction utilities
const { createTransaction, createResourceLock, withTransaction } = require('../utils/transaction');

// Import error recovery utilities
const { 
    ErrorCategory, 
    createError, 
    safeExecute, 
    logDiagnostics, 
    verifyDataFileIntegrity
} = require('../utils/error-recovery');

/**
 * Service for managing application instances.
 * Handles instance lifecycle, locking, and process management.
 * @class InstanceManager
 */
class InstanceManager extends EventEmitter {
    /**
     * Creates a new InstanceManager instance
     * @constructor
     */
    constructor() {
        super(); // Call EventEmitter constructor
        
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
        const userDataPath = app && typeof app.getPath === 'function'
            ? app.getPath('userData')
            : path.join(os.tmpdir(), 'desk-tray');
        if (!app || typeof app.getPath !== 'function') {
            log.warn(`Could not get userData path, using temporary path: ${userDataPath}`);
        }
        this.instanceLockFile = path.join(userDataPath, 'instance.lock');
        
        /** @property {string} pidFile - Path to PID tracking file */
        const pidPath = app && typeof app.getPath === 'function' ? 
            path.join(app.getPath('userData'), 'pids.json') : 
            path.join(os.tmpdir(), 'desk-tray', 'pids.json');
        if (!app || typeof app.getPath !== 'function') {
            log.warn(`Could not determine PID file path, using temporary path: ${pidPath}`);
        }
        this.pidFile = pidPath;
        
        /** @property {string} ipcPipeName - Name of the IPC pipe */
        let appName = 'desk-tray';
        try {
            const packageJson = require('../../package.json');
            appName = packageJson.name || appName;
        } catch (error) {
            log.warn('Could not load package.json for IPC pipe name, using default', error);
        }
        // Use consistent pipe name format across Windows
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
        
        /** @property {boolean} _initialized - Flag to prevent duplicate initialization */
        this._initialized = false;
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
        // Make this method idempotent - only initialize once per process
        if (this._initialized) {
            log.debug('Instance manager already initialized, skipping');
            return Promise.resolve();
        }
        
        const transaction = this.createInstanceTransaction('initialization', {
            timeout: 30000,
            retries: 2
        });
        
        return withTransaction(transaction, async () => {
            log.info('Initializing instance manager with enhanced features...');
            
            // Generate unique instance ID only if not already set
            if (!this.instanceId) {
                this.instanceId = `instance-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
                log.info(`Instance ID: ${this.instanceId}`);
            }
            
            // Verify and recover data file integrity
            // verifyDataFileIntegrity(filePath, validationFn, fallbackFn)
            await safeExecute(async () => {
                // Validation: check if data is a valid object
                const isValidObject = (data) => data !== null && typeof data === 'object';
                // Fallback: return empty object
                const emptyObjectFallback = () => ({});
                
                await verifyDataFileIntegrity(this.getPidFilePath(), isValidObject, emptyObjectFallback);
                await verifyDataFileIntegrity(this.getLockFilePath(), isValidObject, emptyObjectFallback);
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
            
            // Mark as initialized to prevent duplicate initialization
            this._initialized = true;
            
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
                    safeExecute(async () => {
                        const message = JSON.parse(data.toString());
                        log.info('Received IPC message:', JSON.stringify(message));
                        log.info(`IPC message check - targetPid: ${message.targetPid}, our PID: ${process.pid}, match: ${message.targetPid?.toString() === process.pid.toString()}`);
                        
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
                        
                        // Handle delegation commands
                        if (message.type === 'delegate-command' && 
                            message.targetPid?.toString() === process.pid.toString()) {
                            
                            log.info(`Handling delegated command:`, message.args);
                            
                            // Process the command
                            let success = false;
                            let error = null;
                            let result = null;
                            
                            try {
                                // Execute the command using the app manager
                                const appManager = require('./app.manager');
                                
                                // Parse command line arguments into session objects
                                const sessions = [];
                                let globalTempFlag = false;
                                
                                // First pass: check for global --temp flag
                                if (message.args.includes('--temp')) {
                                    globalTempFlag = true;
                                    log.info('Temp flag detected in delegation command');
                                }
                                
                                let i = 0;
                                while (i < message.args.length) {
                                    const arg = message.args[i];
                                    if (arg.startsWith('--') && arg !== '--profile' && arg !== '--temp') {
                                        const commandArg = arg.substring(2); // Remove --
                                        let profile = 'default';
                                        
                                        // Check if next arg is --profile
                                        if (i + 1 < message.args.length && message.args[i + 1] === '--profile') {
                                            i += 2; // Skip --profile
                                            if (i < message.args.length) {
                                                profile = message.args[i];
                                            }
                                        }
                                        
                                        // Convert command arg to provider name for consistency
                                        const providerRegistry = require('../providers');
                                        const availableProviders = providerRegistry.getAvailableProviders();
                                        const providerInfo = availableProviders.find(p => 
                                            p.commandArg.replace(/^--/, '') === commandArg);
                                        
                                        if (providerInfo) {
                                            const providerName = providerInfo.name; // Use the actual provider name
                                            
                                            // Check if session already exists to avoid duplicates
                                            const sessionKey = `${providerName}:${profile}`;
                                            if (this.providerSessions.has(sessionKey)) {
                                                log.info(`Session ${sessionKey} already exists, skipping delegation`);
                                            } else {
                                                sessions.push({ 
                                                    provider: providerName,  // Use provider name, not command arg
                                                    profile,
                                                    isTemp: globalTempFlag  // Pass temp flag to delegated session
                                                });
                                                log.info(`Session ${sessionKey} will be created via delegation${globalTempFlag ? ' (temp mode)' : ''}`);
                                            }
                                        } else {
                                            log.warn(`Provider not found for command arg: ${commandArg}`);
                                        }
                                    }
                                    i++;
                                }
                                
                                if (sessions.length > 0) {
                                    // Initialize sessions using app manager
                                    log.info(`Initializing ${sessions.length} new sessions via delegation`);
                                    result = await appManager.initializeSessions(sessions, {
                                        profileIsolation: true
                                    });
                                    success = result && Array.isArray(result) && result.length > 0;
                                } else {
                                    success = true;
                                    result = 'No new sessions to initialize (all sessions already exist)';
                                    log.info('Delegation command handled - no new sessions needed');
                                }
                                
                                if (!success) {
                                    error = 'Command execution failed';
                                    log.error('Command execution failed:', result);
                                } else {
                                    log.info('Command executed successfully:', result);
                                }
                            } catch (err) {
                                success = false;
                                error = err.message;
                                log.error('Error processing command:', err);
                            }
                            
                            // Send response
                            this.sendIpcResponse(socket, {
                                type: 'delegate-response',
                                requestId: message.requestId,
                                success,
                                error,
                                pid: process.pid,
                                result: success ? 'Command executed successfully' : error,
                                timestamp: Date.now()
                            });
                        }
                        
                        // Handle ping messages (for health checks)
                        if (message.type === 'ping') {
                            this.sendIpcResponse(socket, {
                                type: 'pong',
                                requestId: message.requestId,
                                pid: process.pid,
                                timestamp: Date.now()
                            });
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
            
            // Listen on named pipe with enhanced error handling
            return new Promise((resolve, reject) => {
                // Track retry attempts to prevent infinite loops
                this._ipcServerRetryCount = (this._ipcServerRetryCount || 0);
                const maxRetries = 3;
                
                server.listen(this.ipcPipeName, () => {
                    log.info(`IPC server listening on ${this.ipcPipeName}`);
                    this.ipcServer = server;
                    this._ipcServerRetryCount = 0; // Reset retry count on success
                    this.startHeartbeat(); // Start health monitoring
                    resolve();
                });
                
                server.on('error', (error) => {
                    log.error('IPC server error:', error);
                    
                    // Handle address in use error with retry limit
                    if (error.code === 'EADDRINUSE' && this._ipcServerRetryCount < maxRetries) {
                        this._ipcServerRetryCount++;
                        log.warn(`IPC pipe address in use, attempting recovery (attempt ${this._ipcServerRetryCount}/${maxRetries})`);
                        
                        // Use exponential backoff for retries
                        const retryDelay = 1000 * Math.pow(2, this._ipcServerRetryCount - 1);
                        setTimeout(() => {
                            if (this._ipcServerRetryCount <= maxRetries) {
                                this.setupIpcServer().catch(retryError => {
                                    log.error('IPC server retry failed:', retryError);
                                });
                            }
                        }, retryDelay);
                        
                        // Don't reject immediately, let the retry handle it
                        return;
                    }
                    
                    // For other errors or max retries exceeded, reject
                    if (this._ipcServerRetryCount >= maxRetries) {
                        log.error(`Max IPC server retry attempts (${maxRetries}) exceeded, giving up`);
                        this._ipcServerRetryCount = 0;
                    }
                    reject(error);
                });
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
            // Validate that connection is still writable
            if (socket && !socket.destroyed && socket.writable) {
                const responseJson = JSON.stringify(response);
                socket.write(responseJson);
            } else {
                log.warn('Attempted to send response on closed/unwritable connection');
            }
        }, {
            context: 'IPC response sending',
            fallback: () => log.warn('Failed to send IPC response due to connection error')
        });
    }

    /**
     * Get session count for this instance
     * @method getSessionCount
     * @returns {number} Number of sessions
     */
    getSessionCount() {
        return this.providerSessions ? this.providerSessions.size : 0;
    }

    /**
     * Get status information for this instance
     * @method getStatus
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            status: 'ok',
            instanceId: this.instanceId,
            profile: this.currentProfile,
            pid: process.pid,
            sessionCount: this.getSessionCount(),
            startTime: this.startTime || new Date().toISOString(),
            timestamp: Date.now()
        };
    }

    /**
     * Read the lock file with error recovery
     * @method readLockFile
     * @private
     * @returns {Promise<Object>} Lock file data
     */
    async readLockFile() {
        const lockPath = this.instanceLockFile;
        
        return safeExecute(async () => {
            const fs = require('fs').promises;
            
            try {
                const data = await fs.readFile(lockPath, 'utf8');
                const parsedData = JSON.parse(data);
                
                // Validate structure
                if (!parsedData || typeof parsedData !== 'object') {
                    log.warn('Lock file has invalid structure');
                    return { instances: {} };
                }
                
                if (!parsedData.instances || typeof parsedData.instances !== 'object') {
                    log.warn('Lock file missing instances property, auto-repairing');
                    parsedData.instances = {};
                }
                
                return parsedData;
            } catch (error) {
                if (error.code === 'ENOENT') {
                    // Lock file doesn't exist, return empty data
                    log.debug('Lock file does not exist, returning empty data');
                    return { instances: {} };
                } else if (error instanceof SyntaxError) {
                    // JSON parse error, try to recover
                    log.warn('Lock file contains invalid JSON, attempting recovery');
                    try {
                        await this.recoverLockFile(lockPath);
                        const recoveredData = await fs.readFile(lockPath, 'utf8');
                        return JSON.parse(recoveredData);
                    } catch (recoveryError) {
                        log.error('Lock file recovery failed:', recoveryError);
                        return { instances: {} };
                    }
                } else {
                    throw error;
                }
            }
        }, {
            category: ErrorCategory.FILE_ERROR,
            context: { lockPath },
            fallback: () => ({ instances: {} })
        });
    }

    /**
     * Write to the lock file with atomic operations
     * @method writeLockFile
     * @private
     * @param {Object} lockData - Data to write to lock file
     * @returns {Promise<boolean>} Success status
     */
    async writeLockFile(lockData) {
        return safeExecute(async () => {
            const fs = require('fs').promises;
            const path = require('path');
            const crypto = require('crypto');
            
            const lockFilePath = this.instanceLockFile;
            const tempFilePath = `${lockFilePath}.tmp.${process.pid}.${Date.now()}`;
            
            // Validate lock data
            if (!lockData || typeof lockData !== 'object') {
                throw createError('Invalid lock data format', {
                    category: ErrorCategory.DATA_ERROR,
                    context: { dataType: typeof lockData }
                });
            }
            
            if (!lockData.instances || typeof lockData.instances !== 'object') {
                log.warn('Lock data missing instances property, auto-repairing');
                lockData.instances = {};
            }
            
            // Add metadata for integrity
            const dataWithMetadata = {
                ...lockData,
                _meta: {
                    timestamp: new Date().toISOString(),
                    pid: process.pid,
                    instanceId: this.instanceId,
                    hostname: require('os').hostname(),
                    version: '2.0'
                }
            };
            
            const dataString = JSON.stringify(dataWithMetadata, null, 2);
            
            try {
                // Write to temp file first
                await fs.writeFile(tempFilePath, dataString, 'utf8');
                
                // Verify temp file was written correctly
                const tempData = await fs.readFile(tempFilePath, 'utf8');
                JSON.parse(tempData); // Throws if invalid JSON
                
                // Atomically rename to target file
                await fs.rename(tempFilePath, lockFilePath);
                
                log.debug('Lock file written successfully');
                return true;
            } catch (writeError) {
                // Clean up temp file if it exists
                try {
                    await fs.unlink(tempFilePath);
                } catch (cleanupError) {
                    // Ignore cleanup errors
                }
                throw writeError;
            }
        }, {
            category: ErrorCategory.FILE_ERROR,
            context: { instanceId: this.instanceId, pid: process.pid },
            fallback: () => {
                log.error('Failed to write lock file');
                return false;
            }
        });
    }

    /**
     * Recover a corrupted lock file
     * @method recoverLockFile
     * @private
     * @param {string} lockFilePath - Path to the lock file
     * @returns {Promise<boolean>} Whether recovery was successful
     */
    async recoverLockFile(lockFilePath) {
        try {
            log.info(`Attempting to recover lock file: ${lockFilePath}`);
            
            const fs = require('fs').promises;
            
            // Check if file exists first
            try {
                await fs.access(lockFilePath);
            } catch (accessError) {
                log.warn('Lock file does not exist, creating new one');
                await fs.writeFile(lockFilePath, JSON.stringify({ instances: {} }, null, 2));
                return true;
            }
            
            // Create a backup
            const backupPath = `${lockFilePath}.corrupt.bak`;
            const content = await fs.readFile(lockFilePath, 'utf8');
            await fs.writeFile(backupPath, content);
            
            // Write a valid empty structure
            const emptyData = {
                instances: {},
                recovered: true,
                recoveryTimestamp: new Date().toISOString()
            };
            
            await fs.writeFile(lockFilePath, JSON.stringify(emptyData, null, 2));
            log.info(`Lock file recovery successful: ${lockFilePath}`);
            return true;
        } catch (recoveryError) {
            log.error('Lock file recovery failed:', recoveryError);
            return false;
        }
    }

    /**
     * Start health monitoring heartbeat
     * @method startHeartbeat
     * @private
     */
    startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        this.heartbeatInterval = setInterval(async () => {
            await this.checkIpcServerHealth();
        }, this.heartbeatFrequency);
        
        log.debug(`Started heartbeat monitoring every ${this.heartbeatFrequency}ms`);
    }
    
    /**
     * Check IPC server health
     * @method checkIpcServerHealth
     * @private
     * @returns {Promise<boolean>} Health status
     */
    async checkIpcServerHealth() {
        return safeExecute(async () => {
            if (!this.ipcServer || !this.ipcServer.listening) {
                log.warn('IPC server is not listening');
                return false;
            }
            
            // Test connection to self
            try {
                const result = await this.pingInstanceViaPipe(this.ipcPipeName);
                if (result.success) {
                    log.debug('IPC server health check passed');
                    return true;
                } else {
                    log.warn('IPC server health check failed:', result.error);
                    return false;
                }
            } catch (error) {
                log.warn('IPC server health check error:', error);
                return false;
            }
        }, {
            context: 'IPC health check',
            fallback: () => false
        });
    }
    
    /**
     * Ping an instance via named pipe
     * @method pingInstanceViaPipe
     * @param {string} pipeName - Name of the pipe to ping
     * @returns {Promise<Object>} Ping result
     */
    async pingInstanceViaPipe(pipeName) {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({ success: false, error: 'timeout' });
            }, 5000);
            
            const client = net.createConnection(pipeName);
            
            client.on('connect', () => {
                const message = JSON.stringify({ command: 'ping', timestamp: Date.now() });
                client.write(message);
            });
            
            client.on('data', (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    clearTimeout(timeout);
                    client.end();
                    resolve({ success: true, response });
                } catch (error) {
                    clearTimeout(timeout);
                    client.end();
                    resolve({ success: false, error: error.message });
                }
            });
            
            client.on('error', (error) => {
                clearTimeout(timeout);
                resolve({ success: false, error: error.message });
            });
        });
    }

    /**
     * Early lightweight registration to enable delegation checks
     * @method earlyRegister
     * @param {string} profile - Profile name
     * @returns {Promise<void>}
     */
    async earlyRegister(profile) {
        try {
            // Validate profile name
            if (!profile || typeof profile !== 'string') {
                throw createError('Invalid profile name for early registration', {
                    category: ErrorCategory.INSTANCE_ERROR,
                    context: { profile }
                });
            }
            
            // Set current profile
            this.currentProfile = profile;
            
            // Generate unique instance ID if not already set
            if (!this.instanceId) {
                this.instanceId = `instance-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            }
            
            log.info(`Early registration for delegation checks: ${this.instanceId}, profile: ${profile}`);
            
            // Do minimal initialization if needed
            if (!this._initialized) {
                await this.initialize();
            }
            
            // Register this instance in the lock file for delegation detection
            await this.registerInstanceInLockFile(profile);
            
            // Set first instance flag by checking lock file state
            const lockData = await this.readLockFile();
            const instanceCount = Object.keys(lockData.instances || {}).length;
            this.isFirstInstance = instanceCount <= 1; // We just added ourselves
            
            log.info(`Early registration completed: ${this.instanceId}, isFirst: ${this.isFirstInstance}`);
            
        } catch (error) {
            log.error('Error in early registration:', error);
            throw createError('Early registration failed', {
                category: ErrorCategory.INSTANCE_ERROR,
                cause: error,
                context: { profile }
            });
        }
    }

    /**
     * Initialize the instance with enhanced profile isolation
     * @method init
     * @param {Object} options - Initialization options
     * @param {string} options.profile - Profile name
     * @param {boolean} options.profileIsolation - Whether to isolate instances by profile
     * @returns {Promise<void>}
     */
    async init({ profile, profileIsolation = true }) {
        const transaction = this.createInstanceTransaction('init', {
            timeout: 30000,
            retries: 2
        });
        
        try {
            return await withTransaction(transaction, async () => {
                // Validate profile name
                if (!profile || typeof profile !== 'string') {
                    throw createError('Invalid profile name', {
                        category: ErrorCategory.INSTANCE_ERROR,
                        context: { profile }
                    });
                }
                
                // Sanitize profile name for use in filenames
                const sanitizedProfile = profile.replace(/[^a-zA-Z0-9_-]/g, '_');
                
                // Set current profile
                this.currentProfile = profile;
                log.info(`Initializing instance with profile: ${profile}, profileIsolation: ${profileIsolation}`);
                
                // Generate unique instance ID if not already set
                if (!this.instanceId) {
                    this.instanceId = `instance-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
                }
                
                // Initialize IPC server and other resources only if not already done
                if (!this._initialized) {
                    await this.initialize();
                }
                
                // Register this instance in the lock file (skip if already done in earlyRegister)
                const lockData = await this.readLockFile();
                if (!lockData.instances || !lockData.instances[this.instanceId]) {
                    await this.registerInstanceInLockFile(profile);
                }
                
                // Determine if this is the first instance by checking lock file
                const instanceCount = Object.keys(lockData.instances || {}).length;
                this.isFirstInstance = instanceCount <= 1;
                
                // Record initialization in lock history
                this.lockHistory.set(`init-${Date.now()}`, {
                    action: 'init',
                    timestamp: Date.now(),
                    instanceId: this.instanceId,
                    profile: profile,
                    profileIsolation: profileIsolation,
                    pid: process.pid,
                    success: true
                });
                
                log.info(`Instance initialized successfully: ${this.instanceId}, profile: ${this.currentProfile}, isFirst: ${this.isFirstInstance}`);
                return Promise.resolve();
            });
        } catch (error) {
            logDiagnostics('instance-init-failed', { error, profile, profileIsolation });
            throw createError('Instance initialization failed', {
                category: ErrorCategory.INSTANCE_ERROR,
                cause: error,
                context: { profile, profileIsolation }
            });
        }
    }
    
    /**
     * Ensure required directories exist for instance management
     * @method ensureDirectories
     * @returns {Promise<void>}
     * @throws {Error} If directory creation fails
     */
    async ensureDirectories() {
        return await safeExecute(async () => {
            try {
                // Get user data directory
                const userDataDir = app && typeof app.getPath === 'function' ? 
                    app.getPath('userData') : 
                    path.join(require('os').tmpdir(), 'desk-tray');

                // Create user data directory if it doesn't exist
                await require('fs').promises.mkdir(userDataDir, { recursive: true });

                // Create instance lock file if it doesn't exist
                if (!require('fs').existsSync(this.instanceLockFile)) {
                    await require('fs').promises.writeFile(this.instanceLockFile, JSON.stringify({ instances: {} }, null, 2));
                }

                // Create PID file if it doesn't exist
                if (!require('fs').existsSync(this.pidFile)) {
                    await require('fs').promises.writeFile(this.pidFile, JSON.stringify([], null, 2));
                }

                log.info('Instance management directories initialized');
            } catch (error) {
                log.error('Error creating directories:', error);
                throw error;
            }
        }, {
            errorMessage: 'Failed to ensure instance directories exist',
            category: ErrorCategory.INSTANCE_ERROR,
            context: { instanceLockFile: this.instanceLockFile, pidFile: this.pidFile }
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
                    if (transaction && typeof transaction.cancel === 'function') {
                        transaction.cancel();
                        log.debug(`Cancelled active transaction: ${name}`);
                    } else {
                        log.debug(`Transaction ${name} doesn't support cancellation, removing from active list`);
                    }
                } catch (error) {
                    log.warn(`Error cancelling transaction ${name}:`, error);
                }
            }
            this.activeTransactions.clear();
            
            // Unregister this instance from the lock file
            await this.unregisterInstanceFromLockFile();
            
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
     * @returns {Promise<boolean>} Success
     */
    async unregisterSession(name, profile) {
        try {
            const sessionKey = `${name}:${profile}`;
            log.info(`Unregistering session for ${sessionKey}`);
            
            // Remove the session
            const sessionRemoved = this.providerSessions.delete(sessionKey);
            
            if (sessionRemoved) {
                // Close the associated window - need to use proper window name format
                // Session uses lowercase (e.g., "whatsapp:default") but window uses capitalized (e.g., "WhatsApp:default")
                const windowService = require('./window.service');
                
                // Try to find the window by looking through all windows for a matching profile
                // Since we can't easily convert from session name to display name, search by provider instance
                let windowFound = false;
                for (const [windowName, window] of windowService.windows.entries()) {
                    if (window.metadata && window.metadata.provider) {
                        const provider = window.metadata.provider;
                        const sessionName = provider.getSessionName ? provider.getSessionName() : provider.getCommandArg().replace(/^--/, '');
                        if (sessionName === name && window.metadata.profile === profile) {
                            if (!window.isDestroyed()) {
                                log.info(`Force closing window for ${windowName}`);
                                window.forceClose = true; // Ensure window actually closes instead of hiding
                                window.close();
                            }
                            windowFound = true;
                            break;
                        }
                    }
                }
                
                if (!windowFound) {
                    // Fallback: try direct window name resolution with both formats
                    const possibleNames = [
                        `${name}:${profile}`,           // lowercase format
                        `${name.charAt(0).toUpperCase() + name.slice(1)}:${profile}` // capitalized format
                    ];
                    
                    for (const windowName of possibleNames) {
                        const { window } = windowService.resolveWindow(windowName);
                        if (window && !window.isDestroyed()) {
                            log.info(`Force closing window for ${windowName}`);
                            window.forceClose = true; // Ensure window actually closes instead of hiding
                            window.close();
                            windowFound = true;
                            break;
                        }
                    }
                }
                
                if (!windowFound) {
                    log.warn(`Could not find window to close for session ${sessionKey}`);
                }
                
                // Destroy the associated tray - use enhanced fallback logic
                const trayService = require('./tray.service');
                const providerRegistry = require('../providers/provider.registry');
                
                // Get all possible tray name formats
                const possibleTrayNames = [];
                
                // Try to get the actual provider display name from registry
                try {
                    const provider = providerRegistry.getProvider(name);
                    if (provider && provider.getName) {
                        possibleTrayNames.push(`${provider.getName()}:${profile}`); // Provider display name format
                    }
                } catch (error) {
                    log.debug(`Could not get provider display name for ${name}`);
                }
                
                // Add common known mappings for case sensitivity
                const knownMappings = {
                    'whatsapp': 'WhatsApp',
                    'facebook': 'Facebook'
                };
                
                if (knownMappings[name]) {
                    possibleTrayNames.push(`${knownMappings[name]}:${profile}`);
                }
                
                // Add fallback formats
                possibleTrayNames.push(
                    `${name}:${profile}`,           // lowercase format (whatsapp:default)
                    `${name.charAt(0).toUpperCase() + name.slice(1)}:${profile}`, // simple capitalized (Whatsapp:default)
                    `${name.toUpperCase()}:${profile}` // all uppercase format
                );
                
                // Remove duplicates
                const uniqueTrayNames = [...new Set(possibleTrayNames)];
                
                let trayDestroyed = false;
                for (const trayName of uniqueTrayNames) {
                    try {
                        const trayInfo = trayService.trays.get(trayName);
                        if (trayInfo) {
                            const destroyed = await trayService.destroyTray(trayName);
                            if (destroyed) {
                                log.info(`Successfully destroyed tray for ${trayName}`);
                                trayDestroyed = true;
                                break;
                            }
                        } else {
                            log.debug(`No tray found for name: ${trayName}`);
                        }
                    } catch (error) {
                        // Continue to next name format
                        log.debug(`Failed to destroy tray ${trayName}:`, error);
                    }
                }
                
                if (!trayDestroyed) {
                    log.warn(`Could not find any tray to destroy for session ${sessionKey}. Available trays: ${[...trayService.trays.keys()].join(', ')}`);
                }
                
                log.info(`Session ${sessionKey} unregistered successfully`);
                
                // Check if this was the last session
                if (this.providerSessions.size === 0) {
                    log.info('All sessions closed, triggering application cleanup');
                    // Emit event or trigger cleanup
                    this.emit('last-session-closed');
                }
                
                return true;
            } else {
                log.warn(`Session ${sessionKey} was not found for unregistration`);
                return false;
            }
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

    /**
     * Get all running instances from lock file
     * @method getInstances
     * @returns {Promise<Array>} Array of running instances
     */
    async getInstances() {
        try {
            const lockData = await this.readLockFile();
            const instances = Object.entries(lockData.instances || {}).map(([id, instance]) => ({
                id,
                pid: instance.pid,
                profile: instance.profile,
                startTime: instance.startTime,
                pipeName: instance.pipeName,
                sessions: instance.sessions || []
            }));
            
            // Filter out dead instances and track which ones to clean up
            const liveInstances = [];
            const deadInstanceIds = [];
            
            for (const instance of instances) {
                try {
                    // Check if process is still running
                    process.kill(instance.pid, 0);
                    
                    // Additional validation: check if it's actually our application
                    const isOurProcess = await this.validateProcessIsOurs(instance.pid);
                    if (isOurProcess) {
                        liveInstances.push(instance);
                    } else {
                        log.debug(`Instance ${instance.id} with PID ${instance.pid} is not our process (PID reused)`);
                        deadInstanceIds.push(instance.id);
                    }
                } catch (error) {
                    log.debug(`Instance ${instance.id} with PID ${instance.pid} is no longer running`);
                    deadInstanceIds.push(instance.id);
                }
            }
            
            // Clean up dead instances from lock file if any found
            if (deadInstanceIds.length > 0) {
                await this.cleanupDeadInstances(deadInstanceIds);
                log.info(`Cleaned up ${deadInstanceIds.length} dead instances from lock file`);
            }
            
            log.debug(`Found ${liveInstances.length} live instances`);
            return liveInstances;
        } catch (error) {
            log.error('Error getting instances:', error);
            return [];
        }
    }

    /**
     * Create a new instance
     * @method createNewInstance
     * @returns {Promise<Object>} Result object with success and instanceId
     */
    async createNewInstance() {
        try {
            log.info('Creating new instance via CLI request');
            
            // For CLI purposes, we'll spawn a new process
            const { spawn } = require('child_process');
            const path = require('path');
            
            const mainPath = path.join(__dirname, '../main.js');
            const child = spawn(process.execPath, [mainPath, '--new-instance'], {
                detached: true,
                stdio: 'ignore'
            });
            
            child.unref();
            
            const newInstanceId = `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            log.info(`New instance process spawned with PID: ${child.pid}`);
            
            return {
                success: true,
                instanceId: newInstanceId,
                pid: child.pid
            };
        } catch (error) {
            log.error('Error creating new instance:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Kill a specific instance by ID
     * @method killInstance
     * @param {string} instanceId - Instance ID to kill
     * @returns {Promise<boolean>} True if instance was killed successfully
     */
    async killInstance(instanceId) {
        try {
            log.info(`Attempting to kill instance: ${instanceId}`);
            
            // If trying to kill current instance, perform cleanup
            if (instanceId === this.instanceId) {
                log.info('Killing current instance');
                await this.cleanup();
                process.exit(0);
                return true;
            }
            
            // For other instances, this would require IPC communication
            // or PID tracking - simplified implementation
            log.warn(`Cannot kill external instance ${instanceId} - feature not fully implemented`);
            return false;
        } catch (error) {
            log.error(`Error killing instance ${instanceId}:`, error);
            return false;
        }
    }

    /**
     * Reset instance lock (emergency use only)
     * @method resetLock
     * @returns {Promise<boolean>} True if lock was reset successfully
     */
    async resetLock() {
        try {
            log.warn('Resetting instance lock (emergency operation)');
            
            const fs = require('fs').promises;
            const lockFilePath = this.getLockFilePath();
            
            return await safeExecute(async () => {
                await this.lockFileLock.acquire();
                try {
                    // Check if lock file exists
                    try {
                        await fs.access(lockFilePath);
                        await fs.unlink(lockFilePath);
                        log.info('Lock file removed successfully');
                    } catch (error) {
                        if (error.code === 'ENOENT') {
                            log.info('Lock file does not exist, nothing to reset');
                        } else {
                            throw error;
                        }
                    }
                    
                    // Reset internal lock state
                    if (this.lockRelease) {
                        try {
                            await this.lockRelease();
                        } catch (error) {
                            log.warn('Error releasing existing lock:', error);
                        }
                        this.lockRelease = null;
                    }
                    
                    // Record lock history
                    this.lockHistory.set(`reset-${Date.now()}`, {
                        action: 'reset',
                        timestamp: Date.now(),
                        pid: process.pid,
                        success: true
                    });
                    
                    log.info('Instance lock reset completed successfully');
                    return true;
                } finally {
                    this.lockFileLock.release();
                }
            }, {
                context: 'Reset instance lock',
                fallback: () => {
                    log.error('Failed to reset instance lock with fallback');
                    return false;
                }
            });
        } catch (error) {
            log.error('Error resetting instance lock:', error);
            return false;
        }
    }

    /**
     * Process sessions with multi-instance architecture support
     * @method processSessions
     * @param {Array} sessions - Sessions to process
     * @param {boolean} forceNewInstance - Force creation of new instance
     * @param {boolean} oneInstance - Use single instance for all sessions
     * @param {boolean} profileIsolation - Whether to isolate by profile
     * @returns {Promise<Object>} Processing result with localSessions and delegatedSessions
     */
    async processSessions(sessions, forceNewInstance = false, oneInstance = false, profileIsolation = true) {
        try {
            log.info('Processing sessions with multi-instance architecture', { 
                sessionCount: sessions?.length || 0,
                forceNewInstance,
                oneInstance,
                profileIsolation
            });
            
            const result = {
                localSessions: [],
                delegatedSessions: []
            };
            
            if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
                log.warn('No sessions to process');
                return result;
            }
            
            // If forcing new instance, handle all sessions locally
            if (forceNewInstance) {
                log.info('Force new instance mode: handling all sessions locally');
                result.localSessions = [...sessions];
                
                // Initialize instance if not already done
                if (!this.instanceId) {
                    const profile = sessions[0]?.profile || 'default';
                    await this.init({
                        profile,
                        profileIsolation
                    });
                }
                
                return result;
            }
            
            // Do early lightweight registration so delegation checks can find us
            if (!this.instanceId) {
                const profile = sessions[0]?.profile || 'default';
                await this.earlyRegister(profile);
            }
            
            // Group sessions by profile for delegation logic
            const sessionsByProfile = new Map();
            for (const session of sessions) {
                const profile = session.profile || 'default';
                if (!sessionsByProfile.has(profile)) {
                    sessionsByProfile.set(profile, []);
                }
                sessionsByProfile.get(profile).push(session);
            }
            
            // Process each profile group according to instance management rules
            for (const [profile, profileSessions] of sessionsByProfile) {
                const delegationResult = await this.handleProfileSessionDelegation(
                    profile, 
                    profileSessions, 
                    {
                        oneInstance,
                        profileIsolation,
                        strictProfileIsolation: profileIsolation && !oneInstance
                    }
                );
                
                // Add results to our response
                result.localSessions.push(...delegationResult.newSessions);
                result.delegatedSessions.push(...delegationResult.delegatedSessions);
            }
            
            // Initialize instance for local sessions if needed
            if (result.localSessions.length > 0 && !this.instanceId) {
                const profile = result.localSessions[0]?.profile || 'default';
                await this.init({
                    profile,
                    profileIsolation
                });
            }
            
            log.info('Session processing completed', {
                localSessions: result.localSessions.length,
                delegatedSessions: result.delegatedSessions.length
            });
            
            return result;
            
        } catch (error) {
            log.error('Error processing sessions:', error);
            return {
                localSessions: sessions || [],
                delegatedSessions: [],
                error: error.message
            };
        }
    }

    /**
     * Handle profile session delegation with flexible architecture
     * @method handleProfileSessionDelegation
     * @param {string} profile - Profile to handle delegation for
     * @param {Array<Object>} profileSessions - Sessions for the profile
     * @param {Object} options - Delegation options
     * @returns {Promise<Object>} Delegation result
     */
    async handleProfileSessionDelegation(profile, profileSessions, options = {}) {
        try {
            const {
                oneInstance = false,
                profileIsolation = true,
                strictProfileIsolation = true
            } = options;
            
            log.info(`Handling session delegation for profile ${profile}`, {
                sessionCount: profileSessions.length,
                oneInstance,
                profileIsolation,
                strictProfileIsolation
            });
            
            const result = {
                delegatedSessions: [],
                newSessions: [],
                delegationFailReason: null
            };
            
            // Validate inputs
            if (!profile || !profileSessions || !Array.isArray(profileSessions)) {
                log.error('Invalid parameters for session delegation');
                result.delegationFailReason = 'invalid_parameters';
                result.newSessions.push(...(Array.isArray(profileSessions) ? profileSessions : []));
                return result;
            }
            
            // Get all running instances
            const allInstances = await this.getInstances();
            const runningInstances = allInstances.filter(instance => {
                try {
                    // Exclude current process from delegation targets to prevent self-delegation
                    if (instance.pid === process.pid) {
                        log.debug(`Excluding current process (PID: ${process.pid}) from delegation targets`);
                        return false;
                    }
                    
                    // Check if process exists
                    process.kill(instance.pid, 0);
                    return true;
                } catch (error) {
                    return false;
                }
            });
            
            // Priority function for selecting best instance for delegation
            const getInstancePriority = (instance) => {
                let score = 0;
                
                // Prefer instances with the same profile
                if (instance.profile === profile) score += 1000;
                
                // Prefer instances with fewer sessions
                if (instance.sessions && Array.isArray(instance.sessions)) {
                    score -= instance.sessions.length * 10;
                }
                
                // Prefer older instances (more established)
                if (instance.startTime) {
                    const ageInMinutes = (Date.now() - new Date(instance.startTime).getTime()) / (60 * 1000);
                    score += Math.min(ageInMinutes, 60); // Cap at 60 minutes
                }
                
                return score;
            };
            
            // Sort instances by priority
            runningInstances.sort((a, b) => getInstancePriority(b) - getInstancePriority(a));
            
            // Handle one-instance mode (delegate to any existing instance)
            if (oneInstance && runningInstances.length > 0) {
                const targetInstance = runningInstances[0]; // Highest priority instance
                log.info(`One instance mode: delegating to instance ${targetInstance.id} (pid: ${targetInstance.pid})`);
                
                try {
                    const success = await this.delegateToInstance(targetInstance, profileSessions);
                    if (success) {
                        log.info(`Successfully delegated ${profileSessions.length} sessions to instance ${targetInstance.id}`);
                        result.delegatedSessions.push(...profileSessions);
                        return result;
                    } else {
                        log.warn(`Failed to delegate to instance ${targetInstance.id} in one-instance mode`);
                    }
                } catch (delegateError) {
                    log.error(`Error delegating to instance ${targetInstance.id}:`, delegateError);
                }
                
                // If delegation failed in one-instance mode, run locally
                result.delegationFailReason = 'delegation_failed';
                result.newSessions.push(...profileSessions);
                return result;
            }
            
            // Normal profile-based delegation logic with default profile exclusivity
            if (profileIsolation && strictProfileIsolation) {
                let targetInstance = null;
                
                // For "default" profile, implement exclusivity - any instance with default profile should be used
                if (profile === 'default') {
                    targetInstance = runningInstances.find(instance => instance.profile === 'default');
                    if (targetInstance) {
                        log.info(`Default profile exclusivity: found existing default instance ${targetInstance.id} (pid: ${targetInstance.pid})`);
                    }
                } else {
                    // For non-default profiles, find exact profile match
                    targetInstance = runningInstances.find(instance => instance.profile === profile);
                }
                
                if (targetInstance) {
                    log.info(`Delegating ${profileSessions.length} sessions to existing instance ${targetInstance.id} (pid: ${targetInstance.pid}) for profile ${profile}`);
                    
                    try {
                        // Double verify the instance is still running
                        process.kill(targetInstance.pid, 0);
                        
                        // Attempt delegation with retry logic
                        let success = false;
                        let retryCount = 0;
                        const maxRetries = 3;
                        
                        while (!success && retryCount < maxRetries) {
                            try {
                                success = await this.delegateToInstance(targetInstance, profileSessions);
                                if (success) break;
                            } catch (delegateError) {
                                log.warn(`Delegation attempt ${retryCount + 1} failed:`, delegateError);
                            }
                            
                            retryCount++;
                            if (retryCount < maxRetries) {
                                log.info(`Retrying delegation (attempt ${retryCount + 1}/${maxRetries})`);
                                await new Promise(r => setTimeout(r, 500 * retryCount)); // Increasing backoff
                            }
                        }
                        
                        if (success) {
                            log.info(`Successfully delegated ${profileSessions.length} sessions to instance ${targetInstance.id}`);
                            result.delegatedSessions.push(...profileSessions);
                            return result;
                        } else {
                            log.error(`Failed to delegate to instance ${targetInstance.id} after ${maxRetries} attempts`);
                            result.delegationFailReason = 'max_retries_exceeded';
                        }
                    } catch (processError) {
                        log.error(`Target instance ${targetInstance.id} is no longer running`);
                        result.delegationFailReason = 'target_instance_not_running';
                    }
                } else {
                    log.info(`No instance found for profile ${profile}, will create new instance`);
                    result.delegationFailReason = 'no_matching_profile_instance';
                }
            }
            
            // If we reach here, delegation either failed or wasn't applicable
            // Run sessions locally in this instance
            result.newSessions.push(...profileSessions);
            return result;
            
        } catch (error) {
            log.error('Error handling provider session delegation:', error);
            // Return a safe result even in case of errors
            return {
                delegatedSessions: [],
                newSessions: profileSessions || [],
                delegationFailReason: 'unexpected_error'
            };
        }
    }


    /**
     * Get instance by profile
     * @method getInstanceByProfile
     * @param {string} profile - Profile name
     * @returns {Promise<Object|null>} Instance object or null
     */
    async getInstanceByProfile(profile) {
        try {
            const instances = await this.getInstances();
            return instances.find(instance => {
                try {
                    // Check if process is still running
                    process.kill(instance.pid, 0);
                    return instance.profile === profile;
                } catch (error) {
                    return false;
                }
            }) || null;
        } catch (error) {
            log.error('Error getting instance by profile:', error);
            return null;
        }
    }

    /**
     * Delegate sessions to existing instances
     * @method delegateSessions
     * @param {Array<Object>} sessions - Sessions to delegate
     * @param {boolean} profileIsolation - Whether to respect profile isolation
     * @returns {Promise<boolean>} True if delegation was successful
     */
    async delegateSessions(sessions, profileIsolation = true) {
        try {
            if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
                log.error('Invalid or empty sessions array for delegation');
                return false;
            }

            log.info('Delegating sessions to existing instances:', sessions);
            
            // Group sessions by profile for delegation
            const sessionsByProfile = new Map();
            for (const session of sessions) {
                const profile = session.profile || 'default';
                if (!sessionsByProfile.has(profile)) {
                    sessionsByProfile.set(profile, []);
                }
                sessionsByProfile.get(profile).push(session);
            }
            
            let allSuccessful = true;
            
            // Process each profile group
            for (const [profile, profileSessions] of sessionsByProfile) {
                if (profileIsolation) {
                    // Find instance with matching profile
                    const targetInstance = await this.getInstanceByProfile(profile);
                    
                    if (targetInstance) {
                        log.info(`Delegating ${profileSessions.length} sessions to existing instance ${targetInstance.id} (pid: ${targetInstance.pid})`);
                        
                        const success = await this.delegateToInstance(targetInstance, profileSessions);
                        if (!success) {
                            log.error(`Failed to delegate sessions for profile ${profile}`);
                            allSuccessful = false;
                        }
                    } else {
                        log.info(`No instance found for profile ${profile}, delegation failed`);
                        allSuccessful = false;
                    }
                } else {
                    // Find any active instance
                    const instances = await this.getInstances();
                    const targetInstance = instances.find(instance => {
                        try {
                            process.kill(instance.pid, 0);
                            return true;
                        } catch (error) {
                            return false;
                        }
                    });
                    
                    if (targetInstance) {
                        const success = await this.delegateToInstance(targetInstance, profileSessions);
                        if (!success) {
                            log.error(`Failed to delegate sessions to instance ${targetInstance.id}`);
                            allSuccessful = false;
                        }
                    } else {
                        log.info('No instances found for delegation');
                        allSuccessful = false;
                    }
                }
            }
            
            return allSuccessful;
        } catch (error) {
            log.error('Error delegating sessions:', error);
            return false;
        }
    }

    /**
     * Delegate sessions to a specific instance
     * @method delegateToInstance
     * @param {Object} targetInstance - Target instance to delegate to
     * @param {Array<Object>} sessions - Sessions to delegate
     * @returns {Promise<boolean>} True if delegation was successful
     */
    async delegateToInstance(targetInstance, sessions) {
        try {
            if (!targetInstance || !sessions || !Array.isArray(sessions)) {
                log.error('Invalid arguments for delegateToInstance');
                return false;
            }

            // Delegate each session
            for (const session of sessions) {
                try {
                    const args = [];
                    if (session.provider) {
                        args.push(`--${session.provider}`);
                    }
                    if (session.profile) {
                        args.push('--profile', session.profile);
                    }
                    if (session.isTemp) {
                        args.push('--temp');
                    }

                    // Pass the full targetInstance to avoid re-validating
                    const success = await this.delegateCommandToInstance(targetInstance, args);
                    if (!success) {
                        log.error(`Failed to delegate session ${session.provider}:${session.profile} to instance ${targetInstance.id}`);
                        return false;
                    }
                } catch (error) {
                    log.error(`Error delegating session ${session.provider}:${session.profile}:`, error);
                    return false;
                }
            }

            log.info(`Successfully delegated ${sessions.length} sessions to instance ${targetInstance.id}`);
            return true;
        } catch (error) {
            log.error('Error in delegateToInstance:', error);
            return false;
        }
    }

    /**
     * Delegate a command to a specific instance
     * @method delegateCommandToInstance
     * @param {string|Object} instanceOrId - Target instance ID or instance object
     * @param {Array<string>} args - Command line arguments
     * @returns {Promise<boolean>} True if delegation was successful
     */
    async delegateCommandToInstance(instanceOrId, args) {
        return safeExecute(async () => {
            // Support both instance object and instance ID
            let targetInstance;
            let instanceId;
            
            if (typeof instanceOrId === 'object' && instanceOrId !== null) {
                // Instance object passed directly - use it without re-validating
                targetInstance = instanceOrId;
                instanceId = instanceOrId.id;
                log.info(`Delegating command to instance ${instanceId} (using cached instance):`, args);
            } else {
                // Instance ID passed - need to look it up
                instanceId = instanceOrId;
                log.info(`Delegating command to instance ${instanceId}:`, args);
                
                // Get target instance details
                const instances = await this.getInstances();
                targetInstance = instances.find(instance => instance.id === instanceId);
            }
            
            if (!targetInstance) {
                log.error(`Instance ${instanceId} not found`);
                return false;
            }

            // Create pipe name for target instance - use consistent format
            const packageJson = require('../../package.json');
            const appName = packageJson.name || 'desk-tray';
            const pipeName = targetInstance.pipeName || `\\\\.\\pipe\\${appName}-${targetInstance.pid}`;
            
            log.info(`Connecting to pipe: ${pipeName} for instance ${instanceId} (PID: ${targetInstance.pid})`);

            // Create a unique request ID for tracking
            const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Use Promise for IPC communication
            return await new Promise((resolve, reject) => {
                const net = require('net');
                let isResolved = false;
                let client = null;
                let connectionTimeout = null;
                
                // Helper function for cleanup
                const cleanupRequest = () => {
                    if (connectionTimeout) {
                        clearTimeout(connectionTimeout);
                        connectionTimeout = null;
                    }
                    if (client) {
                        try { client.end(); } catch {}
                        try { client.destroy(); } catch {}
                    }
                };

                try {
                    // Connect with socket connection timeout
                    client = net.connect(pipeName);
                    
                    // Set a connection timeout (5 seconds)
                    connectionTimeout = setTimeout(() => {
                        if (!isResolved) {
                            isResolved = true;
                            log.error(`Connection timeout connecting to instance ${instanceId}`);
                            cleanupRequest();
                            resolve(false);
                        }
                    }, 5000);
                    
                    // Handle successful connection
                    client.on('connect', () => {
                        // Clear connection timeout since we're connected
                        if (connectionTimeout) {
                            clearTimeout(connectionTimeout);
                            connectionTimeout = null;
                        }
                        
                        log.info(`Connected to instance ${instanceId} pipe`);
                        
                        // Send command to target instance
                        const message = {
                            type: 'delegate-command',
                            requestId,
                            targetPid: targetInstance.pid,
                            args: args || []
                        };
                        
                        log.info(`Sending delegation message: ${JSON.stringify(message)}`);
                        
                        // Check if client is still writable before sending
                        if (client && !client.destroyed && client.writable) {
                            client.write(JSON.stringify(message));
                            log.info('Delegation message sent successfully');
                        } else {
                            log.warn('Client connection not writable, cannot send delegation command');
                            if (!isResolved) {
                                isResolved = true;
                                cleanupRequest();
                                resolve(false);
                            }
                        }
                    });
                    
                    // Handle response data
                    client.on('data', (data) => {
                        if (isResolved) return;
                        
                        try {
                            const response = JSON.parse(data.toString());
                            log.debug('Received delegation response:', response);
                            
                            if (response.requestId === requestId) {
                                isResolved = true;
                                cleanupRequest();
                                resolve(response.success === true);
                            }
                        } catch (parseError) {
                            log.error('Error parsing delegation response:', parseError);
                        }
                    });
                    
                    // Handle connection errors
                    client.on('error', (error) => {
                        if (!isResolved) {
                            isResolved = true;
                            log.error(`Connection error delegating to instance ${instanceId}:`, error);
                            cleanupRequest();
                            resolve(false);
                        }
                    });
                    
                    // Handle connection close
                    client.on('end', () => {
                        if (!isResolved) {
                            isResolved = true;
                            log.warn(`Connection closed while delegating to instance ${instanceId}`);
                            cleanupRequest();
                            resolve(false);
                        }
                    });
                    
                } catch (error) {
                    if (!isResolved) {
                        isResolved = true;
                        log.error(`Error setting up delegation to instance ${instanceId}:`, error);
                        cleanupRequest();
                        resolve(false);
                    }
                }
            });
        }, {
            category: ErrorCategory.IPC_ERROR,
            context: { instanceOrId: typeof instanceOrId === 'object' ? instanceOrId?.id : instanceOrId, argsCount: args?.length },
            recoverFn: (error) => {
                log.error('Error in delegateCommandToInstance recovered:', error);
                return false;
            }
        });
    }

    /**
     * Delegate a command to any running instance or create new instance
     * @method delegateCommand
     * @param {Array<string>} args - Command line arguments to delegate
     * @param {string} [targetProfile] - Optional profile to target for delegation
     * @returns {Promise<boolean>} True if command was delegated successfully
     */
    async delegateCommand(args, targetProfile = null) {
        try {
            if (!Array.isArray(args)) {
                log.error('Invalid arguments for command delegation', { args });
                return false;
            }

            log.info('Delegating command:', { args, targetProfile });

            // Get running instances
            const instances = await this.getInstances();
            
            if (!instances || instances.length === 0) {
                log.error('No instances found for command delegation');
                return false;
            }
            
            // Find target instance
            let targetInstance = null;
            
            if (targetProfile) {
                // Find instance with matching profile
                log.info(`Looking for instance with profile: ${targetProfile}`);
                
                targetInstance = instances.find(instance => {
                    try {
                        // Check if process is still running
                        process.kill(instance.pid, 0);
                        
                        // Check if profile matches
                        const profileMatches = instance.profile === targetProfile;
                        
                        if (profileMatches) {
                            log.info(`Found matching instance for profile ${targetProfile}: ${instance.id} (PID: ${instance.pid})`);
                        }
                        
                        return profileMatches;
                    } catch (error) {
                        log.debug(`Instance ${instance.id} (PID: ${instance.pid}) is not running`);
                        return false;
                    }
                });
            } else {
                // Use first running instance
                log.info('No target profile specified, looking for any running instance');
                
                targetInstance = instances.find(instance => {
                    try {
                        // Check if process is still running
                        process.kill(instance.pid, 0);
                        log.info(`Found running instance: ${instance.id} (PID: ${instance.pid})`);
                        return true;
                    } catch (error) {
                        log.debug(`Instance ${instance.id} (PID: ${instance.pid}) is not running`);
                        return false;
                    }
                });
            }

            if (!targetInstance) {
                log.error('No suitable instance found for delegation', { targetProfile });
                return false;
            }

            // Delegate command to target instance - pass the full object to avoid re-validation
            log.info(`Delegating command to instance ${targetInstance.id} (PID: ${targetInstance.pid})`);
            return await this.delegateCommandToInstance(targetInstance, args);
        } catch (error) {
            log.error('Error delegating command:', error);
            return false;
        }
    }

    /**
     * Register this instance in the lock file
     * @method registerInstanceInLockFile
     * @param {string} profile - Profile name
     * @returns {Promise<void>}
     */
    async registerInstanceInLockFile(profile) {
        try {
            log.info(`Registering instance ${this.instanceId} in lock file with profile: ${profile}`);
            
            // Read current lock file
            const lockData = await this.readLockFile();
            
            // Add this instance
            if (!lockData.instances) {
                lockData.instances = {};
            }
            
            lockData.instances[this.instanceId] = {
                pid: process.pid,
                profile: profile,
                startTime: new Date().toISOString(),
                pipeName: this.ipcPipeName,
                sessions: [],
                metadata: {
                    hostname: require('os').hostname(),
                    platform: process.platform,
                    nodeVersion: process.version
                }
            };
            
            // Write back to lock file
            const success = await this.writeLockFile(lockData);
            if (success) {
                log.info(`Instance ${this.instanceId} registered successfully in lock file`);
            } else {
                log.error(`Failed to register instance ${this.instanceId} in lock file`);
            }
        } catch (error) {
            log.error('Error registering instance in lock file:', error);
            // Don't throw - this shouldn't prevent instance startup
        }
    }

    /**
     * Unregister this instance from the lock file
     * @method unregisterInstanceFromLockFile
     * @returns {Promise<void>}
     */
    async unregisterInstanceFromLockFile() {
        try {
            if (!this.instanceId) {
                log.warn('No instance ID to unregister');
                return;
            }
            
            log.info(`Unregistering instance ${this.instanceId} from lock file`);
            
            // Read current lock file
            const lockData = await this.readLockFile();
            
            // Remove this instance
            if (lockData.instances && lockData.instances[this.instanceId]) {
                delete lockData.instances[this.instanceId];
                
                // Write back to lock file
                const success = await this.writeLockFile(lockData);
                if (success) {
                    log.info(`Instance ${this.instanceId} unregistered successfully from lock file`);
                } else {
                    log.error(`Failed to unregister instance ${this.instanceId} from lock file`);
                }
            } else {
                log.warn(`Instance ${this.instanceId} was not found in lock file`);
            }
        } catch (error) {
            log.error('Error unregistering instance from lock file:', error);
        }
    }

    /**
     * Clean up dead instances from lock file
     * @method cleanupDeadInstances
     * @private
     * @param {Array<string>} deadInstanceIds - Array of dead instance IDs to remove
     * @returns {Promise<void>}
     */
    async cleanupDeadInstances(deadInstanceIds) {
        if (!deadInstanceIds || deadInstanceIds.length === 0) {
            return;
        }
        
        try {
            log.info(`Cleaning up ${deadInstanceIds.length} dead instances from lock file`);
            
            // Acquire lock for atomic cleanup
            await this.lockFileLock.acquire(async () => {
                const lockData = await this.readLockFile();
                let cleanedCount = 0;
                
                for (const instanceId of deadInstanceIds) {
                    if (lockData.instances && lockData.instances[instanceId]) {
                        const instance = lockData.instances[instanceId];
                        log.info(`Removing dead instance ${instanceId} (PID: ${instance.pid})`);
                        delete lockData.instances[instanceId];
                        cleanedCount++;
                    }
                }
                
                if (cleanedCount > 0) {
                    // Add cleanup entry to history for debugging
                    if (!lockData.history) {
                        lockData.history = [];
                    }
                    
                    lockData.history.push({
                        action: 'cleanup',
                        timestamp: Date.now(),
                        cleanedInstances: deadInstanceIds,
                        cleanedBy: process.pid,
                        reason: 'dead_process_cleanup'
                    });
                    
                    // Keep only last 50 history entries
                    if (lockData.history.length > 50) {
                        lockData.history = lockData.history.slice(-50);
                    }
                    
                    await this.writeLockFile(lockData);
                    log.info(`Successfully cleaned up ${cleanedCount} dead instances`);
                } else {
                    log.debug('No dead instances to clean up');
                }
            });
        } catch (error) {
            log.error('Error cleaning up dead instances:', error);
            // Don't throw - this is a cleanup operation that shouldn't block the main flow
        }
    }

    /**
     * Validate that a PID belongs to our application
     * @method validateProcessIsOurs
     * @private
     * @param {number} pid - Process ID to validate
     * @returns {Promise<boolean>} True if the process is our application
     */
    async validateProcessIsOurs(pid) {
        try {
            // First check if process exists at all
            try {
                process.kill(pid, 0);
            } catch (error) {
                log.debug(`PID ${pid} does not exist`);
                return false;
            }

            if (process.platform === 'win32') {
                // On Windows, use more robust process checking
                const { execSync } = require('child_process');
                try {
                    // Get both process name and command line
                    const result = execSync(`powershell -command "Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Select-Object ProcessName, CommandLine | Format-List"`, { 
                        encoding: 'utf8',
                        timeout: 3000 
                    });
                    
                    const processInfo = result.toLowerCase();
                    
                    // Check if it's electron or our app
                    const isElectron = processInfo.includes('electron') || processInfo.includes('desk-tray');
                    const hasOurPath = processInfo.includes('combo-desktop') || processInfo.includes(process.execPath.toLowerCase());
                    
                    if (isElectron || hasOurPath) {
                        log.debug(`PID ${pid} validated as our process`);
                        return true;
                    }
                    
                    log.debug(`PID ${pid} is not our process: ${processInfo.substring(0, 100)}`);
                    return false;
                } catch (error) {
                    log.debug(`Failed to validate PID ${pid} on Windows: ${error.message}`);
                    return false;
                }
            } else {
                // On Unix-like systems, check the process command line
                const { execSync } = require('child_process');
                try {
                    const result = execSync(`ps -p ${pid} -o args=`, { 
                        encoding: 'utf8',
                        timeout: 3000 
                    });
                    
                    const processArgs = result.trim().toLowerCase();
                    const isOurProcess = processArgs.includes('electron') || 
                                       processArgs.includes('desk-tray') ||
                                       processArgs.includes('combo-desktop');
                    
                    if (isOurProcess) {
                        log.debug(`PID ${pid} validated as our process`);
                        return true;
                    }
                    
                    log.debug(`PID ${pid} is not our process: ${processArgs.substring(0, 100)}`);
                    return false;
                } catch (error) {
                    log.debug(`Failed to validate PID ${pid} on Unix: ${error.message}`);
                    return false;
                }
            }
        } catch (error) {
            log.debug(`Error validating process ${pid}:`, error.message);
            // If we can't validate, assume it's not ours to be safe
            return false;
        }
    }
}

// Export a singleton instance
module.exports = new InstanceManager();
