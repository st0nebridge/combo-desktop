/**
 * Main entry point for the application.
 * Handles initialization and command line argument processing.
 */

const { app, BrowserWindow } = require('electron');
const logger = require('electron-log');
const appManager = require('./services/app.manager');

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

        // Initialize app manager
        await appManager.initializeApp(args);

        // Wait for app to be ready
        await app.whenReady();

        // Handle window-all-closed event
        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
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
