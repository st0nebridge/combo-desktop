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
     * @param {Array} args - Command line arguments
     * @returns {Promise<void>}
     */
    async initializeApp(args) {
        try {
            if (this.initialized) {
                logger.warn('App already initialized');
                return;
            }

            logger.info('Application starting...');
            logger.debug('Command line arguments:', args);

            // Initialize instance manager
            await instanceManager.initialize();

            // Initialize CLI modules
            await this.initializeCLI();

            try {
                // Use CLI registry to process arguments
                const cliRegistry = require('../cli/cli.registry');
                const { success, isCliCommand, processedProviders } = await cliRegistry.execute(args);
                
                // If CLI registry successfully processed providers, don't process them again
                if (success && !isCliCommand && processedProviders && processedProviders.length > 0) {
                    logger.info(`CLI registry processed ${processedProviders.length} providers: ${processedProviders.join(', ')}`);
                    
                    // We don't need to do anything else here as the providers are being initialized
                    // by the provider-cli.js module in a non-blocking way
                } else {
                    // Process CLI arguments directly as fallback
                    await this.processCLIArguments(args);
                }
            } catch (error) {
                logger.error('Error processing CLI arguments:', error);
                // Continue with application initialization even if CLI argument processing fails
            }

            this.initialized = true;
        } catch (error) {
            logger.error('Error initializing app:', error);
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
        const providerArgs = args.filter(arg => arg.startsWith('--') && arg !== '--tray' && arg !== '--profile');
        if (providerArgs.length === 0) {
            logger.info('No provider arguments found');
            return;
        }

        // Get profile argument if present
        let profile = 'default';
        const profileIndex = args.indexOf('--profile');
        if (profileIndex !== -1 && profileIndex + 1 < args.length) {
            profile = args[profileIndex + 1];
        }

        // Check if tray mode is enabled
        const trayMode = args.includes('--tray');

        // Process each provider argument
        for (const arg of providerArgs) {
            const providerName = arg.substring(2);
            const success = await this.initializeProvider(providerName, profile, { tray: trayMode });
            if (!success) {
                logger.error(`Failed to initialize provider ${providerName}`);
            }
        }

        logger.info('CLI command completed successfully');
    }

    /**
     * Initialize a provider
     * @method initializeProvider
     * @param {string} providerName - Name of the provider to initialize
     * @param {string} profile - Profile name
     * @param {Object} options - Options for provider initialization
     * @returns {Promise<boolean>} True if initialization successful, false otherwise
     */
    async initializeProvider(providerName, profile, options) {
        try {
            const provider = providerRegistry.getProvider(providerName);
            if (!provider) {
                logger.error(`Provider not found: ${providerName}`);
                return false;
            }

            const providerDisplayName = provider.getName();
            logger.info(`Initializing provider: ${providerDisplayName} with profile: ${profile}`);

            // Check if provider window already exists
            const windowName = `${providerDisplayName}:${profile}`;
            logger.info(`Window name for provider: ${windowName}`);
            
            const { window: existingWindow } = windowService.resolveWindow(windowName);
            
            if (existingWindow && !existingWindow.isDestroyed()) {
                // Only show the window if it's hidden, don't focus it
                if (!existingWindow.isVisible()) {
                    logger.info(`Window ${windowName} already exists, showing without focus...`);
                    existingWindow.show();
                } else {
                    logger.info(`Window ${windowName} already exists and is visible, not changing focus`);
                }
                return true;
            }

            // Register session first
            await instanceManager.registerSession(provider, profile);

            // Initialize provider with profile
            await provider.initializeProvider(profile);

            // Get window config from provider
            const windowConfig = provider.getWindowConfig();
            
            // Create window with show: false to prevent automatic showing/focusing
            // Pass metadata as third parameter
            const window = windowService.createWindow(
                windowName, 
                {
                    ...windowConfig,
                    show: false // Ensure window doesn't show automatically
                },
                {
                    provider,
                    profile
                }
            );
            
            if (!window) {
                logger.error(`Failed to create window for ${providerDisplayName}`);
                return false;
            }

            // Create tray icon for the window - don't wait for it to complete
            // This prevents hanging on tray creation
            trayService.createTray(provider, windowName)
                .then(tray => {
                    if (!tray) {
                        logger.error(`Failed to create tray for ${providerDisplayName}`);
                        logger.warn(`Continuing without tray for ${providerDisplayName}`);
                    }
                })
                .catch(error => {
                    logger.error(`Error creating tray for ${providerDisplayName}:`, error);
                    logger.warn(`Continuing without tray for ${providerDisplayName}`);
                });

            // Wait for window to be ready before showing
            try {
                await new Promise((resolve) => {
                    // Reduced timeout from 30 seconds to 10 seconds
                    const timeout = setTimeout(() => {
                        logger.warn(`Window ready-to-show timeout for ${providerDisplayName} - showing window anyway`);
                        
                        // Instead of rejecting, we'll resolve anyway and show the window
                        if (!window.isDestroyed()) {
                            window.show();
                            // Don't focus the window to prevent random focusing
                        }
                        
                        resolve();
                    }, 10000); // 10 seconds timeout

                    const cleanup = () => {
                        window.removeAllListeners('ready-to-show');
                        window.removeAllListeners('closed');
                        clearTimeout(timeout);
                    };

                    // Add a did-finish-load event handler to help with debugging
                    window.webContents.once('did-finish-load', () => {
                        logger.info(`[${providerDisplayName}] Window did-finish-load event fired`);
                    });

                    // Flag to track if we've already resolved or rejected the promise
                    let isSettled = false;

                    window.once('ready-to-show', () => {
                        try {
                            if (isSettled) {
                                return;
                            }
                            
                            isSettled = true;
                            
                            if (!window.isDestroyed()) {
                                // Show window without focusing
                                window.show();
                                logger.info(`[${providerDisplayName}] Window shown`);
                            }

                            cleanup();
                            resolve();
                        } catch (error) {
                            logger.error(`Error in ready-to-show handler for ${providerDisplayName}:`, error);
                            cleanup();
                            
                            // Instead of rejecting, we'll resolve anyway
                            resolve();
                        }
                    });

                    window.once('closed', () => {
                        if (isSettled) {
                            return;
                        }
                        
                        isSettled = true;
                        cleanup();
                        
                        // If window is closed during app quit, don't reject
                        if (windowService.isQuitting) {
                            resolve();
                        } else {
                            // Instead of rejecting, we'll resolve with a warning
                            logger.warn(`Window was closed before ready for ${providerDisplayName}`);
                            resolve();
                        }
                    });
                });
            } catch (error) {
                logger.error(`Error waiting for window to be ready for ${providerDisplayName}: ${error.message}`);
                // Continue anyway - we'll still return success
                logger.warn(`Continuing despite window ready error for ${providerDisplayName}`);
            }

            logger.info(`Provider ${providerDisplayName} initialized successfully`);
            return true;
        } catch (error) {
            logger.error(`Error initializing provider ${providerName}:`, error);
            return false;
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
                // Removed the focus call here
            }
        } catch (error) {
            logger.error('Error handling second instance:', error);
        }
    }

    /**
     * Show the main window
     * @method showMainWindow
     */
    showMainWindow() {
        try {
            const { window: win } = windowService.resolveWindow('main');
            if (win && !win.isDestroyed()) {
                if (win.isMinimized()) {
                    win.restore();
                }
                win.show();
                // Don't focus the window to prevent unnecessary focus changes
            }
        } catch (error) {
            logger.error('Error showing main window:', error);
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
