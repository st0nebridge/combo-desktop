const { app, BrowserWindow, dialog, session, Tray, Menu, nativeTheme, ipcMain } = require('electron');
const path = require('path');
const electronLocalshortcut = require('electron-localshortcut');
const log = require('electron-log');
const profileCLI = require('./cli/profile-cli');

// Import provider registry
const providerRegistry = require('./providers/provider.registry');

// Import profile manager
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

            // Initialize window first
            const windowConfig = {
                width: 1000,
                height: 800,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    webSecurity: true
                }
            };
            
            this.window = new BrowserWindow(windowConfig);

            // Initialize provider with window
            this.provider = providerRegistry.createProvider(this.window, process.argv.slice(1));
            if (!this.provider) {
                throw new Error('Failed to initialize provider');
            }

            // Get or create profile
            let profile;
            try {
                profile = profileManager.getProfile(this.provider.getName(), this.currentProfile);

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
                        app.exit(0);
                        return;
                    }
                }

                // Create profile if it doesn't exist
                if (!profile) {
                    profile = profileManager.createProfile(this.provider.getName(), this.currentProfile);
                    log.info(`Created new profile: ${profile}`);
                }

                // Get partition name for the profile
                const partition = profileManager.getPartitionName(this.provider.getName(), this.currentProfile);
                log.info(`Using partition: ${partition}`);

                // Configure user agent for the provider's session
                this.provider.configureSession(partition);

            } catch (error) {
                log.error('Error managing profile:', error);
                throw error;
            }

            // Set provider window and webContents
            this.provider.window = this.window;
            this.provider.webContents = this.window.webContents;
            
            // Setup event handlers for the window
            this.setupWindowEvents();

            // Initialize the provider
            this.provider.initialize(this.currentProfile);

            // Get web preferences from provider
            const webPreferences = {
                ...this.provider.getWebPreferences(),
                partition: profileManager.getPartitionName(this.provider.getName(), this.currentProfile),
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: true,
                preload: path.join(__dirname, 'preload.js')
            };

            // In newer Electron versions, we can't modify web preferences after window creation
            // We need to recreate the window with the new preferences
            const bounds = this.window.getBounds();
            this.window.close();
            
            // Create a new window with the updated preferences
            this.window = new BrowserWindow({
                width: bounds.width || 1000,
                height: bounds.height || 800,
                x: bounds.x,
                y: bounds.y,
                icon: this.provider.getAppIconPath(),
                title: this.provider.getName(),
                webPreferences
            });
            
            // Re-setup window events and shortcuts
            this.setupWindowEvents();
            this.setupShortcuts();
            
            // Load the URL
            this.window.loadURL(this.provider.getUrl());

            // Update window icon with provider's icon
            this.window.setIcon(this.provider.getAppIconPath());

            // Create tray icon
            this.createTray();

            // Set up IPC handlers for notifications
            ipcMain.on('notification-state-changed', (event, isActive) => {
                this.handleNotificationStateChange(isActive);
            });

            log.info('Browser window created.');

        } catch (error) {
            dialog.showErrorBox('Error', error.message);
            log.error(error.message);
            app.exit(1);
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

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (appManager.window === null) {
        appManager.createWindow();
    }
});
