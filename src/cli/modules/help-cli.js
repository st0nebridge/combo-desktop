/**
 * @module HelpCLI
 * @description CLI module for displaying help information and documentation.
 */

const BaseCLI = require('../abstract/base-cli');
const log = require('electron-log');
const { app } = require('electron');

/**
 * CLI module for displaying help information.
 * Extends BaseCLI to provide help functionality:
 * - General help information
 * - Version information
 * - Manual pages
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
        
        // Define entry flag for help commands
        this.entryFlag = 'help';

        // Bind command functions using .bind() pattern for command mapping
        this.commands = {
            'version': this.showVersion.bind(this),
            'help': this.showUsage.bind(this),
            'manual': this.showManual.bind(this)
        };

        // Initialize in test mode if specified
        if (process.env.NODE_ENV === 'test') {
            log.debug('Help CLI initialized with mode: test');
        }
    }

    /**
     * Parse help-specific command line arguments
     * @method parseArgs
     * @param {Object} args - Command line arguments
     * @returns {Object|null} Parsed arguments or null if no help flags found
     */
    async parseArgs(args) {
        try {
            // Check for entry flag first
            if (!args[this.entryFlag]) {
                return null;
            }

            // Get the subcommand
            const subcommand = args._[0];
            
            // Check if subcommand exists in our command map
            if (this.commands[subcommand]) {
                return {
                    command: subcommand,
                    handler: this.commands[subcommand],
                    args: {}
                };
            }

            // If no valid subcommand but entry flag is present, default to help
            return {
                command: 'help',
                handler: this.commands.help,
                args: {}
            };
        } catch (error) {
            log.error('Error parsing help arguments:', error);
            return null;
        }
    }

    /**
     * Execute help-specific commands based on parsed arguments
     * @method execute
     * @param {Object} args - Parsed arguments from parseArgs()
     * @returns {Promise<boolean>} True if execution successful
     */
    async execute(args) {
        try {
            if (!args || !args.command || !args.handler) {
                return false;
            }

            // Execute the command handler with parsed arguments
            return await args.handler(args.args);
        } catch (error) {
            log.error('Error executing help command:', error);
            return false;
        }
    }

    /**
     * Show usage information for the help module
     * @method showUsage
     * @returns {Promise<boolean>} True if successful
     */
    async showUsage() {
        try {
            console.log(`
Help Commands:
  --help                    Show this help information
  --help version           Show version information
  --help manual            Show detailed manual

Examples:
  yarn start --help                Show help information
  yarn start --help version        Show version information
  yarn start --help manual         Show detailed manual
`);
            return true;
        } catch (error) {
            log.error('Error showing usage:', error);
            return false;
        }
    }

    /**
     * Show version information
     * @method showVersion
     * @returns {Promise<boolean>} True if successful
     */
    async showVersion() {
        try {
            console.log(`
Version Information:
  Mode: ${process.env.NODE_ENV || 'production'}
  Electron: ${process.versions.electron}
  Chrome: ${process.versions.chrome}
  Node: ${process.versions.node}
  V8: ${process.versions.v8}
`);
            return true;
        } catch (error) {
            log.error('Error showing version:', error);
            return false;
        }
    }

    /**
     * Show detailed manual
     * @method showManual
     * @returns {Promise<boolean>} True if successful
     */
    async showManual() {
        try {
            console.log(`
DESCRIPTION
  The application provides a CLI interface for managing multiple instances
  of messaging applications. It supports various providers and profiles.

COMMANDS
  help                    Display help information
  version                Display version information
  manual                 Display this manual
  profiles               Manage application profiles
  provider               Control service providers

ENVIRONMENT
  NODE_ENV               Runtime environment (development, production, test)
  LOG_LEVEL             Logging verbosity level
  USER_DATA_PATH        Path to user data directory

FILES
  config.json           Application configuration
  profiles.json         Profile definitions
  providers.json        Provider configurations

SEE ALSO
  For more information, visit the documentation at:
  https://github.com/st0nebridge/whatsapp-desktop
`);
            return true;
        } catch (error) {
            log.error('Error showing manual:', error);
            return false;
        }
    }
}

module.exports = HelpCLI;
