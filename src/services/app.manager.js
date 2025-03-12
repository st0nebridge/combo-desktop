const { app, dialog, nativeTheme } = require('electron');

// Import services
const instanceManager = require('./instance.manager');
const profileManager = require('./profile.manager');
const windowService = require('./window.service');
const trayService = require('./tray.service');
const logger = require('./logging.service');

// Import other modules
const providerRegistry = require('../providers/provider.registry');
const providerCLI = require('../cli/provider-cli');

class AppManager {
    constructor() {
        // Initialize theme handling
        nativeTheme.on('updated', () => {
            this.handleThemeUpdate();
        });

        // Handle app quit
        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                this.cleanup();
            }
        });

        app.on('before-quit', () => {
            this.cleanup();
        });
    }

    async initialize() {
        try {
            // Initialize instance manager first
            const initialized = await instanceManager.initialize();
            if (!initialized) {
                return false;
            }

            // Handle CLI commands that should exit after execution
            if (this.shouldExitAfterCommand()) {
                return true;
            }

            // Parse config file if provided
            const configPath = providerCLI.getConfigFile();
            if (configPath) {
                this.configFile = providerCLI.parseConfig(configPath);
                if (!this.configFile) {
                    return false;
                }
            }

            // Get providers to initialize
            const providers = this.configFile?.providers || providerCLI.parseProviderArgs();
            if (providers.length === 0) {
                this.showProviderRequiredError();
                return false;
            }

            // Initialize each provider
            for (const { provider: providerArg, profile } of providers) {
                try {
                    const success = await this.initializeProvider(providerArg, profile || 'default');
                    if (!success) {
                        logger.warn(`Failed to initialize provider: ${providerArg}`);
                    }
                } catch (error) {
                    logger.error(`Error initializing provider ${providerArg}:`, error);
                }
            }

            // If no windows were created, quit the app
            if (windowService.getAllWindows().length === 0) {
                logger.warn('No windows created, quitting application');
                return false;
            }

            // Setup app events
            this.setupAppEvents();
            return true;
        } catch (error) {
            logger.error('Error initializing application:', error);
            return false;
        }
    }

    shouldExitAfterCommand() {
        if (providerCLI.shouldResetLock()) {
            return true;
        }

        // Check for other CLI commands that should exit
        const cliArgs = process.argv.slice(2);
        const exitCommands = ['--profiles', '--manual', '--instances', '--help', '--version'];
        return exitCommands.some(cmd => cliArgs.includes(cmd));
    }

    async initializeProvider(providerArg, profile = 'default') {
        try {
            // Initialize provider first to get proper provider name
            const provider = providerRegistry.createProvider([providerArg]);
            if (!provider) {
                throw new Error(`Failed to initialize provider: ${providerArg}`);
            }

            // Get or create profile
            try {
                const existingProfile = profileManager.getProfile(provider.getName(), profile);
                if (!existingProfile && profile !== 'default') {
                    const response = await dialog.showMessageBox({
                        type: 'question',
                        buttons: ['Cancel', 'Create Profile'],
                        defaultId: 1,
                        title: 'Create New Profile',
                        message: `Profile '${profile}' does not exist for ${provider.getName()}.`,
                        detail: 'Would you like to create it?'
                    });

                    if (response.response === 0) {
                        return false;
                    }

                    profileManager.createProfile(provider.getName(), profile);
                } else if (!existingProfile) {
                    // Create default profile if it doesn't exist
                    profileManager.createProfile(provider.getName(), profile);
                }
            } catch (error) {
                logger.error('Error managing profile:', error);
                throw error;
            }

            // Check if session can be registered
            const canRegister = await instanceManager.registerSession(provider, profile);
            if (!canRegister) {
                if (!providerCLI.shouldForceNewInstance()) {
                    logger.info(`Session ${provider.getName()}:${profile} already exists in another instance`);
                    return false;
                }
            }

            // Create window using the window service with session info
            const windowName = `${provider.getName()}:${profile}`;
            const window = await provider.spawnWindow(profile);
            if (!window) {
                throw new Error('Failed to create window');
            }

            // Create tray using TrayService
            const tray = trayService.createTray(provider, windowName);
            if (!tray) {
                throw new Error('Failed to create tray icon');
            }

            // Setup window events
            this.setupWindowEvents(provider, windowName);

            // Start minimized if requested
            if (providerCLI.shouldStartMinimized()) {
                window.hide();
            }

            return true;
        } catch (error) {
            logger.error(`Error initializing provider ${providerArg}:`, error);
            return false;
        }
    }

    setupAppEvents() {
        // Handle app-wide events
        app.on('activate', () => {
            // On macOS it's common to re-create a window when the dock icon is clicked
            if (windowService.getAllWindows().length === 0) {
                this.initialize();
            }
        });

        // Handle system theme changes
        nativeTheme.on('updated', () => {
            this.handleThemeUpdate();
        });
    }

    setupWindowEvents(provider, windowName) {
        const window = windowService.getWindow(windowName);
        if (!window) {
            return;
        }

        // Prevent window close, hide instead
        window.on('close', (event) => {
            event.preventDefault();
            this.hideWindow(windowName);
        });

        // Handle window-specific notifications using IPC
        window.webContents.on('ipc-message', (event, channel, ...args) => {
            if (channel === 'notification-state-changed') {
                const [isActive] = args;
                this.handleNotificationStateChange(windowName, isActive);
            }
        });
    }

    handleNotificationStateChange(windowName, hasNotification) {
        try {
            trayService.setNotificationState(windowName, hasNotification);
        } catch (error) {
            logger.error(`Error handling notification state change for ${windowName}:`, error);
        }
    }

    showWindow(windowName) {
        const window = windowService.getWindow(windowName);
        if (window) {
            window.show();
        }
    }

    hideWindow(windowName) {
        const window = windowService.getWindow(windowName);
        if (window) {
            window.hide();
        }
    }

    async quitProvider(windowName) {
        const window = windowService.getWindow(windowName);
        if (!window) {
            return;
        }

        // Unregister session
        const [providerName, profile] = windowName.split(':');
        await instanceManager.unregisterSession(providerName, profile);

        // Close window
        window.destroy();

        // Quit app if no windows left
        if (windowService.getAllWindows().length === 0) {
            app.exit(0);
        }
    }

    async cleanup() {
        try {
            // Set window service to quitting mode first
            windowService.isQuitting = true;

            // Cleanup services in order, but don't let errors stop the chain
            try {
                await trayService.cleanup();
            } catch (error) {
                logger.error('Error during tray cleanup:', error);
            }

            try {
                await windowService.cleanup();
            } catch (error) {
                logger.error('Error during window cleanup:', error);
            }

            try {
                await instanceManager.cleanup();
            } catch (error) {
                logger.warn('Error during instance cleanup:', error);
            }

            // Force quit the app
            app.exit(0);
        } catch (error) {
            logger.error('Error during app cleanup:', error);
            app.exit(1);
        }
    }
}

module.exports = new AppManager();
