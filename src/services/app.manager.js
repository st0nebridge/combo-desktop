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
        logger.info('App Manager initialized');
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
     * Initialize the application
     * @method initializeApp
     * @param {Array<string>} args - CLI arguments
     * @returns {Promise<void>}
     */
    async initializeApp(args) {
        if (this.initialized) {
            logger.warn('App already initialized');
            return;
        }

        try {
            logger.info('Application starting...');

            // Initialize instance management
            const instanceManager = require('./instance.manager');
            const shouldContinue = await instanceManager.handleInstanceRegistration(args);
            
            if (!shouldContinue) {
                logger.info('Another instance is handling this request');
                return;
            }

            // Initialize CLI modules
            await this.initializeCLI();

            // Process CLI arguments
            await this.processCLIArguments(args);

            this.initialized = true;
            logger.info('Application initialized successfully');
        } catch (error) {
            logger.error('Error initializing application:', error);
            throw error;
        }
    }

    /**
     * Process CLI arguments
     * @method processCLIArguments
     * @param {Array<string>} args - CLI arguments
     * @returns {Promise<void>}
     */
    async processCLIArguments(args) {
        if (!args || args.length === 0) {
            logger.info('No CLI arguments to process');
            return;
        }

        logger.debug('CLI arguments:', args);

        // Execute CLI command if present
        const cli = require('../cli');
        await cli.execute(args);
    }

    /**
     * Initialize CLI modules
     * @method initializeCLI
     * @returns {Promise<void>}
     */
    async initializeCLI() {
        if (this.cliInitialized) {
            logger.warn('CLI already initialized');
            return;
        }

        try {
            logger.info('Initializing CLI modules');
            
            // Clear existing modules
            cliRegistry.clear();
            logger.info('CLI Registry cleared');

            // Auto-register CLI modules
            await this.registerCLIModules();

            this.cliInitialized = true;
            logger.info('CLI modules initialized');
        } catch (error) {
            logger.error('Error initializing CLI:', error);
            throw error;
        }
    }

    /**
     * Register CLI modules
     * @method registerCLIModules
     * @returns {Promise<void>}
     */
    async registerCLIModules() {
        try {
            const cliDir = path.join(__dirname, '..', 'cli', 'modules');
            const files = await fs.promises.readdir(cliDir);

            for (const file of files) {
                if (!file.endsWith('.js')) {
                    continue;
                }

                try {
                    const modulePath = path.join(cliDir, file);
                    const CLIModule = require(modulePath);
                    
                    // Skip non-class exports
                    if (typeof CLIModule !== 'function' || !CLIModule.prototype) {
                        logger.debug(`Skipping non-class module: ${file}`);
                        continue;
                    }

                    // Create instance and validate
                    const instance = new CLIModule();
                    if (!instance.execute || typeof instance.execute !== 'function') {
                        logger.error(`CLI module ${file} missing required execute() method`);
                        continue;
                    }

                    // Register valid module
                    cliRegistry.register(instance);
                    logger.info(`Registered CLI module: ${instance.constructor.name}`);
                } catch (moduleError) {
                    logger.error(`Error loading CLI module ${file}:`, moduleError);
                }
            }
        } catch (error) {
            logger.error('Error registering CLI modules:', error);
            throw error;
        }
    }

    /**
     * Initialize a provider
     * @method initializeProvider
     * @param {string} providerName - Name of the provider to initialize
     * @returns {Promise<void>}
     */
    async initializeProvider(providerName) {
        try {
            const provider = providerRegistry.getProvider(providerName);
            if (!provider) {
                logger.error(`Provider not found: ${providerName}`);
                return;
            }

            logger.info(`Initializing provider: ${provider.getName()} with profile: default`);

            // Check if provider window already exists
            const windowName = `${provider.getName()}:default`;
            const existingWindow = windowService.getWindow(windowName);
            
            if (existingWindow) {
                logger.info(`Window ${windowName} already exists, focusing...`);
                windowService.showWindow(existingWindow);
                return;
            }

            // Initialize provider with default profile
            await provider.initializeProvider('default');
            logger.info(`Provider ${providerName} initialized successfully`);
        } catch (error) {
            logger.error(`Error initializing provider ${providerName}:`, error);
            throw error;
        }
    }

    /**
     * Handle second instance of the application
     * @method handleSecondInstance
     * @param {string[]} argv - Command line arguments from second instance
     */
    handleSecondInstance(argv) {
        try {
            // Focus first window of existing instance
            const windows = windowService.getAllWindows();
            if (windows.length > 0) {
                const win = windows[0];
                if (win.isMinimized()) {
                    win.restore();
                }
                win.focus();
            }
        } catch (error) {
            logger.error('Error handling second instance:', error);
        }
    }

    /**
     * Quit the application cleanly
     * @method quit
     */
    quit() {
        this.isQuitting = true;
        app.quit();
    }
}

// Export singleton instance
module.exports = new AppManager();
