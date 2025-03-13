/**
 * Main entry point for the application.
 * Handles initialization and command line argument processing.
 */

const { app } = require('electron');
const log = require('electron-log');
const appManager = require('./services/app.manager');

/**
 * Initialize the application environment
 * @returns {Promise<boolean>} True if initialization successful
 */
async function initializeEnvironment() {
    try {
        // Ensure app name is set
        if (!app.name) {
            const packageJson = require('../package.json');
            app.name = packageJson.name;
        }

        // Initialize instance manager
        const instanceManager = require('./services/instance.manager');
        await instanceManager.ensureDirectories();

        return true;
    } catch (error) {
        log.error('Failed to initialize environment:', error);
        return false;
    }
}

/**
 * Main function that initializes the application and processes command line arguments
 * @returns {Promise<void>}
 */
async function main() {
    try {
        log.info('Application starting...');

        // Initialize environment first
        const envInit = await initializeEnvironment();
        if (!envInit) {
            log.error('Failed to initialize environment');
            app.exit(1);
            return;
        }
        
        // Initialize CLI modules
        log.info('Initializing CLI modules');
        const cli = require('./cli');
        
        // Get command line arguments (skip electron/node executable and script path)
        const args = process.argv;
        
        try {
            // Process arguments through CLI modules
            const { success, isCliCommand } = await cli.execute(args);
            
            // Only exit for one-shot CLI commands
            if (success && isCliCommand) {
                app.exit(0);
                return;
            }
        } catch (error) {
            log.error('CLI execution error:', error);
            app.exit(1);
            return;
        }
        
        // Continue with normal app initialization if not a CLI command
        
        // Wait for app to be ready
        await app.whenReady();

        // Initialize app manager
        const successInit = await appManager.init();
        if (!successInit) {
            log.error('Failed to initialize application');
            app.exit(1);
            return;
        }

        log.info('Application started successfully');

        // Handle window-all-closed event
        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });

        // Handle activate event (macOS)
        app.on('activate', () => {
            appManager.createMainWindow();
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            log.error('Uncaught exception:', error);
            app.exit(1);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (error) => {
            log.error('Unhandled rejection:', error);
            app.exit(1);
        });
    } catch (error) {
        log.error('Application error:', error);
        app.exit(1);
    }
}

// Handle app ready event
app.on('ready', () => {
    main().catch(error => {
        log.error('Fatal error:', error);
        app.exit(1);
    });
});
