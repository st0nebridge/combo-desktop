const log = require("electron-log");
const userAgentConfig = require('../config/user-agent.config');
const windowService = require('../services/window.service');
const profileManager = require("../services/profile.manager");
const electronLocalshortcut = require('electron-localshortcut');
const { shell } = require('electron');

class BaseProvider {
    constructor(options = {}) {
        if (this.constructor === BaseProvider) {
            throw new Error('BaseProvider is abstract and cannot be instantiated directly');
        }
        
        this.eventsSetup = false;
        this.window = null;
        this.hasNotification = false;
    }

    // Return the name of this provider
    getName() {
        throw new Error('getName() must be implemented by child class');
    }

    // Return the command line argument that activates this provider
    getCommandArg() {
        throw new Error('getCommandArg() must be implemented by child class');
    }

    // Return the URL that this provider should load
    getUrl() {
        throw new Error('getUrl() must be implemented by child class');
    }

    // Default notification blink interval in milliseconds
    getNotificationInterval() {
        return 3000; // 3 seconds
    }

    // Get the base icon path for this provider
    getBaseIconPath() {
        throw new Error('getBaseIconPath() must be implemented by child class');
    }
    
    // Get window configuration
    getWindowConfig() {
        return {
            width: 1000,
            height: 800
        };
    }

    // Get web preferences
    getWebPreferences() {
        return {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true
        };
    }

    // Get electron profile name
    getPartitionName(profile) {
        if (!profile || typeof profile !== 'string') {
            profile = 'default';
        }
        return profileManager.getPartitionName(this.getName(), profile);
    }

    // Optional: Custom JS injection
    injectCustomJS() {
        // Default implementation does nothing
    }

    setupEventHandlers() {
        // Provider specific event handlers
    }

    // Spawn new window
    async spawnWindow(profile) {
        try {
            let windowConfig = this.getWindowConfig();
            let webPreferences = this.getWebPreferences();

            if (webPreferences.partition) {
                log.warn('Partition property in web preferences will be ignored. Use profiles instead.');
            }

            windowConfig.webPreferences = {
                ...webPreferences,
                partition: this.getPartitionName(profile)
            };
            
            const windowName = `${this.getName()}:${profile}`;
            this.window = windowService.createWindow(windowConfig, windowName, {
                provider: this,
                profile
            });

            await this.initializeWindow(profile);

            return this.window;
        } catch (error) {
            log.error(`[${this.getName()}] Error spawning window:`, error);
            return null;
        }
    }

    // Initialize the window with provider-specific configuration
    async initializeWindow(profile) {
        if (!this.window || !this.window.webContents) {
            throw new Error('Window not properly initialized');
        }

        try {
            // Configure session before loading URL
            const partition = this.getPartitionName(profile);
            this.configureSession(partition);

            // Register ESC shortcut to minimize window
            electronLocalshortcut.register(this.window, 'Esc', () => {
                if (this.window) {
                    this.window.hide();
                }
            });

            // Handle external URLs
            this.window.webContents.setWindowOpenHandler((details) => {
                if (details.url) {
                    shell.openExternal(details.url).catch(err => {
                        log.error(`[${this.getName()}] Error opening external URL:`, err);
                    });
                }
                return { action: 'deny' };
            });

            // Load the provider URL
            const url = this.getUrl();
            if (!url) {
                throw new Error('Provider URL not specified');
            }
            
            log.info(`[${this.getName()}] Initializing window with URL: ${url}`);
            await this.window.loadURL(url);
            
            // Inject any custom JS
            this.injectCustomJS();
            
            // Call provider-specific initialization
            await this.initializeProvider(profile);
            
            log.info(`[${this.getName()}] Window initialization complete`);
        } catch (error) {
            log.error(`[${this.getName()}] Error initializing window:`, error);
            throw error;
        }
    }

    /**
     * Initialize provider-specific functionality
     * @param {string} profile Profile name
     */
    async initializeProvider(profile) {
        log.info(`Initializing ${this.getName()} provider with profile:`, profile);

        if (!this.eventsSetup) {
            this.setupEventHandlers();
            this.eventsSetup = true;
        }
    }

    /**
     * Get the tray icon path for this provider
     * @param {boolean} hasNotification - Whether there is a notification
     * @returns {Object} Object containing icon path and theme info
     */
    getTrayIcon(hasNotification = false) {
        const { getIconPath } = require('../utils/icons');
        return getIconPath(this.getBaseIconPath(), hasNotification);
    }

    // Start notification blinking
    startNotification() {
        if (!this.hasNotification) {
            this.hasNotification = true;
            // The actual blinking will be handled by the main process
            if (this.window && this.window.webContents) {
                this.window.webContents.send('notification-state-changed', true);
            }
        }
    }

    // Stop notification blinking
    stopNotification() {
        if (this.hasNotification) {
            this.hasNotification = false;
            if (this.window && this.window.webContents) {
                this.window.webContents.send('notification-state-changed', false);
            }
        }
    }

    /**
     * Get the user agent string for this provider
     * @returns {string} The user agent string
     */
    getUserAgent() {
        return userAgentConfig.DEFAULT_USER_AGENT;
    }

    /**
     * Get client hint headers for this provider
     * @returns {Object} The client hint headers
     */
    getClientHints() {
        return userAgentConfig.DEFAULT_CLIENT_HINTS;
    }

    /**
     * Configure the session for this provider
     * @param {string} partition - Session partition name
     */
    configureSession(partition) {
        if (!partition || typeof partition !== 'string') {
            throw new Error(`Invalid partition name: ${partition}`);
        }

        const { session } = require('electron');
        const ses = session.fromPartition(partition);

        // Set user agent
        const userAgent = this.getUserAgent();
        if (userAgent) {
            ses.setUserAgent(userAgent);
            log.info(`[${this.getName()}] Set user agent for partition ${partition}`);
        }

        // Set client hints
        const clientHints = this.getClientHints();
        if (clientHints) {
            ses.webRequest.onBeforeSendHeaders((details, callback) => {
                // Only modify headers for URLs from this provider
                if (details.url.startsWith(this.getUrl())) {
                    // Preserve existing headers
                    const headers = { ...details.requestHeaders };

                    // Add client hint headers
                    for (const [key, value] of Object.entries(clientHints)) {
                        headers[key] = value;
                    }

                    callback({ cancel: false, requestHeaders: headers });
                } else {
                    callback({ cancel: false });
                }
            });
            log.info(`[${this.getName()}] Set client hints for partition ${partition}`);
        }

        // Allow provider-specific session configuration
        this.configureProviderSession(ses);
    }

    /**
     * Provider-specific session configuration
     * @param {Electron.Session} session - Electron session object
     */
    configureProviderSession(session) {
        // Default implementation does nothing
        // Child classes can override this to add provider-specific session configuration
    }

    /**
     * Get storage names for this provider
     * @returns {Array<string>} Array of storage names
     */
    getStoragesNames() {
        return ['appcache', 'cookies', 'localstorage'];
    }

    /**
     * Clear session data for this provider
     */
    async clearSessionData() {
        if (!this.window || !this.window.webContents) {
            return;
        }

        try {
            const { session } = this.window.webContents;
            const storages = this.getStoragesNames();

            await session.clearStorageData({
                storages
            });
            log.info(`[${this.getName()}] Session data cleared:`, storages);
        } catch (error) {
            log.error(`[${this.getName()}] Error clearing session data:`, error);
        }
    }

    // Get base context menu options that can be extended by providers
    getContextMenuOptions() {
        return [
            {
                label: 'Show/Hide Window',
                click: () => {
                    if (this.window) {
                        windowService.toggleWindow(this.window);
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => {
                    if (this.window) {
                        windowService.closeWindow(this.window, true);
                    }
                }
            }
        ];
    }

    // Handle single click on tray icon - can be overridden by providers
    handleTrayClick() {
        // Empty handler for provider override
    }

    // Handle double click on tray icon - can be overridden by providers
    handleTrayDoubleClick() {
        if (this.window) {
            windowService.toggleWindow(this.window);
        }
    }
}

module.exports = BaseProvider;
