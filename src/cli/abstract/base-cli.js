/**
 * @file Abstract base class that provides common functionality for CLI modules.
 * Must remain abstract and not implement specific configuration.
 * 
 * Required implementations by child classes:
 * - parseArgs(): Parse module-specific args
 * - isCliCommand(): Check if command needs PID
 * - execute(args): Execute module logic
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

        this.args = process.argv.slice(process.defaultApp ? 2 : 1);
        this.moduleFlags = [];
    }

    /**
     * Get base result object structure containing universal flags
     * @returns {Object} Base result object with structure { help: false, manual: false, version: false }
     */
    getBaseResultObject() {
        return {
            help: false,
            manual: false,
            version: false
        };
    }

    /**
     * Parse common flags shared by all CLI modules
     * @param {Object} result - Result object to update
     * @param {number} index - Current index in args array
     * @returns {Object} Result with handled and skipNext flags
     */
    parseCommonFlags(result, index) {
        if (!result || typeof index !== 'number') {
            return { handled: false, skipNext: false };
        }

        const arg = this.args[index];
        let handled = true;
        let skipNext = false;
        
        switch (arg) {
            case '--help': {
                result.help = true;
                break;
            }
            case '--manual': {
                result.manual = true;
                break;
            }
            case '--version': {
                result.version = true;
                break;
            }
            default: {
                handled = false;
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
            process.exit(0);
        } catch (error) {
            logger.error('Error reading package version:', error);
            process.exit(1);
        }
    }

    /**
     * Parse module-specific arguments. Must be implemented by child classes.
     * @abstract
     * @method parseArgs
     * @returns {Object|null} Parsed arguments or null if not applicable
     * @throws {Error} If not implemented by child class
     */
    parseArgs() {
        throw new Error(`${this.constructor.name} must implement parseArgs()`);
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
     * @param {Object} args - Parsed arguments from parseArgs()
     * @throws {Error} If not implemented by child class or args is invalid
     */
    execute(args) {
        if (!args || typeof args !== 'object') {
            throw new Error('Invalid args parameter provided to execute()');
        }

        // Handle version flag before module-specific execution
        if (args.version) {
            this.showVersion();
            return true;
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
