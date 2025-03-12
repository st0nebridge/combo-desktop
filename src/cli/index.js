/**
 * @file CLI module initialization and command processing. Handles auto-discovery and registration
 * of CLI modules, and processes command line arguments.
 */

const fs = require('fs');
const path = require('path');
const log = require('electron-log');
const { app } = require('electron');
const registry = require('./cli.registry');

/**
 * Initialize CLI modules by auto-discovering and registering them with the registry.
 * Scans the modules directory for files ending in -cli.js and registers each valid module.
 * @function initCLI
 * @throws {Error} If there's an error initializing the CLI modules
 */
function initCLI() {
    try {
        log.info('Initializing CLI modules');
        
        // Clear existing registrations
        registry.clear();
        
        // Auto-discover and register CLI modules
        const modulesDir = path.join(__dirname, 'modules');
        const modules = fs.readdirSync(modulesDir)
            .filter(file => file.endsWith('-cli.js') && file !== 'base-cli.js')
            .map(file => {
                try {
                    const ModuleClass = require(path.join(modulesDir, file));
                    const instance = new ModuleClass();
                    if (registry.register(ModuleClass)) {
                        log.info(`Auto-registered CLI module: ${file}`);
                    }
                    return instance;
                } catch (error) {
                    log.error(`Failed to load CLI module ${file}:`, error);
                    return null;
                }
            })
            .filter(Boolean); // Remove any failed modules
        
        log.info('CLI modules initialized');
    } catch (error) {
        log.error('Error initializing CLI modules:', error);
        throw error;
    }
}

/**
 * Process command line arguments and execute the appropriate CLI command.
 * Handles argument parsing, validation, and command execution through the registry.
 * @function processArgs
 * @returns {boolean} True if this is a CLI command that shouldn't register a PID
 * @throws {Error} If argument parsing fails or command execution fails
 */
function processArgs() {
    try {
        log.info('Processing command line arguments');
        
        // Get command line arguments (skip electron/node executable and script path)
        const args = process.argv.slice(process.defaultApp ? 2 : 1);
        log.debug('CLI arguments:', args);
        
        if (!args || args.length === 0) {
            log.info('No CLI arguments provided');
            return false;
        }
        
        // Check if this is a CLI command that shouldn't register a PID
        const isCliCommand = registry.isCliCommand(args);
        
        // Execute the command
        const parsedArgs = registry.execute(args);
        
        // Validate parsed arguments
        if (!parsedArgs || typeof parsedArgs !== 'object') {
            log.error('Invalid parsed arguments');
            throw new Error('Failed to parse CLI arguments');
        }
        
        return isCliCommand;
    } catch (error) {
        log.error('Error processing command line arguments:', error);
        console.error('Error:', error.message);
        app.exit(1);
        return true; // Prevent app from continuing
    }
}

module.exports = {
    initCLI,
    processArgs
};
