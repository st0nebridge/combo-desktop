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
 * Application Manager
 * Handles core application functionality and lifecycle
 */
class AppManager {
    constructor() {
        this.isQuitting = false;
        this.setupEventHandlers();
        log.info('App Manager initialized');
    }

    /**
     * Setup application event handlers
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
     * Setup IPC event handlers
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
     * Create the main application window
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
     * @returns {Promise<boolean>} True if initialization successful
     */
    async init() {
        try {
            // Get parsed arguments from registry
            const args = cliRegistry.getLastParsedArgs();
            if (!args) {
                log.error('No CLI arguments parsed');
                return false;
            }

            // Handle instance registration
            if (!(await instanceManager.handleInstanceRegistration(args))) {
                log.error('Failed to register instance');
                return false;
            }

            // Initialize profile manager
            await profileManager.init();

            // Handle provider initialization
            if (args.providers && args.providers.length > 0) {
                for (const { provider: providerName, profile } of args.providers) {
                    const success = await this.initializeProvider(providerName, profile || 'default', args);
                    if (!success) {
                        log.error(`Failed to initialize provider: ${providerName}`);
                        return false;
                    }
                }
            } else if (!args.cliCommand) {
                // No providers specified and not a CLI command, create main window
                this.createMainWindow();
            }

            log.info('Application initialized successfully');
            return true;
        } catch (error) {
            log.error('Failed to initialize application:', error);
            return false;
        }
    }

    /**
     * Initialize a provider
     * @param {string} providerName - Name of the provider
     * @param {string} profile - Profile name
     * @param {Object} args - CLI arguments
     * @returns {Promise<boolean>} True if initialization successful
     */
    async initializeProvider(providerName, profile, args) {
        try {
            // Create provider instance
            const provider = providerRegistry.createProvider(providerName);
            if (!provider) {
                log.error(`Invalid provider: ${providerName}`);
                return false;
            }

            // Add provider to instance
            if (!(await instanceManager.addProviderToInstance(provider.getCommandArg(), profile))) {
                log.error(`Failed to add provider ${providerName} to instance`);
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
     * Handle second instance launch
     * @param {string[]} argv - Command line arguments
     */
    async handleSecondInstance(argv) {
        try {
            await instanceManager.handleSecondInstance(argv);
        } catch (error) {
            log.error('Failed to handle second instance:', error);
        }
    }

    /**
     * Quit the application
     */
    quit() {
        try {
            this.isQuitting = true;
            
            // Set quitting flag on window service
            windowService.isQuitting = true;

            // Cleanup services in order
            trayService.cleanup();
            windowService.cleanup();
            instanceManager.cleanup();
            
            app.quit();
        } catch (error) {
            log.error('Failed to quit application:', error);
            process.exit(1);
        }
    }
}

module.exports = new AppManager();
