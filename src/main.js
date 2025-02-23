const { app, BrowserWindow, dialog, session, Tray, Menu, nativeImage, nativeTheme, ipcMain } = require('electron');
const path = require('path');
const electronLocalshortcut = require('electron-localshortcut');
const log = require('electron-log');

// Import provider registry
const providerRegistry = require('./providers/provider.registry');

// Configure logging
log.initialize({ preload: true });

// Log available providers
const availableProviders = providerRegistry.getAvailableProviders();
log.info('Available providers:', availableProviders);

class AppManager {
    constructor() {
        this.window = null;
        this.tray = null;
        this.provider = null;
        this.notificationTimer = null;
        this.isNotificationActive = false;
        this.currentNotificationState = false;
        this.trayContextMenu = null;

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
        if (!this.tray || !this.provider) return;
        
        const trayIconInfo = this.provider.getTrayIcon(notificationState);
        this.tray.setImage(trayIconInfo.image);
        this.currentNotificationState = notificationState;
    }

    // Handle notification state changes
    handleNotificationStateChange(isActive) {
        if (this.isNotificationActive === isActive) return;
        
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

            // Set modern Chrome user agent
            const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
            
            // Update the user agent for all sessions
            session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
                details.requestHeaders['User-Agent'] = userAgent;
                callback({ requestHeaders: details.requestHeaders });
            });

            this.window = new BrowserWindow({
                width: 1000,
                height: 800,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    webSecurity: true,
                }
            });

            // Create and initialize the provider using the registry
            this.provider = providerRegistry.createProvider(this.window, process.argv.slice(1));
            log.info(`Initializing ${this.provider.getName()} provider...`);

            // Update window icon with provider's icon
            this.window.setIcon(this.provider.getAppIconPath());

            // Create tray icon
            this.createTray();

            // Set up IPC handlers for notifications
            ipcMain.on('notification-state-changed', (event, isActive) => {
                this.handleNotificationStateChange(isActive);
            });

            this.setupWindowEvents();
            this.setupShortcuts();

            // Initialize the provider
            this.provider.initialize();

            log.info('Browser window created.');

            // Load the provider URL
            this.window.loadURL(this.provider.getUrl());
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
        if (this.tray) return;

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
