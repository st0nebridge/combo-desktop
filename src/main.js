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

        // Set up single instance lock to prevent multiple instances
        const gotTheLock = app.requestSingleInstanceLock();
        
        if (!gotTheLock) {
            logger.info('Another instance is already running, exiting...');
            app.quit();
            return;
        }
        
        // Handle second instance launch
        app.on('second-instance', (event, commandLine, workingDirectory) => {
            logger.info('Second instance detected, processing arguments...');
            // Pass the command line arguments to the existing instance
            const secondInstanceArgs = commandLine.slice(process.defaultApp ? 2 : 1);
            if (appManager.handleSecondInstance) {
                appManager.handleSecondInstance(secondInstanceArgs);
            } else {
                logger.warn('handleSecondInstance not available, ignoring second instance args');
            }
        });
        
        // Wait for app to be ready before initializing app manager
        // This ensures we don't have race conditions with Electron's lifecycle
        await app.whenReady();
        
        // Initialize app manager after app is ready
        await appManager.initializeApp(args);

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
