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
        
        /** @property {boolean} isQuitting - Whether provider is quitting */
        this.isQuitting = false;
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
     * Get the window name for a profile
     * @method getWindowName
     * @param {string} profile - Profile name
     * @returns {string} Window name in format providerName:profile
     */
    getWindowName(profile) {
        return `${this.getName()}:${profile}`;
    }

    /**
     * Initialize the provider with a specific profile
     * @method initializeProvider
     * @param {string} profile - Profile name
     * @returns {Promise<void>}
     */
    async initializeProvider(profile) {
        try {
            if (!profile) {
                throw new Error('Profile name is required');
            }

            // Store profile name
            this.profile = profile;

            // Check if window already exists
            const windowName = this.getWindowName(profile);
            const existingWindow = windowService.getWindow(windowName);
            if (existingWindow && !existingWindow.isDestroyed()) {
                log.info(`Window already exists for ${this.getName()} with profile: ${profile}`);
                this.window = existingWindow;
                return;
            }

            // Create new window if it doesn't exist
            await this.spawnWindow(profile);
            if (!this.window) {
                throw new Error('Failed to create window');
            }

            // Initialize window content
            await this.initializeWindow(profile);

            // Create tray icon after window is initialized
            await trayService.createTray(this, windowName);

            log.info(`Provider ${this.getName()} initialized with profile: ${profile}`);
        } catch (error) {
            log.error(`Error initializing provider ${this.getName()}:`, error);
            throw error;
        }
    }

    /**
     * Initialize the window content
     * @method initializeWindow
     * @param {string} profile - Profile name
     * @returns {Promise<void>}
     */
    async initializeWindow(profile) {
        if (!this.window) {
            throw new Error('Window not available for initialization');
        }

        try {
            // Set user agent
            const userAgent = this.getUserAgent();
            if (userAgent) {
                this.window.webContents.setUserAgent(userAgent);
            }

            // Load provider URL
            const url = this.getUrl();
            if (!url) {
                throw new Error('Provider URL not available');
            }

            await this.window.loadURL(url);

            // Setup window events after load
            this.setupWindowEvents();

            // Inject custom JS after load
            this.injectCustomJS();
            
            // Register keyboard shortcuts after window is fully initialized
            this.registerKeyboardShortcuts();

            log.info(`Window initialized for ${this.getName()} with profile: ${profile}`);
        } catch (error) {
            log.error(`Error initializing window for ${this.getName()}:`, error);
            throw error;
        }
    }

    /**
     * Register keyboard shortcuts for the window
     * @method registerKeyboardShortcuts
     * @private
     */
    registerKeyboardShortcuts() {
        if (!this.window) {
            log.error(`Cannot register shortcuts - no window for ${this.getName()}`);
            return;
        }

        try {
            // Unregister any existing shortcuts first to prevent duplicates
            electronLocalshortcut.unregisterAll(this.window);
            
            // Register ESC shortcut to minimize window to tray
            electronLocalshortcut.register(this.window, 'Escape', () => {
                if (this.window && this.window.isVisible() && !this.window.isDestroyed()) {
                    log.debug(`ESC pressed, minimizing ${this.getName()} to tray`);
                    this.window.hide();
                }
            });
            
            log.debug(`Keyboard shortcuts registered for ${this.getName()}`);
        } catch (error) {
            log.error(`Error registering keyboard shortcuts for ${this.getName()}:`, error);
        }
    }

    /**
     * Setup window events
     * @method setupWindowEvents
     * @private
     */
    setupWindowEvents() {
        if (!this.window) {
            log.error(`Cannot setup events - no window for ${this.getName()}`);
            return;
        }

        // Handle window show event
        this.window.on('show', () => {
            log.debug(`Window shown for ${this.getName()}`);
            const trayService = require('../../services/tray.service');
            trayService.updateTrayIcon(this.getWindowName(this.profile), true);
        });

        // Handle window hide event
        this.window.on('hide', () => {
            log.debug(`Window hidden for ${this.getName()}`);
            const trayService = require('../../services/tray.service');
            trayService.updateTrayIcon(this.getWindowName(this.profile), false);
        });

        // Handle window close event
        this.window.on('close', (event) => {
            // Get app manager to check quitting state
            const appManager = require('../../services/app.manager');
            const windowService = require('../../services/window.service');
            
            // Check both provider's isQuitting flag and global isQuitting flags
            if (!this.window.forceClose && !this.isQuitting && !appManager.isQuitting && !windowService.isQuitting) {
                event.preventDefault();
                this.window.hide();
                const trayService = require('../../services/tray.service');
                trayService.updateTrayIcon(this.getWindowName(this.profile), false);
            }
        });

        // Handle webContents events
        this.window.webContents.on('did-finish-load', () => {
            log.debug(`WebContents finished loading for ${this.getName()}`);
        });

        this.window.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            log.error(`WebContents failed to load for ${this.getName()}:`, errorDescription);
        });
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

            // Get partition name following the required format: ${app.getName()}:${providerName}:${profileName}
            const partitionName = this.getPartitionName(profile);
            log.info(`Using partition: ${partitionName}`);

            windowConfig.webPreferences = {
                ...webPreferences,
                partition: partitionName
            };
            
            const windowName = this.getWindowName(profile);
            log.info(`Creating window: ${windowName} with profile: ${profile}`);

            this.window = windowService.createWindow(windowConfig, windowName, {
                ...metadata,
                provider: this,
                profile
            });

            if (!this.window) {
                throw new Error('Failed to create window');
            }

            return this.window;
        } catch (error) {
            log.error(`[${this.getName()}] Error spawning window:`, error);
            return null;
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
        const userAgent = this.getUserAgent();
        if (userAgent) {
            partitionSession.setUserAgent(userAgent);
            log.info(`[${this.getName()}] Set user agent for partition ${partition}: ${userAgent}`);
        }
    }

    /**
     * Get user agent for this provider
     * @method getUserAgent
     * @returns {string} User agent string for this provider
     */
    getUserAgent() {
        const { DEFAULT_USER_AGENT } = userAgentConfig;
        
        // By default, return the default user agent
        // Child classes should override this method to provide provider-specific user agents
        return DEFAULT_USER_AGENT;
    }

    /**
     * Handle tray click event
     * @method handleTrayClick
     * @returns {void}
     */
    handleTrayClick() {
        try {
            if (!this.window) {
                log.error(`Cannot handle tray click - no window for ${this.getName()}`);
                return;
            }

            // Default behavior: Toggle window visibility
            if (this.window.isVisible()) {
                this.window.hide();
            } else {
                this.window.show();
                this.window.focus();
            }
        } catch (error) {
            log.error(`Error handling tray click for ${this.getName()}:`, error);
        }
    }

    /**
     * Handle tray double click event
     * @method handleTrayDoubleClick
     * @returns {void}
     */
    handleTrayDoubleClick() {
        try {
            if (!this.window) {
                log.error(`Cannot handle tray double click - no window for ${this.getName()}`);
                return;
            }

            // Default behavior: Show and focus window
            this.window.show();
            this.window.focus();
        } catch (error) {
            log.error(`Error handling tray double click for ${this.getName()}:`, error);
        }
    }

    /**
     * Get tray icon configuration
     * @method getTrayIcon
     * @param {boolean} [hasNotification=false] - Whether to show notification state
     * @param {boolean} [isMinimized=false] - Whether window is minimized
     * @returns {Object} Tray icon configuration
     */
    getTrayIcon(hasNotification = false, isMinimized = false) {
        try {
            const { getIconPath } = require('../../utils/icons');
            const image = getIconPath(this.getName(), hasNotification, isMinimized);
            
            if (!image) {
                throw new Error('Invalid tray icon returned from icon utils');
            }

            return {
                image,
                isDarkMode: true, // TODO: Get from theme service
                hasNotification,
                isMinimized
            };
        } catch (error) {
            log.error(`Error getting tray icon for ${this.getName()}:`, error);
            return null;
        }
    }

    /**
     * Get context menu options for the tray
     * @method getContextMenuOptions
     * @returns {Array<Object>} Menu template array
     */
    getContextMenuOptions() {
        const windowName = this.getWindowName(this.profile || 'default');
        return [
            {
                label: 'Show',
                click: () => {
                    const { window } = windowService.resolveWindow(windowName);
                    if (window && !window.isDestroyed()) {
                        window.show();
                        window.focus();
                    }
                }
            },
            {
                label: 'Hide',
                click: () => {
                    const { window } = windowService.resolveWindow(windowName);
                    if (window && !window.isDestroyed()) {
                        window.hide();
                    }
                }
            },
            { type: 'separator' },
            this.getQuitMenuItem()
        ];
    }

    /**
     * Get a reusable Quit menu item for tray and context menus
     * @method getQuitMenuItem
     * @private
     * @returns {Object} Quit menu item
     */
    getQuitMenuItem() {
        return {
            label: 'Quit',
            click: async () => {
                try {
                    // Unregister the session - this will handle:
                    // 1. Cleaning up the session
                    // 2. Destroying the tray icon
                    // 3. Closing the window with forceClose
                    // 4. Triggering the last-session-closed event if needed
                    const instanceManager = require('../../services/instance.manager');
                    log.info(`Requesting session close for ${this.getName()}:${this.profile}`);
                    await instanceManager.unregisterSession(this);
                } catch (error) {
                    log.error('Error in Quit action:', error);
                }
            }
        };
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
            this.getQuitMenuItem()
        ];
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
     * Handle window hide event
     * @method onWindowHide
     */
    onWindowHide() {
        try {
            // Update tray icon state
            const trayService = require('../../services/tray.service');
            const windowName = this.getWindowName(this.profile);
            trayService.updateTrayIcon(windowName, false);

            // Log window state
            log.info(`[${this.getName()}] Window hidden`);
        } catch (error) {
            log.error(`[${this.getName()}] Error handling window hide:`, error);
        }
    }

    /**
     * Handle window show event
     * @method onWindowShow
     */
    onWindowShow() {
        try {
            // Update tray icon state
            const trayService = require('../../services/tray.service');
            const windowName = this.getWindowName(this.profile);
            trayService.updateTrayIcon(windowName, true);

            // Clear notifications when window is shown
            if (this.hasNotification) {
                this.hasNotification = false;
                trayService.stopNotification(this.window);
            }

            // Log window state
            log.info(`[${this.getName()}] Window shown`);
        } catch (error) {
            log.error(`[${this.getName()}] Error handling window show:`, error);
        }
    }
}

module.exports = BaseProvider;
