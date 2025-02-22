const { app, BrowserWindow, dialog, session } = require('electron');
const electronLocalshortcut = require('electron-localshortcut');
const log = require('electron-log');
const Store = require('electron-store');

// Import provider registry
const providerRegistry = require('./providers/provider.registry');

// Configure logging
log.initialize({ preload: true });

// Initialize store
const store = new Store();

// Log available providers
const availableProviders = providerRegistry.getAvailableProviders();
log.info('Available providers:', availableProviders);

class AppManager {
    constructor() {
        this.window = null;
        this.provider = null;
    }

    validateProvider() {
        const args = process.argv.slice(1);
        // Check if any provider argument is present
        const hasProvider = availableProviders.some(provider => 
            args.includes(provider.commandArg)
        );

        if (!hasProvider) {
            const providerList = availableProviders
                .map(p => `${p.commandArg} (${p.name})`)
                .join('\n');

            const message = `No provider specified. Please use one of the following command arguments:\n\n${providerList}`;
            
            dialog.showErrorBox('Provider Required', message);
            log.error(message);
            app.exit(1);
        }
    }

    async createWindow() {
        try {
            this.validateProvider();

            // Set modern Chrome user agent
            const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
            
            // Update the user agent for all sessions
            session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
                details.requestHeaders['User-Agent'] = userAgent;
                callback({ requestHeaders: details.requestHeaders });
            });

            this.window = new BrowserWindow({
                width: 1000,
                height: 800,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    webSecurity: true,
                }
            });

            log.info('Browser window created.');

            // Create and initialize the provider using the registry
            this.provider = providerRegistry.createProvider(this.window, process.argv.slice(1));
            
            log.info(`Initializing ${this.provider.getName()} provider...`);
            this.provider.initialize();

            // Load the appropriate URL
            const serviceUrl = this.provider instanceof require('./providers/facebook.provider') ? 'https://www.messenger.com/login' : 'https://web.whatsapp.com/';
            this.window.loadURL(serviceUrl);

            // Set up window event handlers
            this.window.on('closed', () => {
                this.window = null;
            });

            this.setupWindowEvents();
            this.setupShortcuts();
        } catch (error) {
            dialog.showErrorBox('Error', error.message);
            log.error(error.message);
            app.exit(1);
        }
    }

    setupWindowEvents() {
        this.window.on('close', (event) => {
            if (!app.isQuiting) {
                event.preventDefault();
                this.window.hide();
            }
        });
    }

    setupShortcuts() {
        electronLocalshortcut.register(this.window, 'Esc', () => {
            this.window.hide();
        });
    }
}

// Initialize app
app.on('ready', () => {
    log.info('Application starting...');
    const appManager = new AppManager();
    appManager.createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (appManager.window === null) {
        appManager.createWindow();
    }
});
