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
}

// Export a singleton instance
module.exports = new LoggingService();
