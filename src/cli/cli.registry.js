/**
 * @file CLI Registry that manages CLI modules and command execution
 */

const log = require('../services/logging.service');

/**
 * CLI Registry that manages CLI modules and command execution
 * @class CLIRegistry
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
        log.info('CLI Registry initialized');
    }

    /**
     * Clear all registered modules
     * @method clear
     */
    clear() {
        this.modules.clear();
        this.initialized = false;
        log.debug('CLI Registry cleared');
    }

    /**
     * Register a CLI module
     * @method register
     * @param {Object} module - CLI module to register
     * @returns {boolean} True if registration successful
     */
    register(module) {
        try {
            // Validate module
            if (!module) {
                log.error('Cannot register null or undefined module');
                return false;
            }

            // Check if module has required methods
            const requiredMethods = ['execute', 'canHandle', 'showUsage', 'isCliCommand'];
            for (const method of requiredMethods) {
                if (typeof module[method] !== 'function') {
                    log.error(`Module ${module.constructor.name} is missing required method: ${method}`);
                    return false;
                }
            }

            // Get module name
            const moduleName = module.constructor.name;
            
            // Check if module is already registered
            if (this.modules.has(moduleName)) {
                log.warn(`Module ${moduleName} is already registered`);
                return false;
            }

            // Register module
            this.modules.set(moduleName, module);
            log.info(`Registered CLI module: ${moduleName}`);
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
     * @returns {Promise<{success: boolean, isCliCommand: boolean, continueExecution: boolean}>}
     */
    async execute(args) {
        try {
            if (!args || args.length === 0) {
                log.debug('No arguments provided, showing help');
                this.showHelp();
                return { 
                    success: true, 
                    isCliCommand: true,
                    continueExecution: false
                };
            }

            log.debug('Processing command line arguments:', args);

            // Track processed providers and execution state
            const result = {
                success: true,
                isCliCommand: false,
                continueExecution: true
            };

            // Create execution context that can be passed between modules
            let executionContext = {};
            
            // Try each module to see if it can handle the command
            for (const [_, module] of this.modules) {
                try {
                    // Check if module can handle these arguments
                    if (module.canHandle(args)) {
                        log.info(`Module ${module.constructor.name} can handle the command`);
                        
                        // Execute the module with the arguments and context
                        const moduleResult = await module.execute(args, executionContext);
                        
                        // Update the execution context with module result
                        executionContext = {
                            ...moduleResult.context,
                            ...executionContext
                        };
                        
                        // Check if this is a CLI command
                        if (module.isCliCommand()) {
                            result.isCliCommand = true;
                        }
                        
                        // Check if we should continue execution
                        if (moduleResult.continueExecution === false) {
                            result.continueExecution = false;
                            break;
                        }
                    }
                } catch (error) {
                    log.error(`Error executing CLI module ${module.constructor.name}:`, error);
                }
            }

            // Add the execution context to the result
            result.context = executionContext;
            
            return result;
        } catch (error) {
            log.error('Error executing CLI command:', error);
            return { 
                success: false, 
                isCliCommand: false,
                continueExecution: false
            };
        }
    }

    /**
     * Show help information for all modules
     * @method showHelp
     */
    showHelp() {
        console.log('Available commands:');
        console.log('--help                 Show this help message');
        console.log('--version              Show version information');
        
        // Show help for each module
        for (const [_, module] of this.modules) {
            try {
                module.showUsage();
            } catch (error) {
                log.error(`Error showing usage for module ${module.constructor.name}:`, error);
            }
        }
    }
}

// Export singleton instance
module.exports = new CLIRegistry();
