const path = require('path');
const { nativeTheme } = require('electron');

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

    // Get the tray icon path, considering system theme
    getTrayIconPath(notification = false) {
        const iconName = notification ? 'white_notif.ico' : 'white.ico';
        const iconPath = path.join(this.getBaseIconPath(), iconName);
        
        // If system is in light mode, we'll need to invert the icon
        // This will be handled by the main process
        return {
            path: iconPath,
            invertForLight: true
        };
    }

    // Get the main application icon path
    getAppIconPath() {
        return path.join(this.getBaseIconPath(), 'icon.ico');
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
