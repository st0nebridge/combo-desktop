const { app, BrowserWindow, dialog, Tray, Menu, nativeTheme } = require('electron');
const electronLocalshortcut = require('electron-localshortcut');
const log = require('electron-log');

// Import window service
const windowService = require('./services/window.service');

// Import provider registry
const providerRegistry = require('./providers/provider.registry');

// Import profile manager
const profileCLI = require('./cli/profile-cli');
const profileManager = require('./services/profile.manager');

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
        this.window = null;
        this.tray = null;
        this.provider = null;
        this.notificationTimer = null;
        this.isNotificationActive = false;
        this.currentNotificationState = false;
        this.trayContextMenu = null;
        this.currentProfile = 'default';

        // Parse command line arguments for profile
        const args = process.argv.slice(1);
        const profileIndex = args.indexOf('--profile');
        if (profileIndex !== -1 && profileIndex + 1 < args.length) {
            this.currentProfile = args[profileIndex + 1];
        }

        // Initialize theme handling
        nativeTheme.on('updated', () => {
            console.log('Theme updated:', { 
                isDark: nativeTheme.shouldUseDarkColors,
                themeSource: nativeTheme.themeSource 
            });
            if (this.tray && this.provider) {
                // Store current menu before destroying tray
                const currentMenu = this.trayContextMenu;
                this.tray.destroy();
                this.tray = null;
                this.createTray();
                if (currentMenu) {
                    this.tray.setContextMenu(currentMenu);
                    this.trayContextMenu = currentMenu;
                }
                this.updateTrayIcon(this.currentNotificationState);
            }
        });

        // Handle app quit
        app.on('window-all-closed', () => {
            windowService.closeAllWindows();
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });

        app.on('before-quit', () => {
            windowService.closeAllWindows();
        });
    }

    validateProvider() {
        const args = process.argv.slice(1);
        // Check if any provider argument is present
        const hasProvider = availableProviders.some(provider => 
            args.includes(provider.commandArg)
        );

        if (!hasProvider) {
            const providerList = availableProviders
                .map(p => `${p.commandArg} (${p.name})`)
                .join('\n');

            const message = `No provider specified. Please use one of the following command arguments:\n\n${providerList}`;
            
            dialog.showErrorBox('Provider Required', message);
            log.error(message);
            app.exit(1);
        }
    }

    // Update tray icon based on notification state
    updateTrayIcon(notificationState = false) {
        if (!this.tray || !this.provider) {
            return;
        }
        
        const trayIconInfo = this.provider.getTrayIcon(notificationState);
        this.tray.setImage(trayIconInfo.image);
        this.currentNotificationState = notificationState;
    }

    // Handle notification state changes
    handleNotificationStateChange(isActive) {
        if (this.isNotificationActive === isActive) {
            return;
        }
        
        this.isNotificationActive = isActive;
        if (isActive) {
            // Start blinking
            const interval = this.provider.getNotificationInterval();
            this.notificationTimer = setInterval(() => {
                this.currentNotificationState = !this.currentNotificationState;
                this.updateTrayIcon(this.currentNotificationState);
            }, interval);
        } else {
            // Stop blinking
            if (this.notificationTimer) {
                clearInterval(this.notificationTimer);
                this.notificationTimer = null;
            }
            this.currentNotificationState = false;
            this.updateTrayIcon(false);
        }
    }

    async createWindow() {
        try {
            this.validateProvider();

            // Initialize provider first without window
            this.provider = providerRegistry.createProvider(process.argv.slice(1));
            if (!this.provider) {
                throw new Error('Failed to initialize provider');
            }

            // Get or create profile before window creation
            let profile;
            try {
                profile = await this.getOrCreateProfile();
                if (!profile) {
                    app.exit(0);
                    return;
                }

                // Configure provider session
                const partition = profileManager.getPartitionName(this.provider.getName(), this.currentProfile);
                log.info(`Using partition: ${partition}`);
                this.provider.configureSession(partition);

            } catch (error) {
                log.error('Error managing profile:', error);
                throw error;
            }

            // Create window with provider's configuration
            this.window = await this.provider.spawnWindow(this.currentProfile);

            // Setup event handlers for the window
            this.setupWindowEvents();

            // Setup tray icon
            this.createTray();

        } catch (error) {
            log.error('Error creating window:', error);
            dialog.showErrorBox('Error', `Failed to create window: ${error.message}`);
            app.exit(1);
        }
    }

    async getOrCreateProfile() {
        try {
            let profile = profileManager.getProfile(this.provider.getName(), this.currentProfile);

            // Handle non-default profiles that don't exist
            if (!profile && this.currentProfile !== 'default') {
                const response = await dialog.showMessageBox({
                    type: 'question',
                    buttons: ['Cancel', 'Create Profile'],
                    defaultId: 1,
                    title: 'Create New Profile',
                    message: `Profile '${this.currentProfile}' does not exist for ${this.provider.getName()}.`,
                    detail: 'Would you like to create it?'
                });

                if (response.response === 0) {
                    return null;
                }
            }

            // Create profile if it doesn't exist
            if (!profile) {
                profile = profileManager.createProfile(this.provider.getName(), this.currentProfile);
                log.info(`Created new profile: ${profile}`);
            }

            return profile;

        } catch (error) {
            log.error('Error in getOrCreateProfile:', error);
            throw error;
        }
    }

    setupWindowEvents() {
        this.window.on('close', (event) => {
            if (!this.window.isQuitting) {
                event.preventDefault();
                this.window.hide();
            }
        });
    }

    setupShortcuts() {
        electronLocalshortcut.register(this.window, 'Esc', () => {
            this.window.hide();
        });
    }

    createTray() {
        if (this.tray) {
            return;
        }

        // Get icon with notification state
        const trayIconInfo = this.provider.getTrayIcon(this.currentNotificationState);
        this.tray = new Tray(trayIconInfo.image);
        
        // Create context menu
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show',
                click: () => {
                    this.window.show();
                    this.window.focus();
                }
            },
            {
                label: 'Exit',
                click: () => {
                    this.window.isQuitting = true;
                    app.quit();
                }
            }
        ]);
        
        this.tray.setContextMenu(contextMenu);
        this.trayContextMenu = contextMenu; // Store menu reference
        
        this.tray.on('click', () => {
            if (this.window.isVisible()) {
                this.window.hide();
            } else {
                this.window.show();
                this.window.focus();
            }
        });
    }
}

// Initialize app
app.on('ready', () => {
    log.info('Application starting...');
    const appManager = new AppManager();
    appManager.createWindow();
});
