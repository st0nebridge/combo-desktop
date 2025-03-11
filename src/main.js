const { app, dialog, Tray, Menu, nativeTheme } = require('electron');
const log = require('electron-log');

// Import services
const windowService = require('./services/window.service');
const instanceManager = require('./services/instance.manager');
const profileManager = require('./services/profile.manager');

// Import provider registry
const providerRegistry = require('./providers/provider.registry');

// Import CLI handlers
const profileCLI = require('./cli/profile-cli');
const providerCLI = require('./cli/provider-cli');

// Configure logging
log.transports.console.level = 'debug';
log.transports.file.level = 'debug';
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
log.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] {text}';
log.catchErrors();
log.info('Logging initialized');

// Log available providers
const availableProviders = providerRegistry.getAvailableProviders();
log.info('Available providers:', availableProviders);

// Handle profile CLI commands
const profileCommandIndex = process.argv.indexOf('--profiles');
if (profileCommandIndex !== -1) {
    app.whenReady().then(() => {
        profileCLI.handleCommand(process.argv.slice(profileCommandIndex + 1));
    });
    return;
}

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
                    log.info('Reset lock command executed successfully');
                    app.exit(0);
                } else {
                    log.error('Failed to reset lock');
                    app.exit(1);
                }
                return;
            }

            // Initialize instance manager
            const initialized = await instanceManager.initialize();
            if (!initialized) {
                log.info('Another instance is already running');
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
                        log.warn(`Failed to initialize provider: ${providerArg}`);
                    }
                } catch (error) {
                    log.error(`Error initializing provider ${providerArg}:`, error);
                }
            }

            // If no windows were created, quit the app
            if (windowService.getAllWindows().length === 0) {
                log.warn('No windows created, quitting application');
                app.exit(1);
                return;
            }

            // Setup app events
            this.setupAppEvents();
        } catch (error) {
            log.error('Error initializing application:', error);
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
                log.error('Error managing profile:', error);
                throw error;
            }

            // Check if session can be registered
            const canRegister = await instanceManager.registerSession(provider, profile);
            if (!canRegister) {
                if (!providerCLI.shouldForceNewInstance()) {
                    log.info(`Session ${provider.getName()}:${profile} already exists in another instance`);
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
            log.error('Error initializing provider:', error);
            throw error;
        }
    }

    createTray(provider, windowName) {
        const tray = new Tray(provider.getTrayIcon(false).image);
        const contextMenu = Menu.buildFromTemplate([
            { label: 'Show', click: () => this.showWindow(windowName) },
            { label: 'Hide', click: () => this.hideWindow(windowName) },
            { type: 'separator' },
            { label: 'Quit', click: () => this.quitProvider(windowName) }
        ]);
        tray.setContextMenu(contextMenu);
        tray.setToolTip(provider.getName());

        tray.on('click', () => {
            const window = windowService.getWindowByName(windowName);
            if (window) {
                if (window.isVisible()) {
                    window.hide();
                } else {
                    window.show();
                }
            }
        });

        return tray;
    }

    setupWindowEvents(provider, windowName) {
        const window = windowService.getWindowByName(windowName);
        if (!window) return;

        window.on('close', (event) => {
            event.preventDefault();
            this.hideWindow(windowName);
        });

        // Handle window-specific notifications
        provider.on('notification-state-changed', (isActive) => {
            this.handleNotificationStateChange(provider, windowName, isActive);
        });
    }

    handleNotificationStateChange(provider, windowName, isActive) {
        const tray = this.trays.get(windowName);
        if (!tray) return;

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

    handleThemeUpdate() {
        for (const [windowName, tray] of this.trays) {
            const window = windowService.getWindowByName(windowName);
            if (!window) continue;

            const [providerName] = windowName.split(':');
            const provider = providerRegistry.createProvider([`--${providerName.toLowerCase()}`]);
            if (provider) {
                tray.setImage(provider.getTrayIcon(false).image);
            }
        }
    }

    showWindow(windowName) {
        const window = windowService.getWindowByName(windowName);
        if (window) {
            window.show();
        }
    }

    hideWindow(windowName) {
        const window = windowService.getWindowByName(windowName);
        if (window) {
            window.hide();
        }
    }

    async quitProvider(windowName) {
        const window = windowService.getWindowByName(windowName);
        if (!window) return;

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
        // Cleanup all windows and trays
        for (const windowMeta of windowService.getAllWindows()) {
            if (windowMeta.name) {
                await this.quitProvider(windowMeta.name);
            }
        }

        // Cleanup instance manager
        await instanceManager.cleanup();

        app.exit(0);
    }

    showProviderRequiredError() {
        const providerList = availableProviders
            .map(p => `${p.commandArg} (${p.name})`)
            .join('\n');

        const message = `No provider specified. Please use one of the following command arguments:\n\n${providerList}`;
        dialog.showErrorBox('Provider Required', message);
        log.error(message);
        app.exit(1);
    }

    setupAppEvents() {
        // Setup app events
    }
}

// Initialize app
app.whenReady().then(async () => {
    log.info('Application starting...');
    const appManager = new AppManager();
    await appManager.initialize();
});
