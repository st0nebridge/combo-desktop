/**
 * @module shared/error-recovery
 * @description Error recovery utilities for robust application behavior.
 * Provides standardized error handling, categorization, and recovery mechanisms.
 * 
 * @input {Error} error - Original error to wrap/handle
 * @input {Object} options - Error configuration options
 * @output {RecoverableError} error - Enhanced error with recovery capabilities
 * 
 * @dependencies
 * - electron-log - Application logging
 * - electron - App paths for diagnostics
 * 
 * @example
 * const { createError, safeExecute, ErrorCategory } = require('./utils/error-recovery');
 * await safeExecute(async () => { ... }, { category: ErrorCategory.FILE_ERROR });
 */

const log = require('electron-log');
const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');
const os = require('os');

/**
 * Standard error categories for consistent error handling
 */
const ErrorCategory = {
  LOCK_ERROR: 'lock-error',
  FILE_ERROR: 'file-error',
  INSTANCE_ERROR: 'instance-error',
  PROFILE_ERROR: 'profile-error',
  TRANSACTION_ERROR: 'transaction-error',
  NETWORK_ERROR: 'network-error',
  IPC_ERROR: 'ipc-error',
  UNKNOWN_ERROR: 'unknown-error'
};

/**
 * Enhanced error class with additional properties for better error handling
 */
class RecoverableError extends Error {
  /**
   * Create a new RecoverableError
   * @param {string} message - Error message
   * @param {object} options - Error options
   * @param {string} options.category - Error category from ErrorCategory
   * @param {Error} options.cause - Original error that caused this one
   * @param {string} options.code - Error code for programmatic handling
   * @param {boolean} options.recoverable - Whether this error can be automatically recovered from
   * @param {object} options.context - Additional context for the error
   * @param {function} options.recoverFn - Function to call to recover from this error
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'RecoverableError';
    this.category = options.category || ErrorCategory.UNKNOWN_ERROR;
    this.cause = options.cause;
    this.code = options.code;
    this.recoverable = options.recoverable !== false; // Default to true
    this.context = options.context || {};
    this.recoverFn = options.recoverFn;
    this.timestamp = new Date();
    this.hostname = os.hostname();
    this.processId = process.pid;
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RecoverableError);
    }
  }

  /**
   * Log this error with appropriate level and details
   * @param {string} [level='error'] - Log level to use
   * @returns {RecoverableError} this error for chaining
   */
  log(level = 'error') {
    const logFn = log[level] || log.error;
    const contextStr = Object.keys(this.context).length > 0
      ? `\nContext: ${JSON.stringify(this.context, null, 2)}`
      : '';
    
    const causeStr = this.cause
      ? `\nCaused by: ${this.cause.stack || this.cause.message || String(this.cause)}`
      : '';

    logFn(`[${this.category}] ${this.message}${contextStr}${causeStr}`);
    return this;
  }

  /**
   * Attempt to recover from this error if a recovery function exists
   * @returns {Promise<boolean>} Whether recovery was successful
   */
  async recover() {
    if (!this.recoverable || typeof this.recoverFn !== 'function') {
      return false;
    }

    try {
      await this.recoverFn(this);
      log.info(`Recovered from error: ${this.message}`);
      return true;
    } catch (recoverError) {
      log.error(`Recovery attempt failed for error: ${this.message}`, recoverError);
      return false;
    }
  }
}

/**
 * Create an error with standardized format
 * @param {string} message - Error message
 * @param {object} options - Error options
 * @returns {RecoverableError} The created error
 */
function createError(message, options = {}) {
  return new RecoverableError(message, options);
}

/**
 * Safely execute a function with error handling and recovery
 * @param {Function} fn - Function to execute
 * @param {object} options - Options for error handling
 * @param {string} options.category - Error category from ErrorCategory
 * @param {boolean} options.throwOnError - Whether to throw or return null on error
 * @param {Function} options.recoverFn - Function to call to recover from errors
 * @param {Function} options.fallback - Fallback function to call if the main function fails
 * @param {object} options.context - Additional context for errors
 * @returns {Promise<*>} Result of the function or null/error
 */
async function safeExecute(fn, options = {}) {
  try {
    return await fn();
  } catch (error) {
    const recoverableError = error instanceof RecoverableError
      ? error
      : new RecoverableError(
          error.message || 'An error occurred',
          {
            cause: error,
            category: options.category || ErrorCategory.UNKNOWN_ERROR,
            context: options.context,
            recoverFn: options.recoverFn
          }
        );
    
    recoverableError.log();
    
    // Try fallback function first if provided
    if (options.fallback && typeof options.fallback === 'function') {
        try {
            log.info('Attempting fallback function');
            return await options.fallback(error);
        } catch (fallbackError) {
            log.error('Fallback function also failed:', fallbackError);
        }
    }
    
    // Try to recover if specified
    if (options.recoverFn) {
      const recovered = await recoverableError.recover();
      if (recovered && options.retryOnRecover) {
        log.info('Recovery successful, retrying operation');
        return safeExecute(fn, {...options, retryCount: (options.retryCount || 0) + 1});
      }
    }
    
    // Throw or return null based on options
    if (options.throwOnError) {
      throw recoverableError;
    }
    
    return null;
  }
}

/**
 * Log error details to a diagnostics file for later analysis
 * @param {Error} error - Error to log
 * @param {string} componentName - Name of the component where error occurred
 * @param {string} operationName - Name of the operation that failed
 * @returns {Promise<string>} Path to the diagnostic file
 */
async function logDiagnostics(error, componentName, operationName) {
  try {
    const diagDir = path.join(app.getPath('userData'), 'diagnostics');
    await fs.mkdir(diagDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `error-${componentName}-${operationName}-${timestamp}.json`;
    const filePath = path.join(diagDir, filename);
    
    const errorData = {
      timestamp: new Date().toISOString(),
      component: componentName,
      operation: operationName,
      process: {
        pid: process.pid,
        platform: process.platform,
        arch: process.arch,
        versions: process.versions,
        memoryUsage: process.memoryUsage(),
      },
      system: {
        hostname: os.hostname(),
        type: os.type(),
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        uptime: os.uptime(),
        totalmem: os.totalmem(),
        freemem: os.freemem(),
        cpus: os.cpus().length,
      },
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        category: error.category,
        recoverable: error.recoverable,
        context: error.context,
        cause: error.cause ? {
          name: error.cause.name,
          message: error.cause.message,
          stack: error.cause.stack,
        } : undefined,
      }
    };
    
    await fs.writeFile(filePath, JSON.stringify(errorData, null, 2));
    log.info(`Diagnostic information written to: ${filePath}`);
    return filePath;
  } catch (diagError) {
    log.error('Failed to write diagnostic information:', diagError);
    return null;
  }
}

/**
 * Attempt to recover a corrupted lock file
 * @param {string} lockFilePath - Path to the lock file
 * @param {object} [validationData] - Optional data to validate against
 * @returns {Promise<boolean>} Whether recovery was successful
 */
async function recoverLockFile(lockFilePath, validationData) {
  try {
    log.info(`Attempting to recover lock file: ${lockFilePath}`);
    
    // Check if file exists first
    try {
      await fs.access(lockFilePath);
    } catch (accessError) {
      log.warn(`Lock file does not exist, creating new one: ${lockFilePath}`);
      await fs.writeFile(lockFilePath, JSON.stringify({ instances: {} }, null, 2));
      return true;
    }
    
    // Read the current file
    const backupPath = `${lockFilePath}.bak`;
    const content = await fs.readFile(lockFilePath, 'utf8');
    
    // Create a backup
    await fs.writeFile(backupPath, content);
    
    // Try to parse the JSON
    try {
      const data = JSON.parse(content);
      
      // Validate the structure
      if (!data.instances || typeof data.instances !== 'object') {
        data.instances = {};
      }
      
      // Clean up invalid instance entries
      if (data.instances) {
        for (const id in data.instances) {
          const instance = data.instances[id];
          if (!instance || typeof instance !== 'object' || !instance.pid) {
            delete data.instances[id];
          }
        }
      }
      
      // Write the corrected file
      await fs.writeFile(lockFilePath, JSON.stringify(data, null, 2));
      log.info(`Lock file recovery successful: ${lockFilePath}`);
      return true;
    } catch (parseError) {
      log.error(`Lock file contains invalid JSON, restoring from backup: ${parseError.message}`);
      
      // If validation data is provided, write that instead of a blank file
      if (validationData) {
        await fs.writeFile(lockFilePath, JSON.stringify(validationData, null, 2));
      } else {
        // Write a valid empty structure
        await fs.writeFile(lockFilePath, JSON.stringify({ instances: {} }, null, 2));
      }
      
      log.info(`Lock file recreated with valid structure: ${lockFilePath}`);
      return true;
    }
  } catch (recoveryError) {
    log.error('Lock file recovery failed:', recoveryError);
    return false;
  }
}

/**
 * Verify the integrity of a data file with retry mechanism
 * @param {string} filePath - Path to the file
 * @param {Function} validationFn - Function to validate file contents
 * @param {Function} fallbackFn - Function to get fallback data if validation fails
 * @returns {Promise<object>} The file contents or fallback data
 */
async function verifyDataFileIntegrity(filePath, validationFn, fallbackFn) {
  const maxRetries = 3;
  let attemptCount = 0;
  
  while (attemptCount < maxRetries) {
    try {
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      
      if (!fileExists) {
        log.warn(`File ${filePath} does not exist, creating with fallback data`);
        const fallbackData = await fallbackFn();
        await fs.writeFile(filePath, JSON.stringify(fallbackData, null, 2));
        return fallbackData;
      }
      
      const content = await fs.readFile(filePath, 'utf8');
      let data;
      
      try {
        data = JSON.parse(content);
      } catch (parseError) {
        log.error(`Invalid JSON in ${filePath}, attempt ${attemptCount + 1}/${maxRetries}`);
        
        if (attemptCount === maxRetries - 1) {
          log.warn(`Using fallback data for ${filePath} after ${maxRetries} failed attempts`);
          const fallbackData = await fallbackFn();
          await fs.writeFile(filePath, JSON.stringify(fallbackData, null, 2));
          return fallbackData;
        }
        
        attemptCount++;
        continue;
      }
      
      // Validate the data
      const isValid = await validationFn(data);
      
      if (isValid) {
        return data;
      }
      
      log.warn(`Data validation failed for ${filePath}, attempt ${attemptCount + 1}/${maxRetries}`);
      
      if (attemptCount === maxRetries - 1) {
        log.warn(`Using fallback data for ${filePath} after ${maxRetries} failed validation attempts`);
        const fallbackData = await fallbackFn();
        await fs.writeFile(filePath, JSON.stringify(fallbackData, null, 2));
        return fallbackData;
      }
      
      attemptCount++;
    } catch (error) {
      log.error(`Error verifying file integrity for ${filePath}:`, error);
      
      if (attemptCount === maxRetries - 1) {
        log.warn(`Using fallback data after ${maxRetries} failed attempts`);
        const fallbackData = await fallbackFn();
        return fallbackData;
      }
      
      attemptCount++;
    }
  }
  
  // This should not normally be reached due to returns in the loop
  const fallbackData = await fallbackFn();
  return fallbackData;
}

module.exports = {
  ErrorCategory,
  RecoverableError,
  createError,
  safeExecute,
  logDiagnostics,
  recoverLockFile,
  verifyDataFileIntegrity
};
