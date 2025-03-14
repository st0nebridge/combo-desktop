/**
 * Main entry point for the application.
 * Handles initialization and command line argument processing.
 */

const { app, BrowserWindow } = require('electron');
const logger = require('electron-log');
const appManager = require('./services/app.manager');
const cli = require('./cli');

/**
 * Main application entry point
 * @returns {Promise<void>}
 */
async function main() {
    try {
        // Initialize logger first
        logger.info('Application starting...');

        // Get command line arguments
        const args = process.argv.slice(2);
        logger.debug('Command line arguments:', args);

        // Wait for app to be ready before initializing app manager
        // This ensures we don't have race conditions with Electron's lifecycle
        await app.whenReady();
        
        // Process CLI arguments first
        const cliResult = await cli.execute(args);
        
        // Only initialize app manager if CLI execution didn't handle everything
        if (!cliResult.continueExecution) {
            app.quit();
            return;
        }
        
        // Initialize app manager after app is ready
        await appManager.initializeApp(cliResult.context);

        // Handle window-all-closed event
        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });
        
        // Handle last-session-closed event from instance manager
        app.on('last-session-closed', () => {
            logger.info('Last session closed, quitting application');
            app.quit();
        });

        // Handle activate event (macOS)
        app.on('activate', () => {
            // Re-create main window on dock icon click (macOS)
            if (BrowserWindow.getAllWindows().length === 0) {
                appManager.createMainWindow();
            }
        });

        logger.info('Application initialization complete');
    } catch (error) {
        logger.error('Application error:', error);
        process.exit(1);
    }
}

// Start the application
main().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
});
