/**
 * @file Core application manager that handles lifecycle, initialization,
 * and coordination between various services and providers.
 */

const { app } = require('electron');
const logger = require('./logging.service');
const { ipcMain } = require('electron');
const windowService = require('./window.service');
const trayService = require('./tray.service');
const profileManager = require('./profile.manager');
const instanceManager = require('./instance.manager');
const providerRegistry = require('../providers');
const path = require('path');
const fs = require('fs');

/**
 * Core application manager that handles lifecycle and coordination.
 * Responsible for:
 * - Application initialization and shutdown
 * - Window management
 * - Provider initialization
 * - Instance management
 * - IPC communication
 * @class AppManager
 */
class AppManager {
    /**
     * Creates a new AppManager instance
     * @constructor
     */
    constructor() {
        /** @property {boolean} isQuitting - Whether the app is in the process of quitting */
        this.isQuitting = false;
        this.initialized = false;
        
        this.setupEventHandlers();
        // Don't log initialization here as it's misleading
        // The actual initialization happens in initializeApp
    }

    /**
     * Set up core application event handlers for lifecycle management
     * @method setupEventHandlers
     */
    setupEventHandlers() {
        // Handle window-all-closed event
        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin' || this.isQuitting) {
                this.quit();
            }
        });

        // Handle activate event (macOS)
        app.on('activate', () => {
            if (windowService.getAllWindows().length === 0) {
                this.createMainWindow();
            }
        });

        // Handle second-instance event
        app.on('second-instance', (event, argv) => {
            this.handleSecondInstance(argv);
        });

        // Handle quit events
        app.on('before-quit', () => {
            this.isQuitting = true;
        });

        // Handle IPC messages
        this.setupIpcHandlers();
    }

    /**
     * Set up IPC event handlers for renderer communication
     * @method setupIpcHandlers
     */
    setupIpcHandlers() {
        ipcMain.handle('get-app-info', () => {
            return {
                version: app.getVersion(),
                name: app.getName(),
                platform: process.platform
            };
        });

        ipcMain.handle('get-user-data-path', () => {
            return app.getPath('userData');
        });
    }

    /**
     * Create the main application window with default configuration
     * @method createMainWindow
     * @returns {Electron.BrowserWindow} The created window instance
     */
    createMainWindow() {
        const config = {
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: true
            }
        };

        return windowService.createWindow(config, 'main');
    }

    /**
     * Initialize application
     * @method initializeApp
     * @param {Object} cliResult - Result from CLI execution
     * @returns {Promise<void>}
     */
    async initializeApp(cliResult) {
        try {
            // Check if we've already initialized to prevent duplicate messages
            if (this.initialized) {
                logger.debug('App already initialized, skipping duplicate initialization');
                return;
            }
            
            // Don't log "Application starting..." here since it's already logged in main.js
            logger.debug('CLI execution result:', cliResult);

            // Initialize instance manager for non-CLI commands
            await instanceManager.ensureDirectories();

            // Process any providers that were handled by CLI modules
            if (cliResult && cliResult.processedProviders && cliResult.processedProviders.length > 0) {
                logger.info('Processing providers from CLI result:', cliResult.processedProviders);
                // Handle any provider-specific initialization based on CLI results
                await this.initializeProviders(cliResult.processedProviders);
            } else {
                // Initialize default providers if no specific ones were processed
                // await this.initializeDefaultProviders();
            }

            // Create main window if needed
            if (windowService.getAllWindows().length === 0) {
                this.createMainWindow();
            }

            // Initialize tray service
            // await trayService.initialize();

            // Mark as initialized to prevent duplicate initialization
            this.initialized = true;
            logger.info('App Manager initialized');
        } catch (error) {
            logger.error('Error initializing app:', error);
            throw error;
        }
    }

    /**
     * Handle second instance arguments
     * @method handleSecondInstance
     * @param {Array<string>} args - Command line arguments from second instance
     * @returns {Promise<void>}
     */
    async handleSecondInstance(args) {
        try {
            logger.info('Handling second instance with args:', args);
            
            // Process the arguments through CLI first
            const cli = require('../cli');
            const cliResult = await cli.execute(args);
            
            // If it's not a CLI command, focus the main window
            if (!cliResult.isCliCommand) {
                const mainWindow = windowService.getWindow('main');
                if (mainWindow) {
                    if (mainWindow.isMinimized()) {
                        mainWindow.restore();
                    }
                    mainWindow.focus();
                }
            }
        } catch (error) {
            logger.error('Error handling second instance:', error);
        }
    }

    /**
     * Initialize default providers
     * @method initializeDefaultProviders
     * @returns {Promise<void>}
     */
    async initializeDefaultProviders() {
        try {
            logger.info('Initializing default providers');
            // Get active profile
            const activeProfile = await profileManager.getActiveProfile();
            
            if (activeProfile) {
                logger.info(`Using active profile: ${activeProfile.name} (${activeProfile.provider})`);
                await this.initializeProviders([activeProfile.provider]);
            } else {
                logger.info('No active profile found, using default providers');
                // Initialize default providers
                const defaultProviders = ['whatsapp'];
                await this.initializeProviders(defaultProviders);
            }
        } catch (error) {
            logger.error('Error initializing default providers:', error);
            throw error;
        }
    }

    /**
     * Initialize specific providers
     * @method initializeProviders
     * @param {Array<string>} providers - Provider names to initialize
     * @returns {Promise<void>}
     */
    async initializeProviders(providers) {
        try {
            if (!providers || providers.length === 0) {
                logger.warn('No providers specified for initialization');
                return;
            }
            
            logger.info(`Initializing providers: ${providers.join(', ')}`);
            
            for (const providerName of providers) {
                try {
                    await providerRegistry.initializeProvider(providerName);
                } catch (providerError) {
                    logger.error(`Error initializing provider ${providerName}:`, providerError);
                    // Continue with other providers instead of failing completely
                }
            }
        } catch (error) {
            logger.error('Error initializing providers:', error);
            throw error;
        }
    }

    /**
     * Quit the application
     * @method quit
     */
    quit() {
        if (this.isQuitting) {
            return;
        }
        
        this.isQuitting = true;
        logger.info('Application quitting...');
        
        // Clean up resources
        trayService.destroy();
        
        // Quit the app
        app.quit();
    }
}

// Export singleton instance
module.exports = new AppManager();
