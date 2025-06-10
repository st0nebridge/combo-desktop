/**
 * Transaction utility module
 * Provides utilities for implementing transaction-like behavior in JavaScript
 * with rollback capabilities, state snapshots, and error handling
 */
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const log = require('electron-log');

/**
 * Creates a transaction context for atomic multi-step operations
 * @param {string} name - Transaction name for logging
 * @param {Object} options - Transaction options
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @param {boolean} [options.autoRollback=true] - Auto rollback on error
 * @returns {Object} Transaction context
 */
function createTransaction(name, options = {}) {
    const { debug = false, autoRollback = true } = options;
    
    // Generate a unique transaction ID
    const txId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    
    // Initialize the transaction state
    const state = {
        id: txId,
        name,
        startTime: Date.now(),
        steps: [],
        snapshots: new Map(),
        rollbackHandlers: [],
        committed: false,
        rolledBack: false,
        completed: false,
        error: null
    };
    
    // Utility function for debug logging
    const debugLog = (message) => {
        if (debug) {
            log.debug(`[Transaction ${txId}] ${message}`);
        }
    };
    
    // Log transaction creation
    debugLog(`Created transaction: ${name}`);
    
    /**
     * Register a step in the transaction
     * @param {string} stepName - Step name
     * @param {Function} action - Function to execute for this step
     * @param {Function} [rollback] - Function to execute to rollback this step
     * @returns {Promise<any>} Result of the action
     */
    const step = async (stepName, action, rollback = null) => {
        debugLog(`Starting step: ${stepName}`);
        
        // Create step metadata
        const stepInfo = {
            name: stepName,
            startTime: Date.now(),
            status: 'pending',
            result: null,
            error: null
        };
        
        state.steps.push(stepInfo);
        
        try {
            // Execute the action
            const result = await action();
            
            // Update step metadata
            stepInfo.status = 'completed';
            stepInfo.result = result;
            stepInfo.endTime = Date.now();
            
            // Register rollback handler if provided
            if (typeof rollback === 'function') {
                state.rollbackHandlers.unshift(() => {
                    debugLog(`Rolling back step: ${stepName}`);
                    return rollback(result);
                });
            }
            
            debugLog(`Completed step: ${stepName}`);
            return result;
        } catch (error) {
            // Update step metadata
            stepInfo.status = 'failed';
            stepInfo.error = error;
            stepInfo.endTime = Date.now();
            
            debugLog(`Failed step: ${stepName}: ${error.message}`);
            
            // Automatically rollback if configured
            if (autoRollback && !state.rolledBack) {
                await rollbackTransaction();
            }
            
            throw error;
        }
    };
    
    /**
     * Save a snapshot of data for potential rollback
     * @param {string} key - Unique key for this snapshot
     * @param {any} data - Data to snapshot
     */
    const saveSnapshot = (key, data) => {
        if (data === undefined || data === null) {
            debugLog(`Warning: Attempted to save undefined/null snapshot for key: ${key}`);
            return;
        }
        
        try {
            // Store a deep copy to avoid reference issues
            const serialized = JSON.stringify(data);
            state.snapshots.set(key, serialized);
            debugLog(`Saved snapshot: ${key}`);
        } catch (error) {
            debugLog(`Failed to save snapshot: ${key}: ${error.message}`);
        }
    };
    
    /**
     * Retrieve a snapshot
     * @param {string} key - Key of the snapshot to retrieve
     * @returns {any} The stored snapshot data
     */
    const getSnapshot = (key) => {
        try {
            const serialized = state.snapshots.get(key);
            if (!serialized) {
                debugLog(`Warning: No snapshot found for key: ${key}`);
                return null;
            }
            
            return JSON.parse(serialized);
        } catch (error) {
            debugLog(`Failed to retrieve snapshot: ${key}: ${error.message}`);
            return null;
        }
    };
    
    /**
     * Add a custom rollback handler
     * @param {Function} handler - Rollback handler function
     */
    const onRollback = (handler) => {
        if (typeof handler === 'function') {
            state.rollbackHandlers.unshift(handler);
            debugLog('Added custom rollback handler');
        }
    };
    
    /**
     * Roll back the transaction, executing rollback handlers in reverse order
     */
    const rollbackTransaction = async () => {
        if (state.rolledBack || state.committed) {
            return;
        }
        
        state.rolledBack = true;
        debugLog('Rolling back transaction');
        
        for (const handler of state.rollbackHandlers) {
            try {
                await handler();
            } catch (error) {
                debugLog(`Rollback handler error: ${error.message}`);
            }
        }
        
        state.completed = true;
        state.endTime = Date.now();
        debugLog('Transaction rolled back');
    };
    
    /**
     * Add metadata to the transaction
     * Used for tracking additional information about the transaction
     * @param {string} key - Metadata key
     * @param {any} value - Metadata value
     */
    const addMetadata = (key, value) => {
        if (!state.metadata) {
            state.metadata = {};
        }
        state.metadata[key] = value;
        debugLog(`Added metadata ${key} to transaction ${txId}`);
    };
    
    /**
     * Commit the transaction, preventing further rollbacks
     */
    const commit = () => {
        if (state.rolledBack) {
            throw new Error('Cannot commit transaction that has been rolled back');
        }
        
        state.committed = true;
        state.completed = true;
        state.endTime = Date.now();
        debugLog('Transaction committed');
    };
    
    /**
     * Write a file atomically (write to temp file, then rename)
     * @param {string} filePath - Path to write
     * @param {string|Buffer} data - Data to write
     * @returns {Promise<void>}
     */
    const writeFileAtomic = async (filePath, data) => {
        const tempPath = `${filePath}.${txId}.tmp`;
        const backupPath = `${filePath}.bak`;
        
        return step(`writeFileAtomic:${path.basename(filePath)}`, async () => {
            // Generate checksum
            const checksum = crypto.createHash('sha256').update(data).digest('hex');
            
            // Save snapshot of original file if it exists
            try {
                const original = await fs.readFile(filePath, 'utf8');
                saveSnapshot(`file:${filePath}`, original);
            } catch (error) {
                // File doesn't exist, that's fine for new files
                if (error.code !== 'ENOENT') {
                    debugLog(`Error reading original file: ${error.message}`);
                }
            }
            
            // Write to temp file
            await fs.writeFile(tempPath, data, 'utf8');
            
            // Create backup of current file if it exists
            try {
                await fs.access(filePath);
                await fs.copyFile(filePath, backupPath);
            } catch (error) {
                // File doesn't exist, no backup needed
            }
            
            // Rename temp file to target
            await fs.rename(tempPath, filePath);
            
            // Verify written data
            const verifyData = await fs.readFile(filePath, 'utf8');
            const verifyChecksum = crypto.createHash('sha256').update(verifyData).digest('hex');
            
            if (verifyChecksum !== checksum) {
                throw new Error(`File integrity check failed for ${filePath}`);
            }
            
            return { filePath, checksum };
        }, async () => {
            // Rollback: restore from backup or delete if it didn't exist
            try {
                const original = getSnapshot(`file:${filePath}`);
                if (original) {
                    await fs.writeFile(filePath, original, 'utf8');
                    debugLog(`Restored original file: ${filePath}`);
                } else {
                    try {
                        await fs.unlink(filePath);
                        debugLog(`Deleted file: ${filePath}`);
                    } catch (error) {
                        // Ignore errors deleting non-existent file
                    }
                }
                
                // Clean up temp and backup files
                try {
                    await fs.unlink(tempPath);
                } catch (error) {
                    // Ignore errors deleting temp file
                }
                
                try {
                    await fs.unlink(backupPath);
                } catch (error) {
                    // Ignore errors deleting backup file
                }
            } catch (error) {
                debugLog(`Error in rollback for ${filePath}: ${error.message}`);
            }
        });
    };
    
    return {
        id: txId,
        name,
        step,
        saveSnapshot,
        getSnapshot,
        onRollback,
        rollback: rollbackTransaction,
        commit,
        writeFileAtomic,
        addMetadata,
        getState: () => ({ ...state }),
        isActive: () => !state.completed
    };
}

/**
 * Create an atomic lock for a specific resource
 * to prevent concurrent access
 * @param {string} resourceName - Name of the resource to lock
 * @returns {Function} Lock function
 */
function createResourceLock(resourceName) {
    const locks = new Map();
    
    if (!locks.has(resourceName)) {
        locks.set(resourceName, {
            queue: [],
            locked: false
        });
    }
    
    const resourceLock = locks.get(resourceName);
    
    return async (fn) => {
        return new Promise((resolve, reject) => {
            const execute = async () => {
                try {
                    const result = await fn();
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    resourceLock.locked = false;
                    if (resourceLock.queue.length > 0) {
                        const next = resourceLock.queue.shift();
                        next();
                    }
                }
            };
            
            if (resourceLock.locked) {
                resourceLock.queue.push(execute);
            } else {
                resourceLock.locked = true;
                execute();
            }
        });
    };
}

/**
 * Execute a function with a transaction
 * @param {string} name - Transaction name
 * @param {Function} fn - Function to execute with transaction context
 * @param {Object} options - Transaction options
 * @returns {Promise<any>} Result of the function
 */
async function withTransaction(name, fn, options = {}) {
    const tx = createTransaction(name, options);
    
    try {
        const result = await fn(tx);
        tx.commit();
        return result;
    } catch (error) {
        await tx.rollback();
        throw error;
    }
}

module.exports = {
    createTransaction,
    createResourceLock,
    withTransaction
};
