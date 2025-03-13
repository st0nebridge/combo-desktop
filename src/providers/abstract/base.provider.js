/**
 * @file Abstract base provider that defines the core interface and functionality
 * for all application service providers. Handles window management, notifications,
 * and provider-specific configurations.
 * 
 * Required implementations by child classes:
 * - getName(): Provider's display name
 * - getCommandArg(): CLI argument that activates this provider
 * - getUrl(): URL that this provider should load
 * - getBaseIconPath(): Base icon path for this provider
 */

const log = require('electron-log');
const userAgentConfig = require('../../config/user-agent.config');
const windowService = require('../../services/window.service');
const profileManager = require("../../services/profile.manager");
const electronLocalshortcut = require('electron-localshortcut');
const { shell } = require('electron');
const trayService = require('../../services/tray.service');
const path = require('path');

/**
 * Abstract base class for all application providers.
 * Defines the core functionality and interface that all providers must implement.
 * Handles window management, notifications, and provider-specific configurations.
 * @class BaseProvider
 * @abstract
 */
class BaseProvider {
    /**
     * Creates a new BaseProvider instance.
     * @constructor
     * @throws {Error} If attempting to instantiate BaseProvider directly
     */
    constructor() {
        if (this.constructor === BaseProvider) {
            throw new Error('BaseProvider is abstract and cannot be instantiated directly');
        }
        
        /** @property {boolean} eventsSetup - Whether event handlers have been initialized */
        this.eventsSetup = false;
        
        /** @property {Electron.BrowserWindow} window - The provider's browser window instance */
        this.window = null;
        
        /** @property {boolean} hasNotification - Whether the provider has active notifications */
        this.hasNotification = false;
        
        /** @property {string} profile - Profile name */
        this.profile = null;
    }

    /**
     * Returns the display name of the provider.
     * @abstract
     * @method getName
     * @returns {string} The provider's display name
     * @throws {Error} If not implemented by child class
     */
    getName() {
        throw new Error('getName() must be implemented by child class');
    }

    /**
     * Returns the command line argument that activates this provider.
     * @abstract
     * @method getCommandArg
     * @returns {string} The command line argument
     * @throws {Error} If not implemented by child class
     */
    getCommandArg() {
        throw new Error('getCommandArg() must be implemented by child class');
    }

    /**
     * Returns the URL that this provider should load.
     * @abstract
     * @method getUrl
     * @returns {string} The provider's URL
     * @throws {Error} If not implemented by child class
     */
    getUrl() {
        throw new Error('getUrl() must be implemented by child class');
    }

    /**
     * Returns the notification blink interval in milliseconds.
     * @returns {number} The notification interval in milliseconds
     */
    getNotificationInterval() {
        return 3000; // 3 seconds
    }

    /**
     * Returns the base icon path for this provider.
     * @returns {string} The base icon path
     */
    getBaseIconPath() {
        return path.join(__dirname, '..', '..', 'assets', 'icons', this.getName().toLowerCase());
    }
    
    /**
     * Returns the window configuration for this provider.
     * @returns {Object} Window configuration object
     * @property {number} width - Window width in pixels
     * @property {number} height - Window height in pixels
     */
    getWindowConfig() {
        return {
            width: 1000,
            height: 800
        };
    }

    /**
     * Returns the web preferences configuration.
     * @returns {Object} Web preferences configuration
     * @property {boolean} nodeIntegration - Whether Node.js integration is enabled
     * @property {boolean} contextIsolation - Whether context isolation is enabled
     * @property {boolean} webSecurity - Whether web security is enabled
     */
    getWebPreferences() {
        return {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true
        };
    }

    /**
     * Returns the Electron partition name for profile isolation.
     * @param {string} [profile='default'] - Profile name
     * @returns {string} The partition name
     */
    getPartitionName(profile) {
        if (!profile || typeof profile !== 'string') {
            profile = 'default';
        }
        return profileManager.getPartitionName(this.getName(), profile);
    }

    /**
     * Injects custom JavaScript into the provider's window.
     * Override this method to add provider-specific JavaScript.
     */
    injectCustomJS() {
        // Default implementation does nothing
    }

    /**
     * Sets up provider-specific event handlers.
     * Override this method to add custom event handling.
     */
    setupEventHandlers() {
        // Provider specific event handlers
    }

    /**
     * Spawns a new window for the provider.
     * @param {string} profile - Profile name for window isolation
     * @param {Object} metadata - Additional metadata for the window
     * @returns {Promise<Electron.BrowserWindow|null>} The created window or null if creation fails
     */
    async spawnWindow(profile, metadata = {}) {
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
                ...metadata,
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

    /**
     * Initializes the provider's window with specific configuration.
     * @param {string} profile - Profile name
     * @returns {Promise<void>}
     * @throws {Error} If window is not properly initialized
     */
    async initializeWindow(profile) {
        if (!this.window || !this.window.webContents) {
            throw new Error('Window not properly initialized');
        }

        try {
            // Configure session before loading URL
            const partition = this.getPartitionName(profile);
            this.configureSession(partition);

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
     * Initializes provider-specific functionality.
     * @param {string} profile - Profile name
     * @returns {Promise<void>}
     */
    async initializeProvider(profile) {
        log.info(`Initializing ${this.getName()} provider with profile:`, profile);

        if (!this.eventsSetup) {
            this.setupEventHandlers();
            this.eventsSetup = true;
        }
    }

    /**
     * Configures the session for this provider.
     * @param {string} partition - The session partition name
     * @private
     */
    configureSession(partition) {
        const session = require('electron').session;
        const partitionSession = session.fromPartition(partition);
        
        // Set user agent
        const userAgent = userAgentConfig.getUserAgent(this.getName());
        if (userAgent) {
            partitionSession.setUserAgent(userAgent);
            log.info(`[${this.getName()}] Set user agent for partition ${partition}: ${userAgent}`);
        }
    }

    /**
     * Gets the tray icon path for this provider.
     * @param {boolean} [hasNotification=false] - Whether there is a notification
     * @returns {Object} Object containing icon path and theme info
     */
    getTrayIcon(hasNotification = false) {
        const { getIconPath } = require('../../utils/icons');
        return getIconPath(this.getBaseIconPath(), hasNotification);
    }

    /**
     * Starts the notification blinking effect.
     * Triggers notification state change in the main process.
     */
    startNotification() {
        if (!this.hasNotification) {
            this.hasNotification = true;
            // The actual blinking will be handled by the main process
            if (this.window && this.window.webContents) {
                this.window.webContents.send('notification-state-changed', true);
            }
        }
    }

    /**
     * Stops the notification blinking effect.
     * Updates notification state in the main process.
     */
    stopNotification() {
        if (this.hasNotification) {
            this.hasNotification = false;
            if (this.window && this.window.webContents) {
                this.window.webContents.send('notification-state-changed', false);
            }
        }
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

    /**
     * Get base context menu options that can be extended by providers
     * @returns {Array<Object>} Array of context menu options
     */
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
                        const windowName = `${this.getName()}:${this.window?.metadata?.profile || 'default'}`;
                        // Remove tray icon first
                        trayService.destroyTray(windowName);
                        // Then close window with force flag
                        windowService.closeWindow(this.window, true);
                    }
                }
            }
        ];
    }

    /**
     * Get tray menu template
     * @returns {Array<Object>} Menu template
     */
    getTrayMenuTemplate() {
        return [
            {
                label: 'Show/Hide',
                click: () => this.handleTrayClick()
            },
            {
                label: 'Profile',
                submenu: [
                    {
                        label: this.profile || 'default',
                        enabled: false
                    }
                ]
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => {
                    if (this.window) {
                        this.window.forceClose = true;
                        this.window.close();
                    }
                }
            }
        ];
    }

    /**
     * Handle single click on tray icon
     * Empty handler for provider override
     */
    handleTrayClick() {
        if (this.window) {
            windowService.toggleWindow(this.window);
        }
    }

    /**
     * Handle double click on tray icon
     * Shows and focuses the window
     */
    handleTrayDoubleClick() {
        if (this.window) {
            windowService.showWindow(this.window);
        }
    }
}

module.exports = BaseProvider;
