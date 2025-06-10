/**
 * Main entry point for the application.
 * Handles initialization and command line argument processing.
 */

const { app, BrowserWindow } = require('electron');
const logger = require('electron-log');
const appManager = require('./services/app.manager');
// Use stub implementation instead of the corrupted instance manager
const instanceManager = require('./services/instance.manager');
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

        // Check if app object is available and wait for it to be ready
        if (app && typeof app.whenReady === 'function') {
            // Wait for app to be ready before initializing app manager
            // This ensures we don't have race conditions with Electron's lifecycle
            await app.whenReady();
        } else {
            logger.warn('Electron app object not available, continuing without waiting for app ready');
        }
        
        // Process CLI arguments first
        const cliResult = await cli.execute(args);
        
        // Only initialize app manager if CLI execution didn't handle everything
        if (!cliResult.continueExecution) {
            if (app && typeof app.quit === 'function') {
                app.quit();
            } else {
                logger.warn('Cannot call app.quit(), exiting process directly');
                process.exit(0);
            }
            return;
        }
        
        // Get instance management settings from context
        const instanceManagement = cliResult.context.instanceManagement || {};
        const forceNewInstance = instanceManagement.forceNewInstance || false;
        const oneInstance = instanceManagement.oneInstance || false;
        // Profile isolation is true by default as per app_instances.md rules
        const profileIsolation = instanceManagement.profileIsolation !== false;
        
        // Intercept sessions before app initialization and handle delegation
        if (cliResult.context.sessions && Array.isArray(cliResult.context.sessions) && cliResult.context.sessions.length > 0) {
            logger.info('Intercepting sessions for instance management:', cliResult.context.sessions);
            logger.info('Instance management settings:', { forceNewInstance, oneInstance, profileIsolation });
            
            // Process sessions according to instance management rules
            const { localSessions, delegatedSessions } = await instanceManager.processSessions(
                cliResult.context.sessions,
                forceNewInstance,
                oneInstance,
                profileIsolation
            );
            
            // Delegate sessions to existing instances if needed
            if (delegatedSessions && Array.isArray(delegatedSessions) && delegatedSessions.length > 0) {
                logger.info('Delegating sessions to existing instances:', delegatedSessions);
                
                // Delegate sessions to existing instances
                const delegationResult = await instanceManager.delegateSessions(
                    delegatedSessions,
                    profileIsolation
                );
                
                if (delegationResult) {
                    logger.info('Session delegation successful');
                    
                    // If all sessions were delegated and none are local, quit this instance
                    if (localSessions.length === 0) {
                        logger.info('All sessions delegated, quitting this instance');
                        app.quit();
                        return;
                    }
                } else {
                    logger.warn('Session delegation failed, running all sessions locally');
                    // If delegation failed, run all sessions locally
                    localSessions.push(...delegatedSessions);
                }
            }
            
            // Update context with local sessions
            cliResult.context.sessions = localSessions;
            logger.info('Updated context with local sessions:', localSessions);
        }
        
        // Initialize instance with profile from context
        const profile = cliResult.context.profile || 'default';
        logger.info(`Initializing instance with profile: ${profile}`);
        
        // Initialize instance with profile isolation setting
        try {
            await instanceManager.init({
                profile,
                profileIsolation
            });
        } catch (error) {
            logger.error('Error initializing instance:', error);
            logger.warn('Continuing despite instance manager initialization failure');
            // Instead of quitting immediately, continue execution
            // This allows WhatsApp to start even if instance manager has issues
        }
        
        // Initialize app manager after app is ready
        await appManager.initializeApp(cliResult.context);

        // Handle window-all-closed event
        try {
            if (app && typeof app.on === 'function') {
                app.on('window-all-closed', () => {
                    if (process.platform !== 'darwin') {
                        if (app && typeof app.quit === 'function') {
                            app.quit();
                        } else {
                            logger.warn('Cannot call app.quit(), exiting process directly');
                            process.exit(0);
                        }
                    }
                });
            } else {
                logger.warn('Electron app object not available, skipping window-all-closed handler');
            }
        } catch (error) {
            logger.error('Error setting up window-all-closed handler:', error);
        }
        
        // Handle last-session-closed event from instance manager
        try {
            if (app && typeof app.on === 'function') {
                app.on('last-session-closed', () => {
                    logger.info('Last session closed, quitting application');
                    if (app && typeof app.quit === 'function') {
                        app.quit();
                    } else {
                        logger.warn('Cannot call app.quit(), exiting process directly');
                        process.exit(0);
                    }
                });
            } else {
                logger.warn('Electron app object not available, skipping last-session-closed handler');
            }
        } catch (error) {
            logger.error('Error setting up last-session-closed handler:', error);
        }

        // Handle activate event (macOS)
        try {
            if (app && typeof app.on === 'function') {
                app.on('activate', () => {
                    // Re-create main window on dock icon click (macOS)
                    if (BrowserWindow.getAllWindows().length === 0) {
                        appManager.createMainWindow();
                    }
                });
            } else {
                logger.warn('Electron app object not available, skipping activate handler');
            }
        } catch (error) {
            logger.error('Error setting up activate handler:', error);
        }

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
