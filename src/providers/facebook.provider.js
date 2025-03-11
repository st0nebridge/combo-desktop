// Facebook provider functionality
const log = require('electron-log');
const BaseProvider = require('./base.provider');

/**
 * Facebook provider
 */
class FacebookProvider extends BaseProvider {
    getName() {
        return 'Facebook';
    }

    getCommandArg() {
        return '--facebook';
    }

    getBaseIconPath() {
        return 'facebook';
    }

    getNotificationInterval() {
        return 3000; // 3 seconds, using default
    }

    getUrl() {
        return 'https://www.messenger.com/login';
    }

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

    hasNotifications() {
        const title = this.window.getTitle();
        return title.includes('(') && title.includes(')');
    }

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
