const { app, BrowserWindow, dialog, session, Tray, Menu, nativeImage, nativeTheme, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const electronLocalshortcut = require('electron-localshortcut');
const log = require('electron-log');
const profileCLI = require('./cli/profile-cli');

// Import provider registry
const providerRegistry = require('./providers/provider.registry');

// Import profile manager
const profileManager = require('./services/profile.manager');

// Import user agent configuration
const userAgentConfig = require('./config/user-agent.config');

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
            const userAgent = userAgentConfig.DEFAULT_USER_AGENT;
            log.info('Using global user agent:', userAgent);
            
            // Update the user agent for all sessions
            session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
                details.requestHeaders['User-Agent'] = userAgent;
                callback({ requestHeaders: details.requestHeaders });
            });

            // For WhatsApp specifically, set up a more aggressive user agent override
            if (process.argv.includes('--whatsapp')) {
                // Get the partition name for WhatsApp
                const whatsAppPartition = profileManager.getPartitionName('WhatsApp', this.currentProfile);
                const whatsAppSession = session.fromPartition(whatsAppPartition);
                
                // Clear all cookies and cache for WhatsApp to ensure fresh session
                whatsAppSession.clearStorageData().then(() => {
                    log.info('Cleared WhatsApp session data');
                });
                
                // Set user agent for WhatsApp session using centralized config
                const whatsAppUserAgent = userAgentConfig.getUserAgentForProvider('WhatsApp');
                const clientHintHeaders = userAgentConfig.CLIENT_HINT_HEADERS;
                
                log.info('Using WhatsApp-specific user agent:', whatsAppUserAgent);
                log.info('Using client hint headers:', JSON.stringify(clientHintHeaders));
                
                whatsAppSession.webRequest.onBeforeSendHeaders((details, callback) => {
                    details.requestHeaders['User-Agent'] = whatsAppUserAgent;
                    // Add additional headers that might help with compatibility
                    Object.keys(clientHintHeaders).forEach(key => {
                        details.requestHeaders[key] = clientHintHeaders[key];
                    });
                    callback({ requestHeaders: details.requestHeaders });
                });
            }

            this.window = new BrowserWindow({
                width: 1000,
                height: 800,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    webSecurity: true,
                    preload: path.join(__dirname, 'preload.js')
                }
            });

            // Create and initialize the provider using the registry
            this.provider = providerRegistry.createProvider(this.window, process.argv.slice(1));
            log.info(`Initializing ${this.provider.getName()} provider with profile ${this.currentProfile}...`);

            // Set provider window and webContents
            this.provider.window = this.window;
            this.provider.webContents = this.window.webContents;
            
            // Setup event handlers for the window
            this.setupWindowEvents();
            
            // Initialize the provider
            this.provider.initialize(this.currentProfile);

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
                    const partition = profileManager.createProfile(this.provider.getName(), this.currentProfile);
                    log.info(`Created new profile: ${partition}`);
                }
            } catch (error) {
                log.error('Error managing profile:', error);
                throw error;
            }

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
            
            // Set up IPC handler for bypass method
            ipcMain.on('bypass-method-effective', (event, method) => {
                log.info('*************************************');
                log.info(`EFFECTIVE BYPASS METHOD: ${method}`);
                log.info('*************************************');
            });

            // Handle IPC events
            ipcMain.on('notification-state-changed', (event, isActive) => {
                console.log('Notification state changed:', isActive);
                // Handle notification state change
            });

            // Handle bypass method reporting
            ipcMain.on('bypass-method-effective', (event, method) => {
                console.log('Effective bypass method:', method);
                
                try {
                    // Log the effective bypass method
                    const electron = require('electron');
                    const logPath = path.join(electron.app.getPath('userData'), 'bypass-method.log');
                    const logEntry = `${new Date().toISOString()} - Effective bypass method: ${method}\n`;
                    
                    fs.appendFile(logPath, logEntry, (err) => {
                        if (err) {
                            console.error('Failed to write to bypass method log:', err);
                        } else {
                            console.log('Bypass method logged to:', logPath);
                        }
                    });
                } catch (error) {
                    console.error('Error writing bypass method log:', error);
                }
            });

            // Handle user agent requests
            ipcMain.handle('get-user-agent', (event) => {
                // Get the provider for the current window
                const win = BrowserWindow.fromWebContents(event.sender);
                if (!win) {
                    console.error('Could not find window for WebContents');
                    return null;
                }
                
                // Get the provider for this window
                const provider = win.provider;
                if (!provider) {
                    console.error('No provider associated with this window');
                    return null;
                }
                
                // Return the user agent information
                return {
                    userAgent: provider.options.userAgent,
                    clientHintHeaders: provider.options.clientHintHeaders
                };
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
