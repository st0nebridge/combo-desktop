/**
 * @file CLI Registry that manages registration and execution of CLI modules.
 * Handles module registration, command detection, and argument parsing.
 */

const logger = require('../services/logging.service');

/**
 * Registry for CLI modules that handles registration and execution of commands.
 * Follows the command mapping pattern for CLI modules.
 * @class CLIRegistry
 */
class CLIRegistry {
    /**
     * Creates a new CLIRegistry instance
     * @constructor
     */
    constructor() {
        /** @property {Array<Object>} instances - Array of registered module instances */
        this.instances = [];
        
        /** @property {Set<string>} registeredModules - Set of registered module names */
        this.registeredModules = new Set();

        /** @property {Object|null} lastParsedArgs - Last successfully parsed arguments */
        this.lastParsedArgs = null;
        
        logger.info('CLI Registry initialized');
    }

    /**
     * Register a CLI module
     * @method register
     * @param {string} moduleName - Name of the module to register
     * @param {Function} ModuleClass - Module class constructor
     * @param {Object} instance - Module instance
     * @returns {boolean} True if registration was successful
     */
    register(moduleName, ModuleClass, instance) {
        try {
            if (!moduleName || !ModuleClass || !instance) {
                logger.error('Invalid CLI module registration parameters');
                return false;
            }

            // Validate module follows command mapping pattern
            if (!instance.parseArgs || !instance.execute || !instance.showUsage) {
                logger.error('Invalid CLI module class - missing required methods');
                return false;
            }

            // Add to registry
            this.instances.push(instance);
            this.registeredModules.add(moduleName);
            logger.info(`Registered CLI module: ${instance.constructor.name}`);
            return true;
        } catch (error) {
            logger.error('Error registering CLI module:', error);
            return false;
        }
    }

    /**
     * Execute CLI arguments through all registered modules
     * @method execute
     * @param {Array<string>} args - Command line arguments
     * @returns {Promise<{success: boolean, isCliCommand: boolean}>} Result object with success and command type
     */
    async execute(args) {
        try {
            if (!args || args.length === 0) {
                logger.warn('No arguments to execute');
                return { success: false, isCliCommand: true };
            }

            // Remove electron and script path from args if present
            const cliArgs = args.slice(process.defaultApp ? 2 : 1);
            logger.debug('CLI arguments:', cliArgs);

            // Check for help flag first
            if (cliArgs.includes('--help') || cliArgs.includes('--manual')) {
                this.showHelp();
                return { success: true, isCliCommand: true };
            }

            // Initialize instance manager first
            const instanceManager = require('../services/instance.manager');
            try {
                await instanceManager.ensureDirectories();
            } catch (error) {
                logger.error('Failed to initialize instance directories:', error);
                throw error;
            }

            // Find module that can handle these arguments
            for (const instance of this.instances) {
                try {
                    const result = await instance.parseArgs(cliArgs);
                    if (result) {
                        logger.info(`CLI command detected in module: ${instance.constructor.name}`);
                        
                        // Store parsed args for app initialization
                        this.lastParsedArgs = result;

                        // Handle instance registration before execution
                        try {
                            const registered = await instanceManager.handleInstanceRegistration(result);
                            if (!registered) {
                                logger.error('Failed to register instance');
                                return { success: false, isCliCommand: instance.isCliCommand() };
                            }
                        } catch (error) {
                            logger.error('Instance registration error:', error);
                            throw error;
                        }

                        // Execute command if module has execute method
                        if (instance.execute) {
                            const success = await instance.execute(result);
                            if (!success) {
                                logger.error(`Command execution failed in module: ${instance.constructor.name}`);
                                return { success: false, isCliCommand: instance.isCliCommand() };
                            }
                            logger.info('CLI command completed successfully');
                            return { success: true, isCliCommand: instance.isCliCommand() };
                        }
                    }
                } catch (error) {
                    logger.error(`Error in module ${instance.constructor.name}:`, error);
                    throw error;
                }
            }

            logger.warn('No module found to handle arguments:', cliArgs);
            return { success: false, isCliCommand: true };
        } catch (error) {
            logger.error('Error executing CLI arguments:', error);
            throw error;
        }
    }

    /**
     * Get the last parsed CLI arguments
     * @method getLastParsedArgs
     * @returns {Object|null} Last parsed arguments or null if none
     */
    getLastParsedArgs() {
        return this.lastParsedArgs;
    }

    /**
     * Clear all registered modules
     * @method clear
     */
    clear() {
        this.instances = [];
        this.registeredModules.clear();
        this.lastParsedArgs = null;
        logger.info('CLI Registry cleared');
    }

    /**
     * Show help for all registered modules
     * @method showHelp
     */
    showHelp() {
        logger.info('\nAvailable commands:');
        for (const instance of this.instances) {
            if (instance.showUsage) {
                instance.showUsage();
            }
        }
    }
}

// Export singleton instance
module.exports = new CLIRegistry();
