// Facebook provider functionality
const { BrowserWindow } = require('electron');
const path = require('path');
const BaseProvider = require('./base.provider');

class FacebookProvider extends BaseProvider {
    getName() {
        return 'Facebook Messenger';
    }

    getCommandArg() {
        return '--facebook';
    }

    getBaseIconPath() {
        return path.join(__dirname, '..', '..', 'assets', 'icons', 'facebook');
    }

    // Optional: Override default notification interval
    getNotificationInterval() {
        return 3000; // 3 seconds, using default
    }

    getUrl() {
        return 'https://www.messenger.com/login';
    }

    initialize() {
        console.log('Initializing Facebook Provider...');
        this.window.loadURL(this.getUrl());
        
        // Monitor for notifications
        this.window.webContents.on('page-title-updated', (event, title) => {
            if (title.match(/\([0-9]+\)/)) {
                this.startNotification();
            } else {
                this.stopNotification();
            }
        });
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
