/**
 * @file Core application manager that handles lifecycle, initialization,
 * and coordination between various services and providers.
 */

const { app } = require('electron');
const log = require('electron-log');
const { ipcMain } = require('electron');
const windowService = require('./window.service');
const trayService = require('./tray.service');
const profileManager = require('./profile.manager');
const instanceManager = require('./instance.manager');
const providerRegistry = require('../providers');
const cliRegistry = require('../cli/cli.registry');

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
        
        this.setupEventHandlers();
        log.info('App Manager initialized');
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
     * Initialize the application and its core services.
     * Handles CLI commands, instance registration, and provider initialization.
     * @method init
     * @returns {Promise<boolean>} True if initialization successful
     * @throws {Error} If initialization fails
     */
    async init() {
        try {
            // Get parsed arguments from registry
            const args = cliRegistry.getLastParsedArgs();
            
            // Initialize profile manager first
            await profileManager.init();

            // For CLI commands, we don't need full initialization
            if (args && args.command) {
                log.info('CLI command detected, skipping full initialization');
                return true;
            }

            // Handle instance registration if needed
            if (args && !args.cliCommand) {
                if (!(await instanceManager.handleInstanceRegistration(args))) {
                    log.error('Failed to register instance');
                    return false;
                }
            }

            // Handle provider initialization
            if (args && args.command) {
                const success = await this.initializeProvider(args.command, args.profile || 'default', args);
                if (!success) {
                    log.error(`Failed to initialize provider: ${args.command}`);
                    return false;
                }
            } else if (args && !args.cliCommand) {
                // No providers specified and not a CLI command, create main window
                this.createMainWindow();
            }

            log.info('Application initialized successfully');
            return true;
        } catch (error) {
            log.error('Failed to initialize application:', error);
            throw error;
        }
    }

    /**
     * Initialize a provider with specified profile.
     * Creates provider instance, window, and tray if needed.
     * @method initializeProvider
     * @param {string} providerName - Name of the provider
     * @param {string} profile - Profile name
     * @param {Object} args - CLI arguments
     * @returns {Promise<boolean>} True if initialization successful
     * @throws {Error} If provider initialization fails
     */
    async initializeProvider(providerName, profile, args) {
        try {
            log.info(`Initializing provider: ${providerName} with profile: ${profile}`);

            // Create provider instance
            const provider = providerRegistry.createProvider(providerName);
            if (!provider) {
                log.error(`Invalid provider: ${providerName}`);
                return false;
            }

            // Create window for provider
            const window = await provider.spawnWindow(profile);
            if (!window) {
                log.error(`Failed to create window for provider ${providerName}`);
                return false;
            }

            // Create tray icon if needed
            if (args.tray) {
                const tray = trayService.createTray(provider, `${providerName}:${profile}`);
                if (!tray) {
                    log.error(`Failed to create tray for provider ${providerName}`);
                    return false;
                }
            }

            log.info(`Provider ${providerName} initialized successfully`);
            return true;
        } catch (error) {
            log.error(`Error initializing provider ${providerName}:`, error);
            return false;
        }
    }

    /**
     * Handle second instance of the application
     * @method handleSecondInstance
     * @param {Array<string>} argv - Command line arguments from second instance
     */
    handleSecondInstance(argv) {
        // Focus the main window if it exists
        const mainWindow = windowService.getWindow('main');
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.focus();
        }
    }

    /**
     * Quit the application gracefully
     * @method quit
     */
    quit() {
        this.isQuitting = true;
        app.quit();
    }
}

// Export singleton instance
module.exports = new AppManager();
