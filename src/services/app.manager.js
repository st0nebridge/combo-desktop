const { app, dialog, Menu, nativeTheme } = require('electron');

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
        this.trays = new Map(); // Map<windowName, Tray>
        this.configFile = null;
        this.notificationTimers = new Map(); // Map<windowName, Timer>

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
            // Handle reset-lock command first
            if (providerCLI.shouldResetLock()) {
                const success = await instanceManager.resetLock();
                if (success) {
                    logger.info('Reset lock command executed successfully');
                    app.exit(0);
                } else {
                    logger.error('Failed to reset lock');
                    app.exit(1);
                }
                return;
            }

            // Initialize instance manager
            const initialized = await instanceManager.initialize();
            if (!initialized) {
                logger.info('Another instance is already running');
                app.exit(1);
                return;
            }

            // Parse config file if provided
            const configPath = providerCLI.getConfigFile();
            if (configPath) {
                this.configFile = providerCLI.parseConfig(configPath);
                if (!this.configFile) {
                    app.exit(1);
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
                app.exit(1);
                return;
            }

            // Setup app events
            this.setupAppEvents();
        } catch (error) {
            logger.error('Error initializing application:', error);
            app.exit(1);
        }
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

            // Create tray
            const tray = this.createTray(provider, windowName);
            this.trays.set(windowName, tray);

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
                this.handleNotificationStateChange(provider, windowName, isActive);
            }
        });
    }

    handleNotificationStateChange(provider, windowName, isActive) {
        const tray = this.trays.get(windowName);
        if (!tray) {
            return;
        }

        const notificationTimer = this.notificationTimers.get(windowName);
        if (notificationTimer) {
            clearInterval(notificationTimer);
            this.notificationTimers.delete(windowName);
        }

        if (isActive) {
            // Start blinking
            const interval = provider.getNotificationInterval();
            let notificationState = false;
            this.notificationTimers.set(windowName, setInterval(() => {
                notificationState = !notificationState;
                tray.setImage(provider.getTrayIcon(notificationState).image);
            }, interval));
        } else {
            // Reset to normal icon
            tray.setImage(provider.getTrayIcon(false).image);
        }
    }

    createTray(provider, windowName) {
        const contextMenu = [
            { label: 'Show', click: () => this.showWindow(windowName) },
            { label: 'Hide', click: () => this.hideWindow(windowName) },
            { type: 'separator' },
            { label: 'Quit', click: () => this.quitProvider(windowName) }
        ];

        trayService.createTray(provider.getTrayIcon(false).image, contextMenu);
        return trayService.tray;
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

        const tray = this.trays.get(windowName);
        if (tray) {
            tray.destroy();
            this.trays.delete(windowName);
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
        // Cleanup instance manager
        await instanceManager.cleanup();

        // Cleanup window service
        await windowService.cleanup();

        // Cleanup notification timers
        for (const timer of this.notificationTimers.values()) {
            clearTimeout(timer);
        }

        // Cleanup trays
        for (const tray of this.trays.values()) {
            tray.destroy();
        }

        app.exit(0);
    }
}

module.exports = new AppManager();
