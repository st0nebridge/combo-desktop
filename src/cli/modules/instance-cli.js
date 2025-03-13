/**
 * @module InstanceCLI
 * @description CLI module for managing application instances.
 * Handles instance creation, locking, and management.
 */

const BaseCLI = require('../abstract/base-cli');
const log = require('electron-log');
const instanceManager = require('../../services/instance.manager');

/**
 * CLI module for managing application instances.
 * Extends BaseCLI to provide instance management functionality:
 * - Instance creation and termination
 * - Instance lock management
 * - Instance status and information
 * @class InstanceCLI
 * @extends {BaseCLI}
 */
class InstanceCLI extends BaseCLI {
    /**
     * Creates a new InstanceCLI instance
     * @constructor
     */
    constructor() {
        super();
        
        // Define entry flag for instance commands
        this.entryFlag = 'instance';

        // Bind command functions using .bind() pattern for command mapping
        this.commands = {
            'reset-lock': this.resetLock.bind(this),
            'new': this.createNewInstance.bind(this)
        };
    }

    /**
     * Parse instance-specific command line arguments
     * @method parseArgs
     * @param {Object} args - Command line arguments
     * @returns {Object|null} Parsed arguments or null if no instance flags found
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
                    args: {
                        force: args.force || false
                    }
                };
            }

            // If no valid subcommand but entry flag is present, show usage
            this.showUsage();
            return null;
        } catch (error) {
            log.error('Error parsing instance arguments:', error);
            return null;
        }
    }

    /**
     * Execute instance-specific commands based on parsed arguments
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
            log.error('Error executing instance command:', error);
            return false;
        }
    }

    /**
     * Show usage information for the instance module
     * @method showUsage
     */
    showUsage() {
        console.log(`
Instance Management Commands:
  --instance reset-lock [--force]     Reset instance lock
  --instance new                      Create a new application instance

Options:
  --force                          Force operation without confirmation

Examples:
  yarn start --instance reset-lock    Reset instance lock
  yarn start --instance new           Create a new instance
`);
    }

    /**
     * Reset the instance lock
     * @method resetLock
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if lock reset successful
     */
    async resetLock(args) {
        try {
            log.info('Resetting instance lock');
            const force = args.force || false;
            
            if (!force) {
                console.log('Warning: Resetting the instance lock can cause issues if other instances are running.');
                console.log('Use --force to bypass this warning.');
                return false;
            }
            
            await instanceManager.resetLock();
            console.log('Instance lock has been reset successfully.');
            return true;
        } catch (error) {
            log.error('Error resetting instance lock:', error);
            return false;
        }
    }

    /**
     * Create a new application instance
     * @method createNewInstance
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if instance creation successful
     */
    async createNewInstance(args) {
        try {
            log.info('Creating new application instance');
            await instanceManager.createNewInstance();
            console.log('New instance created successfully.');
            return true;
        } catch (error) {
            log.error('Error creating new instance:', error);
            return false;
        }
    }
}

module.exports = InstanceCLI;
