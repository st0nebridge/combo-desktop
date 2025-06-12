/**
 * @file Application logging service that provides centralized logging configuration
 * and consistent log formatting across the application.
 */

const log = require('electron-log');

/**
 * Service for managing application logging.
 * Handles log configuration and provides consistent logging methods:
 * - Log level configuration
 * - Log format configuration
 * - Error catching
 * - Consistent logging interface
 * @class LoggingService
 */
class LoggingService {
    /**
     * Creates a new LoggingService instance and initializes logging
     * @constructor
     */
    constructor() {
        this.initializeLogging();
        this.setupErrorHandling();
    }

    /**
     * Initialize logging configuration with default settings
     * @method initializeLogging
     */
    initializeLogging() {
        log.transports.console.level = 'debug';
        log.transports.file.level = 'debug';
        log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
        log.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] {text}';
        log.errorHandler.startCatching();
        log.info('Logging initialized');
    }

    /**
     * Log an info message
     * @method info
     * @param {...*} args - Arguments to log
     */
    info(...args) {
        log.info(...args);
    }

    /**
     * Log a warning message
     * @method warn
     * @param {...*} args - Arguments to log
     */
    warn(...args) {
        log.warn(...args);
    }

    /**
     * Log an error message
     * @method error
     * @param {...*} args - Arguments to log
     */
    error(...args) {
        log.error(...args);
    }

    /**
     * Log a debug message
     * @method debug
     * @param {...*} args - Arguments to log
     */
    debug(...args) {
        log.debug(...args);
    }

    /**
     * Clean up logging before process exit to prevent EPIPE errors
     * @method cleanup
     * @returns {Promise<void>}
     */
    async cleanup() {
        try {
            // Disable console transport to prevent writing to closed streams
            log.transports.console.level = false;
            
            // Wait a small amount of time for any pending writes to complete
            await new Promise(resolve => setTimeout(resolve, 50));
            
            log.info('Logging cleanup completed');
        } catch (error) {
            // Ignore errors during cleanup to prevent exit issues
            console.error('Error during logging cleanup:', error.message);
        }
    }

    /**
     * Setup error handling for stream write errors (like EPIPE)
     * @method setupErrorHandling
     * @private
     */
    setupErrorHandling() {
        // Handle console transport errors gracefully
        if (log.transports.console && log.transports.console.stream) {
            const originalWrite = log.transports.console.stream.write;
            log.transports.console.stream.write = function(...args) {
                try {
                    return originalWrite.apply(this, args);
                } catch (error) {
                    if (error.code === 'EPIPE' || error.code === 'ECONNRESET') {
                        // Ignore broken pipe errors during process exit
                        return false;
                    }
                    throw error;
                }
            };
        }

        // Handle process stdout/stderr errors
        if (process.stdout) {
            process.stdout.on('error', (error) => {
                if (error.code === 'EPIPE') {
                    // Ignore EPIPE errors on stdout during process exit
                    return;
                }
                console.error('stdout error:', error);
            });
        }

        if (process.stderr) {
            process.stderr.on('error', (error) => {
                if (error.code === 'EPIPE') {
                    // Ignore EPIPE errors on stderr during process exit
                    return;
                }
                console.error('stderr error:', error);
            });
        }
    }
}

// Export a singleton instance
module.exports = new LoggingService();
