const log = require("electron-log");
const userAgentConfig = require('../config/user-agent.config');

class BaseProvider {
    constructor(window) {
        if (this.constructor === BaseProvider) {
            throw new Error('BaseProvider is abstract and cannot be instantiated directly');
        }
        this.window = window;
        this.hasNotification = false;
        this._webPreferences = {};
    }

    // Initialize the window with provider-specific configuration
    async initializeWindow(profile) {
        if (!this.window || !this.window.webContents) {
            throw new Error('Window not properly initialized');
        }

        try {
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

    // Provider-specific initialization logic
    async initializeProvider(profile) {
        throw new Error('initializeProvider() must be implemented by child class');
    }

    // Return the URL that this provider should load
    getUrl() {
        throw new Error('getUrl() must be implemented by child class');
    }

    // Return the name of this provider
    getName() {
        throw new Error('getName() must be implemented by child class');
    }

    // Return the command line argument that activates this provider
    getCommandArg() {
        throw new Error('getCommandArg() must be implemented by child class');
    }

    // Return the path to the provider's icon
    getIconPath() {
        throw new Error('getIconPath() must be implemented by child class');
    }

    // Default notification blink interval in milliseconds
    getNotificationInterval() {
        return 3000; // 3 seconds
    }

    // Get the base icon path for this provider
    getBaseIconPath() {
        throw new Error('getBaseIconPath() must be implemented by child class');
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
            this.window.webContents.send('notification-state-changed', true);
        }
    }

    // Stop notification blinking
    stopNotification() {
        if (this.hasNotification) {
            this.hasNotification = false;
            this.window.webContents.send('notification-state-changed', false);
        }
    }

    // Optional: Custom JS injection
    injectCustomJS() {
        // Default implementation does nothing
    }

    // Get web preferences for the provider
    getWebPreferences() {
        return this._webPreferences;
    }

    // Set web preferences for the provider
    setWebPreferences(preferences) {
        if (preferences.partition) {
            console.warn('Partition property in web preferences will be ignored. Use profiles instead.');
            delete preferences.partition;
        }
        this._webPreferences = preferences;
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
        const providerSession = session.fromPartition(partition);
        const userAgent = this.getUserAgent();
        const clientHints = this.getClientHints();

        log.info(`[${this.getName()}] Configuring session (partition: ${partition})`);
        log.info(`[${this.getName()}] Using user agent:`, userAgent);
        log.info(`[${this.getName()}] Using client hints:`, JSON.stringify(clientHints));

        providerSession.webRequest.onBeforeSendHeaders((details, callback) => {
            const headers = details.requestHeaders;
            headers['User-Agent'] = userAgent;
            Object.entries(clientHints).forEach(([key, value]) => {
                headers[key] = value;
            });
            callback({ requestHeaders: headers });
        });
    }

    getStoragesNames() {
        return ['cookies', 'localstorage', 'sessionstorage', 'websql', 'indexdb'];
    }

    clearSessionData() {
        if (this.window && this.window.webContents) {
            this.window.webContents.session.clearStorageData({
                storages: this.getStoragesNames()
            }, () => {
                log.info('Session data cleared');
            });
        } else {
            console.error('Window or webContents not available');
        }
    }
}

module.exports = BaseProvider;
