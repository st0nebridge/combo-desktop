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
        try {
            if (this.initialized) {
                logger.warn('Application already initialized');
                return;
            }

            logger.info('Application starting...');

            // Initialize instance manager first
            await instanceManager.initialize();

            // Initialize CLI modules
            await this.initializeCLI();

            // Process CLI arguments
            await this.processCLIArguments(args);

            this.initialized = true;
            logger.info('Application initialized');
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

        // Find provider arguments (starting with --)
        const providerArgs = args.filter(arg => arg.startsWith('--'));
        if (providerArgs.length === 0) {
            logger.info('No provider arguments found');
            return;
        }

        // Process each provider argument
        for (const arg of providerArgs) {
            const providerName = arg.substring(2);
            await this.initializeProvider(providerName);
        }

        logger.info('CLI command completed successfully');
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
            const { window: existingWindow } = windowService.resolveWindow(windowName);
            
            if (existingWindow && !existingWindow.isDestroyed()) {
                logger.info(`Window ${windowName} already exists, focusing...`);
                existingWindow.show();
                existingWindow.focus();
                return;
            }

            // Register session first
            await instanceManager.registerSession(provider, 'default');

            // Initialize provider with default profile
            await provider.initializeProvider('default');

            // Get window reference through window service
            const { window } = windowService.resolveWindow(windowName);
            if (!window || window.isDestroyed()) {
                throw new Error(`Window not created for ${provider.getName()}`);
            }

            // Create tray before showing window to avoid race condition
            const tray = await trayService.createTray(provider, windowName);
            if (!tray) {
                throw new Error(`Failed to create tray for ${provider.getName()}`);
            }

            // Wait for window to be ready before showing
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Window ready-to-show timeout'));
                }, 10000);

                const cleanup = () => {
                    window.removeAllListeners('ready-to-show');
                    window.removeAllListeners('closed');
                    clearTimeout(timeout);
                };

                window.once('ready-to-show', () => {
                    try {
                        if (!window.isDestroyed()) {
                            // Show window and update tray state
                            window.show();
                            window.focus();
                            trayService.updateTrayIcon(windowName, true);
                        }

                        cleanup();
                        resolve();
                    } catch (error) {
                        cleanup();
                        reject(error);
                    }
                });

                window.once('closed', () => {
                    cleanup();
                    reject(new Error('Window was closed before ready'));
                });
            });

            logger.info(`Provider ${providerName} initialized successfully`);
        } catch (error) {
            logger.error(`Error initializing provider ${providerName}:`, error);
            throw error;
        }
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
                    const ModuleClass = require(modulePath);

                    // Skip non-class exports
                    if (typeof ModuleClass !== 'function' || !ModuleClass.prototype) {
                        logger.debug(`Skipping non-class module: ${file}`);
                        continue;
                    }

                    // Create instance and validate required methods
                    const instance = new ModuleClass();
                    const requiredMethods = ['execute', 'parseArgs', 'showUsage'];
                    const missingMethods = requiredMethods.filter(
                        method => !instance[method] || typeof instance[method] !== 'function'
                    );

                    if (missingMethods.length > 0) {
                        logger.error(`CLI module ${file} missing required methods: ${missingMethods.join(', ')}`);
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
