const path = require('path');
const { nativeTheme } = require('electron');
const { getIconPath, getAppIconPath } = require('../utils/icons');

class BaseProvider {
    constructor(window) {
        if (this.constructor === BaseProvider) {
            throw new Error('BaseProvider is abstract and cannot be instantiated directly');
        }
        this.window = window;
        this.notificationInterval = null;
        this.hasNotification = false;
    }

    // Abstract methods that must be implemented by child classes
    initialize() {
        throw new Error('initialize() must be implemented by child class');
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

    /**
     * Get the app icon path for this provider
     * @returns {string} Path to the app icon
     */
    getAppIconPath() {
        return getAppIconPath(this.getName().toLowerCase());
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
}

module.exports = BaseProvider;
