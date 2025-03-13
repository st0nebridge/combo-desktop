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
const cliRegistry = require('../cli/cli.registry');
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
        this.cliInitialized = false;
        
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
     * @param {Array<string>} args - Command line arguments
     * @returns {Promise<void>}
     */
    async initializeApp(args) {
        try {
            // Check if we've already initialized to prevent duplicate messages
            if (this.initialized) {
                logger.debug('App already initialized, skipping duplicate initialization');
                return;
            }
            
            // Don't log "Application starting..." here since it's already logged in main.js
            logger.debug('Command line arguments:', args);

            // Initialize CLI registry (only if not already initialized)
            if (!this.cliInitialized) {
                await this.initializeCLI();
            } else {
                logger.info('CLI already initialized, skipping');
            }

            // Process command line arguments
            if (args && args.length > 0) {
                const cliResult = await this.processCLIArguments(args);
                if (cliResult && cliResult.isCliCommand) {
                    // Don't continue with app initialization for CLI commands
                    return;
                }
            }

            // Initialize instance manager for non-CLI commands
            await instanceManager.ensureDirectories();

            // Mark as initialized to prevent duplicate initialization
            this.initialized = true;
            logger.info('App Manager initialized');
        } catch (error) {
            logger.error('Error initializing app:', error);
            throw error;
        }
    }

    /**
     * Initialize CLI modules
     * @method initializeCLI
     * @returns {Promise<void>}
     */
    async initializeCLI() {
        try {
            // Use the CLI index.js initialization method
            const cliInit = require('../cli/index');
            await cliInit.initModules();
            this.cliInitialized = true;
            logger.info('CLI initialized');
        } catch (error) {
            logger.error('Error initializing CLI:', error);
            throw error;
        }
    }

    /**
     * Process CLI arguments
     * @method processCLIArguments
     * @param {Array<string>} args - CLI arguments
     * @returns {Promise<{success: boolean, isCliCommand: boolean, processedProviders: Array<string>}>}
     */
    async processCLIArguments(args) {
        if (!args || args.length === 0) {
            logger.info('No CLI arguments to process');
            return { success: true, isCliCommand: false, processedProviders: [] };
        }

        logger.debug('CLI arguments:', args);

        // Execute CLI command
        const result = await cliRegistry.execute(args);
        if (result.success && result.isCliCommand) {
            // If this is a CLI command and it succeeded, don't continue with app initialization
            return result;
        }

        // Find provider arguments (starting with --)
        const providerArgs = args.filter(arg => arg.startsWith('--') && arg !== '--tray' && arg !== '--profile');
        if (providerArgs.length === 0) {
            logger.info('No provider arguments found');
            return result;
        }

        // Get profile argument if present
        let profile = 'default';
        const profileIndex = args.indexOf('--profile');
        if (profileIndex !== -1 && profileIndex + 1 < args.length) {
            profile = args[profileIndex + 1];
        }

        // Check if tray mode is enabled
        const trayMode = args.includes('--tray');

        // Track which providers have been initialized to prevent duplicates
        const initializedProviders = new Set();

        // Process each provider argument
        for (const arg of providerArgs) {
            const providerName = arg.substring(2);
            
            // Skip if this provider has already been initialized
            if (initializedProviders.has(providerName)) {
                logger.info(`Provider ${providerName} already initialized, skipping...`);
                continue;
            }
            
            try {
                // Get provider class
                const Provider = providerRegistry.getProvider(providerName);
                if (!Provider) {
                    logger.error(`Provider ${providerName} not found`);
                    continue;
                }

                // Create provider instance
                const provider = new Provider();
                await provider.initialize({ profile, trayMode });
                initializedProviders.add(providerName);
                logger.info(`Initialized provider: ${providerName}`);
            } catch (error) {
                logger.error(`Error initializing provider ${providerName}:`, error);
            }
        }

        return result;
    }

    /**
     * Handle second instance launch
     * @method handleSecondInstance
     * @param {Array<string>} argv - Command line arguments from second instance
     */
    handleSecondInstance(argv) {
        try {
            // Process CLI arguments from second instance
            this.processCLIArguments(argv).catch(error => {
                logger.error('Error processing second instance arguments:', error);
            });

            // Focus the main window if it exists
            const mainWindow = windowService.getWindow('main');
            if (mainWindow) {
                if (mainWindow.isMinimized()) {
                    mainWindow.restore();
                }
                mainWindow.focus();
            }
        } catch (error) {
            logger.error('Error handling second instance:', error);
        }
    }

    /**
     * Quit the application
     * @method quit
     */
    quit() {
        try {
            this.isQuitting = true;
            app.quit();
        } catch (error) {
            logger.error('Error quitting app:', error);
            process.exit(1);
        }
    }
}

// Export singleton instance
module.exports = new AppManager();
