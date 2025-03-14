/**
 * @file Abstract base class that provides common functionality for CLI modules.
 * Must remain abstract and not implement specific configuration.
 * 
 * Required implementations by child classes:
 * - canHandle(): Check if module can handle given args
 * - isCliCommand(): Check if command needs PID
 * - execute(args, context): Execute module logic
 * - showUsage(): Show module usage
 */

const fs = require('fs');
const path = require('path');
const logger = require('../../services/logging.service');

/**
 * Abstract base class that provides common functionality for CLI modules.
 * Handles argument parsing, command execution, and file validation.
 * @class BaseCLI
 * @abstract
 */
class BaseCLI {
    constructor() {
        if (this.constructor === BaseCLI) {
            throw new Error('BaseCLI cannot be instantiated directly');
        }

        // Each module should define its own moduleFlags
        this.moduleFlags = [];
        
        // Each module should define its own command map
        this.commands = {};
    }

    /**
     * Get base result object structure containing universal flags
     * @returns {Object} Base result object with structure { help: false, manual: false, version: false }
     */
    getBaseResultObject() {
        return {
            help: false,
            manual: false,
            version: false,
            context: {},
            continueExecution: true
        };
    }

    /**
     * Parse common flags shared by all CLI modules
     * @param {Array<string>} args - Command line arguments
     * @param {Object} result - Result object to update
     * @returns {Object} Result with handled and skipNext flags
     */
    parseCommonFlags(args, result) {
        if (!args || !result) {
            return { handled: false, skipNext: false };
        }

        let handled = false;
        let skipNext = false;
        
        // Check for common flags
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            
            switch (arg) {
                case '--help': {
                    result.help = true;
                    handled = true;
                    break;
                }
                case '--manual': {
                    result.manual = true;
                    handled = true;
                    break;
                }
                case '--version': {
                    result.version = true;
                    handled = true;
                    break;
                }
            }
        }

        return { handled, skipNext };
    }

    /**
     * Show version information
     * @method showVersion
     */
    showVersion() {
        try {
            const packagePath = path.join(__dirname, '..', '..', '..', 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            logger.info(`Version: ${packageJson.version}`);
            console.log(`Version: ${packageJson.version}`);
            return true;
        } catch (error) {
            logger.error('Error reading package version:', error);
            return false;
        }
    }

    /**
     * Check if module can handle the given arguments
     * @abstract
     * @method canHandle
     * @param {Array<string>} args - Command line arguments
     * @returns {boolean} True if module can handle these arguments
     * @throws {Error} If not implemented by child class
     */
    canHandle(args) {
        throw new Error(`${this.constructor.name} must implement canHandle()`);
    }

    /**
     * Check if this is a CLI command that shouldn't register a PID.
     * Must be implemented by child classes.
     * @abstract
     * @method isCliCommand
     * @returns {boolean} True if this is a CLI command
     * @throws {Error} If not implemented by child class
     */
    isCliCommand() {
        throw new Error(`${this.constructor.name} must implement isCliCommand()`);
    }

    /**
     * Execute module-specific logic. Must be implemented by child classes.
     * @abstract
     * @method execute
     * @param {Array<string>} args - Command line arguments
     * @param {Object} context - Execution context that can be modified
     * @returns {Promise<{success: boolean, context: Object, continueExecution: boolean, provider: string}>} Execution result
     * @throws {Error} If not implemented by child class
     */
    execute(args, context) {
        if (!args || !Array.isArray(args)) {
            throw new Error('Invalid args parameter provided to execute()');
        }

        if (!context || typeof context !== 'object') {
            context = {};
        }

        // Handle version flag
        if (args.includes('--version')) {
            const success = this.showVersion();
            return Promise.resolve({
                success,
                context,
                continueExecution: false
            });
        }

        // Handle help flag
        if (args.includes('--help')) {
            this.showUsage();
            return Promise.resolve({
                success: true,
                context,
                continueExecution: false
            });
        }

        throw new Error(`${this.constructor.name} must implement execute()`);
    }

    /**
     * Show usage information for the module. Must be implemented by child classes.
     * @abstract
     * @method showUsage
     * @throws {Error} If not implemented by child class
     */
    showUsage() {
        throw new Error(`${this.constructor.name} must implement showUsage()`);
    }

    /**
     * Validate that a file path exists
     * @param {string} filePath - Path to validate
     * @throws {Error} If the file path is invalid or file does not exist
     * @returns {string} Resolved absolute path
     */
    validateFilePath(filePath) {
        if (!filePath) {
            throw new Error('File path is required');
        }

        const resolvedPath = path.resolve(filePath);
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`File not found: ${resolvedPath}`);
        }

        return resolvedPath;
    }
}

module.exports = BaseCLI;
