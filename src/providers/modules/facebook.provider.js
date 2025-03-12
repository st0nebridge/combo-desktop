/**
 * @module FacebookProvider
 * @description Facebook Messenger integration provider for the application.
 * Handles browser compatibility, notification monitoring, and custom JavaScript injection
 * for seamless Facebook Messenger functionality.
 */

const log = require('electron-log');
const BaseProvider = require('../abstract/base.provider');

/**
 * Facebook Messenger integration provider implementation.
 * Extends BaseProvider to provide Facebook-specific functionality:
 * - Browser compatibility handling
 * - Service worker management
 * - Notification monitoring
 * - Title-based notification detection
 * @class FacebookProvider
 * @extends {BaseProvider}
 */
class FacebookProvider extends BaseProvider {
    /**
     * Get provider display name
     * @method getName
     * @override
     * @returns {string} Provider name 'Facebook'
     */
    getName() {
        return 'Facebook';
    }

    /**
     * Get command line argument
     * @method getCommandArg
     * @override
     * @returns {string} Command argument '--facebook'
     */
    getCommandArg() {
        return '--facebook';
    }

    /**
     * Get base icon path
     * @method getBaseIconPath
     * @override
     * @returns {string} Icon path 'facebook'
     */
    getBaseIconPath() {
        return 'facebook';
    }

    /**
     * Get notification check interval
     * @method getNotificationInterval
     * @override
     * @returns {number} Interval of 3000ms (3 seconds)
     */
    getNotificationInterval() {
        return 3000; // 3 seconds, using default
    }

    /**
     * Get provider URL
     * @method getUrl
     * @override
     * @returns {string} Facebook Messenger login URL
     */
    getUrl() {
        return 'https://www.messenger.com/login';
    }

    /**
     * Set up Facebook-specific event handlers for notifications
     * @method setupEventHandlers
     * @override
     * @throws {Error} If window or webContents is not available
     */
    setupEventHandlers() {
        if (!this.window || !this.window.webContents) {
            log.error('Window or webContents not available for setting up event handlers');
            return;
        }
        
        // Monitor for notifications
        this.window.webContents.on('page-title-updated', (event, title) => {
            if (this.hasNotifications()) {
                this.startNotification();
            } else {
                this.stopNotification();
            }
        });
    }

    /**
     * Check if there are unread notifications by parsing window title
     * @method hasNotifications
     * @override
     * @returns {boolean} True if notifications are present
     */
    hasNotifications() {
        const title = this.window.getTitle();
        return title.includes('(') && title.includes(')');
    }

    /**
     * Inject Facebook-specific JavaScript for browser compatibility
     * and service worker management
     * @method injectCustomJS
     * @override
     */
    injectCustomJS() {
        // Add any Facebook Messenger specific JS injection here
        this.window.webContents.executeJavaScript(`
            // Clear service worker registrations to avoid caching issues
            window.navigator.serviceWorker.getRegistrations().then(registrations => {
                console.log('[Facebook Provider] Unregistering service workers:', registrations.length);
                for (let registration of registrations) {
                    registration.unregister();
                }
            });
        `);
    }
}

module.exports = FacebookProvider;
