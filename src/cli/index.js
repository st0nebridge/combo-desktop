/**
 * @file CLI entry point that initializes and manages CLI modules.
 * Follows auto-registration pattern for CLI modules.
 */

const fs = require('fs');
const path = require('path');
const log = require('electron-log');
const cliRegistry = require('./cli.registry');

/**
 * Initialize CLI modules using auto-registration pattern
 * @returns {Promise<boolean>} True if initialization successful
 */
async function initModules() {
    try {
        log.info('Initializing CLI modules');

        // Clear existing modules
        cliRegistry.clear();

        // Auto-register modules from modules directory
        const modulesDir = path.join(__dirname, 'modules');
        const moduleFiles = fs.readdirSync(modulesDir)
            .filter(file => file.endsWith('-cli.js') && file !== 'base-cli.js');

        for (const file of moduleFiles) {
            try {
                const ModuleClass = require(path.join(modulesDir, file));
                const instance = new ModuleClass();
                cliRegistry.register(file, ModuleClass, instance);
                log.info(`Auto-registered CLI module: ${file}`);
            } catch (error) {
                log.error(`Error loading CLI module ${file}:`, error);
                throw error;
            }
        }

        log.info('CLI modules initialized');
        return true;
    } catch (error) {
        log.error('Error initializing CLI modules:', error);
        throw error;
    }
}

/**
 * Execute CLI command with provided arguments
 * @param {Array<string>} args - Command line arguments
 * @returns {Promise<boolean>} True if command executed successfully
 */
async function execute(args) {
    try {
        // Initialize modules first
        await initModules();

        // Execute command through registry
        const success = await cliRegistry.execute(args);
        if (!success) {
            log.error('CLI command failed');
            process.exit(1);
        }

        return success;
    } catch (error) {
        log.error('Error executing CLI command:', error);
        process.exit(1);
    }
}

// Export functions for external use
module.exports = {
    initModules,
    execute
};
