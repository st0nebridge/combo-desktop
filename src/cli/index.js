/**
 * @module cli
 * @description CLI entry point that handles module registration and command execution.
 * Implements auto-discovery pattern for CLI modules in the modules directory.
 * 
 * @input {Array<string>} args - Command line arguments
 * @output {Object} result - Execution result with success, continueExecution, and context
 * 
 * @dependencies
 * - cli/cli.registry - Module registration and dispatch
 * - cli/modules/* - Individual CLI command modules
 * 
 * @example
 * const cli = require('./cli');
 * await cli.initialize();
 * const result = await cli.execute(['--help']);
 * if (result.continueExecution) { ... }
 */

const fs = require('fs');
const path = require('path');
const log = require('electron-log');
const cliRegistry = require('./cli.registry');

// Track initialization state
let modulesInitialized = false;
let initializationPromise = null;
const INIT_TIMEOUT_MS = 10000;

/**
 * Initialize CLI modules using auto-registration pattern
 * @function initModules
 * @returns {Promise<boolean>} True if initialization successful
 * @throws {Error} If initialization fails or times out
 */
async function initModules() {
    try {
        // Skip if already initialized
        if (modulesInitialized) {
            log.debug('CLI modules already initialized, skipping duplicate initialization');
            return true;
        }

        // Return existing initialization promise if already in progress
        if (initializationPromise) {
            log.debug('CLI modules initialization in progress, waiting for completion');
            return await initializationPromise;
        }
        
        // Create initialization promise with timeout protection
        initializationPromise = (async () => {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('CLI module initialization timed out')), INIT_TIMEOUT_MS);
            });

            const initPromise = (async () => {
                log.info('Initializing CLI modules');

                // Clear existing modules
                cliRegistry.clear();

                // Auto-register modules from modules directory
                const modulesDir = path.join(__dirname, 'modules');
                
                // Validate modules directory exists
                if (!fs.existsSync(modulesDir)) {
                    throw new Error(`Modules directory not found: ${modulesDir}`);
                }

                const moduleFiles = fs.readdirSync(modulesDir)
                    .filter(file => file.endsWith('-cli.js'));

                if (moduleFiles.length === 0) {
                    log.warn('No CLI modules found in modules directory');
                }

                // Track registered modules to prevent duplicates
                const registeredModules = new Set();
                let successCount = 0;
                let failureCount = 0;

                for (const file of moduleFiles) {
                    try {
                        // Skip if already registered
                        if (registeredModules.has(file)) {
                            log.debug(`CLI module ${file} already registered, skipping`);
                            continue;
                        }

                        const modulePath = path.join(modulesDir, file);
                        const ModuleClass = require(modulePath);
                        
                        // Validate ModuleClass is a constructor
                        if (typeof ModuleClass !== 'function') {
                            throw new Error(`Module ${file} does not export a class`);
                        }

                        const instance = new ModuleClass();
                        
                        // Register module with the registry
                        const success = cliRegistry.register(instance);
                        
                        if (success) {
                            // Track successful registrations
                            registeredModules.add(file);
                            successCount++;
                            log.info(`Auto-registered CLI module: ${instance.constructor.name}`);
                        } else {
                            failureCount++;
                            log.warn(`Failed to register CLI module: ${file}`);
                        }
                    } catch (error) {
                        failureCount++;
                        log.error(`Error loading CLI module ${file}:`, error);
                        // Continue with other modules instead of throwing
                        // This ensures one bad module doesn't prevent others from loading
                    }
                }

                log.info(`CLI modules initialized: ${successCount} successful, ${failureCount} failed`);
                modulesInitialized = true;
                return true;
            })();

            return await Promise.race([initPromise, timeoutPromise]);
        })();

        return await initializationPromise;
    } catch (error) {
        log.error('Error initializing CLI modules:', error);
        initializationPromise = null; // Reset so retry is possible
        throw error;
    }
}

/**
 * Execute CLI command with provided arguments
 * @function execute
 * @param {Array<string>} args - Command line arguments
 * @returns {Promise<{success: boolean, continueExecution: boolean, isCliCommand: boolean, processedProviders: Array<string>, context: Object}>} Command execution result
 * @throws {Error} If args parameter is invalid
 */
async function execute(args) {
    try {
        // Validate args parameter
        if (!Array.isArray(args)) {
            throw new Error('Args parameter must be an array');
        }

        // Ensure modules are initialized before execution
        if (!modulesInitialized) {
            log.debug('CLI modules not initialized, initializing now');
            await initModules();
        }
        
        // Execute command through registry
        const result = await cliRegistry.execute(args);
        
        if (!result.success) {
            log.error('CLI command execution failed');
            cliRegistry.showHelp();
        }

        return result;
    } catch (error) {
        log.error('Error executing CLI command:', error.message, error.stack);
        cliRegistry.showHelp();
        return {
            success: false,
            isCliCommand: false,
            processedProviders: [],
            continueExecution: false,
            context: {},
            error: error.message
        };
    }
}

/**
 * Initialize CLI system manually (useful for testing)
 * @function initialize
 * @returns {Promise<boolean>} True if initialization successful
 */
async function initialize() {
    return await initModules();
}

/**
 * Reset CLI system state (useful for testing and cleanup)
 * @function reset
 */
function reset() {
    log.info('Resetting CLI system');
    modulesInitialized = false;
    initializationPromise = null;
    cliRegistry.clear();
}

/**
 * Check if CLI modules are initialized
 * @function isInitialized
 * @returns {boolean} True if modules are initialized
 */
function isInitialized() {
    return modulesInitialized;
}

/**
 * Get reference to CLI registry (for advanced usage)
 * @function getRegistry
 * @returns {Object} CLI registry instance
 */
function getRegistry() {
    return cliRegistry;
}

// Auto-initialize modules on module load
// This maintains backward compatibility with existing code
initModules().catch(error => {
    log.error('Failed to auto-initialize CLI modules:', error);
});

// Export functions for external use
module.exports = {
    execute,
    initialize,
    initModules,
    reset,
    isInitialized,
    getRegistry
};
