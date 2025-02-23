// WhatsApp provider functionality
const { BrowserWindow } = require('electron');
const path = require('path');
const BaseProvider = require('./base.provider');

class WhatsAppProvider extends BaseProvider {
    constructor(window) {
        super(window);
        this.name = 'whatsapp';
    }

    getName() {
        return 'whatsapp';
    }

    getCommandArg() {
        return '--whatsapp';
    }

    getBaseIconPath() {
        return 'whatsapp';
    }

    // Optional: Override default notification interval
    getNotificationInterval() {
        return 3000; // 3 seconds, using default
    }

    getUrl() {
        return 'https://web.whatsapp.com/';
    }

    initialize() {
        console.log('Initializing WhatsApp Provider...');
        this.window.loadURL(this.getUrl());
        this.injectCustomJS();
        
        // Monitor for notifications
        this.window.webContents.on('page-title-updated', (event, title) => {
            if (this.hasNotifications()) {
                this.startNotification();
            } else {
                this.stopNotification();
            }
        });
    }

    injectCustomJS() {
        this.window.webContents.executeJavaScript(`
            window.navigator.serviceWorker.getRegistrations().then(registrations => {
                for (let registration of registrations) {
                    registration.unregister();
                }
            });
            const titleEl = document.querySelector('.window-title');
            if (titleEl && titleEl.innerHTML.includes('Google Chrome 36+')) {
                window.location.reload();
            }
        `);
    }

    // Check if the window title indicates notifications
    hasNotifications() {
        const title = this.window.getTitle();
        return title.includes('(') && title.includes(')');
    }
}

module.exports = WhatsAppProvider;
