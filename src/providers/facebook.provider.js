// Facebook provider functionality
const BaseProvider = require('./base.provider');

class FacebookProvider extends BaseProvider {
    getName() {
        return 'Facebook Messenger';
    }

    getCommandArg() {
        return '--facebook';
    }

    getUrl() {
        return 'https://www.messenger.com/login';
    }

    initialize() {
        console.log('Initializing Facebook Messenger Provider...');
        this.window.loadURL(this.getUrl());
        this.injectCustomJS();
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
