/**
 * CLI module for managing application instances.
 * Handles instance lifecycle, locking, and process management.
 * Extends BaseCLI to provide instance management functionality:
 * - Instance lock management (reset-lock)
 * - Instance creation (new-instance)
 * @class InstanceCLI
 * @extends {BaseCLI}
 */

const log = require('electron-log');
const BaseCLI = require('../abstract/base-cli');
const instanceManager = require('../../services/instance.manager');

class InstanceCLI extends BaseCLI {
    /**
     * Creates a new InstanceCLI instance and initializes command mapping
     * @constructor
     */
    constructor() {
        super();

        // Define command map according to CLI module rules
        this.commands = {
            'reset-lock': this.resetLock.bind(this),
            'new-instance': this.createNewInstance.bind(this)
        };
    }

    /**
     * Parse command line arguments for instance management.
     * Follows command mapping pattern to identify and handle instance-specific commands.
     * @method parseArgs
     * @param {Object} args - Command line arguments
     * @returns {Object|null} Parsed arguments if this module can handle them, null otherwise
     */
    async parseArgs(args) {
        try {
            // Check if any of our commands are present
            for (const [command, handler] of Object.entries(this.commands)) {
                if (args[command]) {
                    return {
                        command,
                        handler,
                        args
                    };
                }
            }

            return null;
        } catch (error) {
            log.error('Error parsing instance arguments:', error);
            throw error;
        }
    }

    /**
     * Execute the parsed command using the command mapping pattern.
     * Delegates execution to the appropriate command handler.
     * @method execute
     * @param {Object} args - Parsed arguments from parseArgs
     * @returns {Promise<boolean>} True if command executed successfully
     */
    async execute(args) {
        try {
            if (!args || !args.command || !args.handler) {
                return false;
            }

            // Execute the command handler
            return await args.handler();
        } catch (error) {
            log.error('Error executing instance command:', error);
            throw error;
        }
    }

    /**
     * Check if command is a CLI command that shouldn't register a PID.
     * All instance commands are CLI commands and don't require PID registration.
     * @method isCliCommand
     * @returns {boolean} True if this is a CLI command
     */
    isCliCommand() {
        return true;
    }

    /**
     * Show basic usage information and available commands.
     * Provides help text for all supported instance management commands.
     * @method showUsage
     */
    showUsage() {
        console.log('\nInstance Management Commands:');
        console.log('  --reset-lock       Reset instance lock and terminate running instances');
        console.log('  --new-instance     Force creation of a new instance');
        console.log();
    }

    /**
     * Reset the instance lock file and terminate all running instances.
     * Delegates to instance manager for proper lock handling and process termination.
     * @method resetLock
     * @throws {Error} If unable to read PID file, terminate processes, or remove lock files
     * @returns {Promise<boolean>} True if reset was successful
     */
    async resetLock() {
        try {
            await instanceManager.resetLock();
            return true;
        } catch (error) {
            log.error('Error resetting instance lock:', error);
            throw error;
        }
    }

    /**
     * Create a new instance of the application.
     * Forces creation of a new instance regardless of existing instances.
     * @method createNewInstance
     * @throws {Error} If unable to create new instance
     * @returns {Promise<boolean>} True if instance was created successfully
     */
    async createNewInstance() {
        try {
            // TO DO: Implement createNewInstance logic
            log.info('Creating new instance...');
            return true;
        } catch (error) {
            log.error('Error creating new instance:', error);
            throw error;
        }
    }
}

module.exports = InstanceCLI;
