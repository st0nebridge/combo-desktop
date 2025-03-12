const { app } = require('electron');
const log = require('electron-log');
const appManager = require('./services/app.manager');
const cli = require('./cli');

/**
 * Main application entry point
 */
async function main() {
    try {
        // Wait for app to be ready
        await app.whenReady();

        log.info('Application starting...');

        // Initialize CLI modules
        cli.initCLI();

        // Process command line arguments
        // If it returns true, this is a CLI command that shouldn't register a PID
        const isCliCommand = cli.processArgs();
        if (isCliCommand) {
            log.info('CLI command executed, exiting...');
            app.exit(0);
            return;
        }

        // Initialize app manager
        const success = await appManager.init();
        if (!success) {
            log.error('Failed to initialize application');
            app.exit(1);
            return;
        }

        log.info('Application started successfully');

        // Handle window-all-closed event
        app.on('window-all-closed', () => {
            // Keep app running if there are active sessions
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });

        // Handle activate event (macOS)
        app.on('activate', () => {
            appManager.createWindow();
        });
    } catch (error) {
        log.error('Fatal error during application startup:', error);
        app.exit(1);
    }
}

// Start the application
main();
