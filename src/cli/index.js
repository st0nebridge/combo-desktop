/**
 * @file CLI entry point that handles module registration and command execution
 */

const fs = require('fs');
const path = require('path');
const log = require('electron-log');
const cliRegistry = require('./cli.registry');
global.cliRegistry = cliRegistry;

// Track if modules have been initialized
let modulesInitialized = false;

/**
 * Initialize CLI modules using auto-registration pattern
 * @returns {Promise<boolean>} True if initialization successful
 */
async function initModules() {
    try {
        // Skip if already initialized
        if (modulesInitialized) {
            log.debug('CLI modules already initialized, skipping duplicate initialization');
            return true;
        }
        
        log.info('Initializing CLI modules');

        // Clear existing modules
        cliRegistry.clear();

        // Auto-register modules from modules directory
        const modulesDir = path.join(__dirname, 'modules');
        const moduleFiles = fs.readdirSync(modulesDir)
            .filter(file => file.endsWith('-cli.js'));

        // Track registered modules to prevent duplicates
        const registeredModules = new Set();

        for (const file of moduleFiles) {
            try {
                // Skip if already registered
                if (registeredModules.has(file)) {
                    log.debug(`CLI module ${file} already registered, skipping`);
                    continue;
                }

                const ModuleClass = require(path.join(modulesDir, file));
                const instance = new ModuleClass();
                
                // Register module with the registry
                const success = cliRegistry.register(instance);
                
                if (success) {
                    // Track successful registrations
                    registeredModules.add(file);
                    log.info(`Auto-registered CLI module: ${instance.constructor.name}`);
                }
            } catch (error) {
                log.error(`Error loading CLI module ${file}:`, error);
                // Continue with other modules instead of throwing
                // This ensures one bad module doesn't prevent others from loading
            }
        }

        log.info('CLI modules initialized');
        modulesInitialized = true;
        return true;
    } catch (error) {
        log.error('Error initializing CLI modules:', error);
        throw error;
    }
}

/**
 * Execute CLI command with provided arguments
 * @param {Array<string>} args - Command line arguments
 * @returns {Promise<{success: boolean, continueExecution: boolean, isCliCommand: boolean, processedProviders: Array<string>, context: Object}>} Command execution result
 */
async function execute(args) {
    try {
        // Execute command through registry
        const result = await cliRegistry.execute(args);
        
        if (!result.success) {
            log.error('CLI command failed');
            cliRegistry.showHelp();
        }

        return result;
    } catch (error) {
        log.error('Error executing CLI command:', error);
        cliRegistry.showHelp();
        return {
            success: false,
            isCliCommand: false,
            processedProviders: [],
            continueExecution: false,
            context: {}
        };
    }
}

// Initialize modules first
initModules();

// Export functions for external use
module.exports = {
    execute
};
