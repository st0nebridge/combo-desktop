/**
 * @file Instance management service that handles application instance lifecycle,
 * locking, and PID tracking to ensure proper multi-instance behavior.
 */

const { app, ipcMain } = require('electron');
const log = require('../services/logging.service');
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
}
