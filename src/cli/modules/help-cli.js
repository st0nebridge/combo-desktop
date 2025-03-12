/**
 * @module HelpCLI
 * @description CLI module that handles help, manual, and version information commands.
 * Provides functionality for displaying usage information, detailed manual,
 * and version details.
 */

const BaseCLI = require('../abstract/base-cli');
const logger = require('../../services/logging.service');
const { app } = require('electron');

/**
 * CLI module for handling help and documentation commands.
 * Extends BaseCLI to provide help-specific functionality:
 * - Version information
 * - Usage guide
 * - Detailed manual
 * @class HelpCLI
 * @extends {BaseCLI}
 */
class HelpCLI extends BaseCLI {
    /**
     * Creates a new HelpCLI instance
     * @constructor
     */
    constructor() {
        super();
        
        /** @property {Array<string>} moduleFlags - Supported command flags */
        this.moduleFlags = [
            '--help',
            '--manual',
            '--version'
        ];

        // Initialize paths
        this.initializePaths();

        // Bind command functions
        /** @property {Object} commands - Map of command names to handler functions */
        this.commands = {
            'version': this.showVersion.bind(this),
            'help': this.showUsage.bind(this),
            'manual': this.showManual.bind(this)
        };
    }

    /**
     * Initialize help paths and application metadata
     * @method initializePaths
     * @throws {Error} If initialization fails
     */
    initializePaths() {
        try {
            if (!app.name) {
                const packageJson = require('../../../package.json');
                app.name = packageJson.name;
            }

            this.mode = process.env.NODE_ENV || 'development';
            logger.debug(`Help CLI initialized with mode: ${this.mode}`);
        } catch (error) {
            logger.error('Error initializing help paths:', error);
            throw error;
        }
    }

    /**
     * Get help-specific result object with additional fields
     * @method getHelpResultObject
     * @returns {Object} Result object with structure { help: false, manual: false, version: false, cliCommand: false }
     */
    getHelpResultObject() {
        const result = this.getBaseResultObject();
        return {
            ...result,
            version: false,
            cliCommand: false
        };
    }

    /**
     * Parse help-specific command line arguments
     * @method parseArgs
     * @override
     * @returns {Object|null} Parsed arguments or null if no help flags found
     */
    parseArgs() {
        const result = this.getHelpResultObject();

        let i = 0;
        while (i < this.args.length) {
            const arg = this.args[i];

            switch (arg) {
                case '--version': {
                    result.version = true;
                    result.cliCommand = true;
                    i++;
                    break;
                }
                case '--help': {
                    result.help = true;
                    result.cliCommand = true;
                    i++;
                    break;
                }
                case '--manual': {
                    result.manual = true;
                    result.cliCommand = true;
                    i++;
                    break;
                }
                default: {
                    const { handled, skipNext } = this.parseCommonFlags(result, i);
                    if (skipNext) {
                        i += 2;
                    } else {
                        i++;
                    }
                }
            }
        }

        // Return null if no help-specific flags found
        if (!result.version && !result.help && !result.manual) {
            return null;
        }

        return result;
    }

    /**
     * Check if the current command is a CLI command
     * @method isCliCommand
     * @override
     * @returns {boolean} True if this is a CLI command
     */
    isCliCommand() {
        try {
            const args = this.parseArgs();
            return args && args.cliCommand;
        } catch (error) {
            logger.error('Error checking CLI command:', error);
            return false;
        }
    }

    /**
     * Execute help-specific commands based on parsed arguments
     * @method execute
     * @override
     * @param {Object} args - Parsed arguments from parseArgs()
     * @returns {boolean} True if command executed successfully
     * @throws {Error} If command execution fails
     */
    execute(args) {
        try {
            if (!args) {
                return false;
            }

            if (args.version && this.commands.version) {
                this.commands.version();
                return true;
            }

            if (args.help && this.commands.help) {
                this.commands.help();
                return true;
            }

            if (args.manual && this.commands.manual) {
                this.commands.manual();
                return true;
            }

            return false;
        } catch (error) {
            logger.error('Error executing help command:', error);
            throw error;
        }
    }

    /**
     * Show version and environment information
     * @method showVersion
     * @throws {Error} If version information cannot be retrieved
     */
    showVersion() {
        try {
            const packageJson = require('../../../package.json');
            logger.info(`\n${packageJson.name} v${packageJson.version}`);
            logger.info(`Mode: ${this.mode}`);
            logger.info(`Electron: ${process.versions.electron}`);
            logger.info(`Chrome: ${process.versions.chrome}`);
            logger.info(`Node: ${process.versions.node}\n`);
            process.exit(0);
        } catch (error) {
            logger.error('Error showing version:', error);
            process.exit(1);
        }
    }

    /**
     * Show basic usage information and available commands
     * @method showUsage
     * @override
     */
    showUsage() {
        logger.info(`
Usage: ${app.name} [options] [command]

Options:
  --help\t\tShow this help message
  --manual\tShow detailed manual
  --version\tShow version information

Commands:
  help\t\tShow help information
  manual\t\tShow detailed manual
  version\t\tShow version information
`);
    }

    /**
     * Show detailed manual with examples
     * @method showManual
     */
    showManual() {
        logger.info(`
${app.name} Manual

Description:
  Desktop application for managing service providers.
  
Usage:
  ${app.name} [options] [command]

Options:
  --help\t\tShow basic help information
  --manual\tShow this detailed manual
  --version\tShow version information

Commands:
  help\t\tShow help information
  manual\t\tShow this detailed manual
  version\t\tShow version information

Examples:
  ${app.name} --help\t\tShow help
  ${app.name} --version\tShow version
  ${app.name} --manual\tShow this manual
`);
    }
}

module.exports = HelpCLI;
