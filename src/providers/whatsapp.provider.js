// WhatsApp provider functionality
const { BrowserWindow } = require('electron');
const BaseProvider = require('./base.provider');

class WhatsAppProvider extends BaseProvider {
    constructor(window) {
        super(window);
    }

    getName() {
        return 'WhatsApp';
    }

    getCommandArg() {
        return '--whatsapp';
    }

    getUrl() {
        return 'https://web.whatsapp.com/';
    }

    initialize() {
        console.log('Initializing WhatsApp Provider...');
        this.window.loadURL(this.getUrl());
        this.injectCustomJS();
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
}

module.exports = WhatsAppProvider;
