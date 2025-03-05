// Facebook provider functionality
const BaseProvider = require('./base.provider');

class FacebookProvider extends BaseProvider {
    constructor(window) {
        super(window);
    }

    getName() {
        return 'Facebook';
    }

    getCommandArg() {
        return '--facebook';
    }

    getBaseIconPath() {
        return 'facebook';
    }

    // Optional: Override default notification interval
    getNotificationInterval() {
        return 3000; // 3 seconds, using default
    }

    getUrl() {
        return 'https://www.messenger.com/login';
    }

    async initializeProvider(profile) {
        console.log(`Initializing Facebook Provider for profile: ${profile}...`);
        this.window.loadURL(this.getUrl());
        
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
            // Disable service worker registrations
            window.navigator.serviceWorker.getRegistrations().then(registrations => {
                for (let registration of registrations) {
                    registration.unregister();
                }
            });
        `);
    }
}

module.exports = FacebookProvider;
