/**
 * @file CLI Registry that manages registration and execution of CLI modules.
 * Handles module registration, command detection, and argument parsing.
 */

const log = require('electron-log');

/**
 * Registry for managing CLI modules and their execution.
 * Provides functionality for registering modules, executing commands,
 * and managing parsed arguments.
 * @class CLIRegistry
 */
class CLIRegistry {
    /**
     * Creates a new CLIRegistry instance
     * @constructor
     */
    constructor() {
        /** @property {Map<string, Class>} modules - Map of registered CLI modules */
        this.modules = new Map();
        
        /** @property {Object|null} lastParsedArgs - Last successfully parsed arguments */
        this.lastParsedArgs = null;
        
        /** @property {Set<string>} registeredModules - Set of registered module names */
        this.registeredModules = new Set();
        
        log.info('CLI Registry initialized');
    }

    /**
     * Register a CLI module for command processing
     * @method register
     * @param {Class} ModuleClass - CLI module class to register
     * @returns {boolean} True if registration successful
     * @throws {Error} If module validation fails
     */
    register(ModuleClass) {
        try {
            if (!ModuleClass || !ModuleClass.name) {
                log.error('Invalid CLI module class');
                return false;
            }

            const moduleName = ModuleClass.name;
            
            // Check if module is already registered
            if (this.registeredModules.has(moduleName)) {
                return false;
            }

            // Create instance to validate module
            const instance = new ModuleClass();
            if (typeof instance.parseArgs !== 'function') {
                log.error(`CLI module ${moduleName} missing required parseArgs method`);
                return false;
            }

            // Register module
            this.modules.set(moduleName, ModuleClass);
            this.registeredModules.add(moduleName);
            log.info(`Registered CLI module: ${moduleName}`);
            return true;
        } catch (error) {
            log.error('Error registering CLI module:', error);
            return false;
        }
    }

    /**
     * Check if command line arguments represent a CLI command
     * that shouldn't register a PID
     * @method isCliCommand
     * @param {Array<string>} args - Command line arguments
     * @returns {boolean} True if this is a CLI command
     */
    isCliCommand(args) {
        if (!args || !Array.isArray(args)) {
            return false;
        }

        for (const [name, ModuleClass] of this.modules.entries()) {
            try {
                const instance = new ModuleClass();
                instance.args = args;
                
                if (instance.isCliCommand && instance.isCliCommand()) {
                    log.info(`CLI command detected in module: ${name}`);
                    return true;
                }
            } catch (error) {
                log.error(`Error checking CLI command in module ${name}:`, error);
            }
        }
        return false;
    }

    /**
     * Execute CLI arguments through all registered modules
     * @method execute
     * @param {Array<string>} args - Command line arguments
     * @returns {Object} Combined parsed arguments from all modules
     * @throws {Error} If argument parsing fails
     */
    execute(args) {
        if (!args || !Array.isArray(args)) {
            log.info('No valid CLI arguments to execute');
            return {};
        }

        let parsedArgs = {};
        for (const [name, ModuleClass] of this.modules.entries()) {
            try {
                const instance = new ModuleClass();
                instance.args = args;
                
                const result = instance.parseArgs();
                if (result && typeof result === 'object') {
                    parsedArgs = { ...parsedArgs, ...result };
                }
            } catch (error) {
                log.error(`Error executing CLI module ${name}:`, error);
            }
        }

        // Store the parsed arguments
        this.lastParsedArgs = parsedArgs;
        log.debug('Parsed CLI arguments:', parsedArgs);
        return parsedArgs;
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
     * Clear all registered modules and cached arguments
     * @method clear
     */
    clear() {
        this.modules.clear();
        this.registeredModules.clear();
        this.lastParsedArgs = null;
        log.info('CLI Registry cleared');
    }
}

// Export singleton instance
module.exports = new CLIRegistry();
