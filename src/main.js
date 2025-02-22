const { app, BrowserWindow, dialog, session, Tray, Menu, nativeImage, nativeTheme, ipcMain } = require('electron');
const electronLocalshortcut = require('electron-localshortcut');
const log = require('electron-log');
const Store = require('electron-store');
const path = require('path');

// Import provider registry
const providerRegistry = require('./providers/provider.registry');

// Configure logging
log.initialize({ preload: true });

// Initialize store
const store = new Store();

// Log available providers
const availableProviders = providerRegistry.getAvailableProviders();
log.info('Available providers:', availableProviders);

class AppManager {
    constructor() {
        this.window = null;
        this.provider = null;
        this.tray = null;
        this.notificationTimer = null;
        this.isNotificationActive = false;
        this.currentNotificationState = false;
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

    // Helper to invert icon colors for light mode
    invertIconIfNeeded(iconPath) {
        if (nativeTheme.shouldUseDarkColors) {
            return nativeImage.createFromPath(iconPath);
        }
        
        const image = nativeImage.createFromPath(iconPath);
        // Invert the image colors
        return image.invert();
    }

    // Update tray icon based on notification state
    updateTrayIcon(notificationState = false) {
        if (!this.tray || !this.provider) return;

        const iconInfo = this.provider.getTrayIconPath(notificationState);
        const icon = this.invertIconIfNeeded(iconInfo.path);
        this.tray.setImage(icon);
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

            // Handle theme changes
            nativeTheme.on('updated', () => {
                this.updateTrayIcon(this.currentNotificationState);
            });

            // Set up window event handlers
            this.window.on('closed', () => {
                this.window = null;
            });

            this.setupWindowEvents();
            this.setupShortcuts();

            // Initialize the provider
            this.provider.initialize();

            log.info('Browser window created.');

            // Load the appropriate URL
            const serviceUrl = this.provider instanceof require('./providers/facebook.provider') ? 'https://www.messenger.com/login' : 'https://web.whatsapp.com/';
            this.window.loadURL(serviceUrl);
        } catch (error) {
            dialog.showErrorBox('Error', error.message);
            log.error(error.message);
            app.exit(1);
        }
    }

    setupWindowEvents() {
        this.window.on('close', (event) => {
            if (!app.isQuiting) {
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
        const iconInfo = this.provider.getTrayIconPath();
        const icon = this.invertIconIfNeeded(iconInfo.path);
        this.tray = new Tray(icon);
        
        const contextMenu = Menu.buildFromTemplate([
            {
                label: `Show ${this.provider.getName()}`,
                click: () => {
                    this.window.show();
                }
            },
            {
                label: 'Quit',
                click: () => {
                    app.isQuiting = true;
                    app.quit();
                }
            }
        ]);

        this.tray.setToolTip(`Combo Desktop - ${this.provider.getName()}`);
        this.tray.setContextMenu(contextMenu);
        
        this.tray.on('click', () => {
            this.window.isVisible() ? this.window.hide() : this.window.show();
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
