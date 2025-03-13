/**
 * @file CLI Registry that manages CLI modules and command execution
 */

const log = require('../services/logging.service');

/**
 * CLI Registry that manages CLI modules and command execution
 */
class CLIRegistry {
    /**
     * Creates a new CLIRegistry instance
     * @constructor
     */
    constructor() {
        /** @type {Map<string, Object>} */
        this.modules = new Map();
        this.initialized = false;
        this.lastParsedArgs = null;
        log.info('CLI Registry initialized');
    }

    /**
     * Clear all registered modules
     * @method clear
     */
    clear() {
        this.modules.clear();
        this.lastParsedArgs = null;
        log.info('CLI Registry cleared');
    }

    /**
     * Register a CLI module
     * @method register
     * @param {Object} module - CLI module to register
     * @returns {boolean} True if registration successful
     */
    register(module) {
        try {
            if (!module || typeof module !== 'object') {
                log.error('Invalid CLI module: module must be an object');
                return false;
            }

            const requiredMethods = ['execute', 'parseArgs', 'showUsage'];
            const missingMethods = requiredMethods.filter(
                method => !module[method] || typeof module[method] !== 'function'
            );

            if (missingMethods.length > 0) {
                log.error(`Invalid CLI module: missing required methods: ${missingMethods.join(', ')}`);
                return false;
            }

            const name = module.constructor.name;
            if (!name) {
                log.error('Invalid CLI module: missing constructor name');
                return false;
            }

            this.modules.set(name, module);
            log.info(`Registered CLI module: ${name}`);
            return true;
        } catch (error) {
            log.error('Error registering CLI module:', error);
            return false;
        }
    }

    /**
     * Execute CLI command with given arguments
     * @method execute
     * @param {Array<string>} args - Command line arguments
     * @returns {Promise<{success: boolean, isCliCommand: boolean, processedProviders: Array<string>}>}
     */
    async execute(args) {
        if (!args || args.length === 0) {
            log.warn('No arguments to process');
            return { success: false, isCliCommand: true, processedProviders: [] };
        }

        try {
            // Remove electron and script path from args if present
            const cliArgs = args.slice(process.defaultApp ? 2 : 1);
            log.debug('CLI arguments:', cliArgs);

            // Check for help flag first
            if (cliArgs.includes('--help') || cliArgs.includes('--manual')) {
                this.showHelp();
                return { success: true, isCliCommand: true, processedProviders: [] };
            }

            // Initialize instance manager
            const instanceManager = require('../services/instance.manager');
            await instanceManager.ensureDirectories();

            // Track if any module successfully handled arguments
            let anySuccess = false;
            let isCliCommand = true;
            let processedProviders = [];
            
            // Process all provider flags by checking all modules
            for (const [name, module] of this.modules) {
                try {
                    const result = await module.parseArgs(cliArgs);
                    if (result) {
                        log.info(`CLI command detected in module: ${name}`);
                        
                        // Store parsed args for app initialization
                        this.lastParsedArgs = result;

                        // Execute command
                        const success = await module.execute(result);
                        if (success) {
                            anySuccess = true;
                            // If any module is not a CLI command, mark the overall result as not a CLI command
                            if (module.isCliCommand && typeof module.isCliCommand === 'function') {
                                isCliCommand = isCliCommand && module.isCliCommand();
                            }
                            
                            // Track processed providers
                            if (result.providers && Array.isArray(result.providers)) {
                                processedProviders = processedProviders.concat(result.providers);
                            }
                        } else {
                            log.error(`Command execution failed in module: ${name}`);
                        }
                    }
                } catch (error) {
                    log.error(`Error in module ${name}:`, error);
                    // Continue with other modules instead of throwing
                    log.warn(`Continuing with other modules after error in ${name}`);
                }
            }

            if (anySuccess) {
                log.info('CLI commands completed successfully');
                return { success: true, isCliCommand, processedProviders };
            }

            log.warn('No module found to handle arguments:', cliArgs);
            return { success: false, isCliCommand: true, processedProviders: [] };
        } catch (error) {
            log.error('Error executing CLI command:', error);
            throw error;
        }
    }

    /**
     * Get last successfully parsed arguments
     * @method getLastParsedArgs
     * @returns {Object|null} Last parsed arguments or null if none
     */
    getLastParsedArgs() {
        return this.lastParsedArgs;
    }

    /**
     * Show help for all registered modules
     * @method showHelp
     */
    showHelp() {
        log.info('\nAvailable commands:');
        for (const [name, module] of this.modules) {
            if (module.showUsage) {
                module.showUsage();
            }
        }
    }
}

// Export singleton instance
module.exports = new CLIRegistry();
