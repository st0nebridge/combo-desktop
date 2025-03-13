/**
 * @file CLI entry point that initializes and manages CLI modules.
 * Follows auto-registration pattern for CLI modules.
 */

const fs = require('fs');
const path = require('path');
const log = require('electron-log');
const cliRegistry = require('./cli.registry');

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
            .filter(file => file.endsWith('-cli.js') && file !== 'base-cli.js');

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
 * @returns {Promise<{success: boolean, isCliCommand: boolean, processedProviders: Array<string>}>} Command execution result
 */
async function execute(args) {
    try {
        // Initialize modules first
        await initModules();

        // Show help if no arguments provided
        if (!args || args.length === 0) {
            cliRegistry.showHelp();
            return { success: true, isCliCommand: true, processedProviders: [] };
        }

        // Remove electron and script path from args if present
        const cliArgs = args.slice(process.defaultApp ? 2 : 1);
        log.debug('Command line arguments:', cliArgs);

        // Execute command through registry
        const result = await cliRegistry.execute(cliArgs);
        if (!result.success) {
            log.error('CLI command failed');
            cliRegistry.showHelp();
            process.exit(1);
        }

        return result;
    } catch (error) {
        log.error('Error executing CLI command:', error);
        cliRegistry.showHelp();
        process.exit(1);
    }
}

// Export functions for external use
module.exports = {
    initModules,
    execute
};
