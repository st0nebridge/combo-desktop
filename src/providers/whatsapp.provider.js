// WhatsApp provider functionality
const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const BaseProvider = require('./base.provider');

class WhatsAppProvider extends BaseProvider {
    constructor(window) {
        super(window);
        this.bypassScriptPath = path.join(__dirname, '..', 'injected', 'whatsapp-bypass.js');
    }

    getName() {
        return 'WhatsApp';
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
        
        // Set up event handlers before loading URL
        this.setupEventHandlers();
        
        // Load WhatsApp URL
        this.window.loadURL(this.getUrl());
    }
    
    setupEventHandlers() {
        // Wait for page to load before injecting scripts
        this.window.webContents.on('did-finish-load', () => {
            this.injectCustomJS();
        });
        
        // Monitor for notifications
        this.window.webContents.on('page-title-updated', (event, title) => {
            if (this.hasNotifications()) {
                this.startNotification();
            } else {
                this.stopNotification();
            }
        });
        
        // Add additional event listener for DOM content loaded
        this.window.webContents.on('dom-ready', () => {
            this.bypassCompatibilityCheck();
        });
        
        // Listen for navigation events to detect compatibility page
        this.window.webContents.on('did-navigate', (event, url) => {
            console.log('Navigated to:', url);
            // Short delay to ensure page is loaded
            setTimeout(() => this.bypassCompatibilityCheck(), 500);
        });
        
        // Listen for any redirects
        this.window.webContents.on('did-redirect-navigation', (event, url) => {
            console.log('Redirected to:', url);
            // Short delay to ensure page is loaded
            setTimeout(() => this.bypassCompatibilityCheck(), 500);
        });
        
        // Listen for console messages from the page
        this.window.webContents.on('console-message', (event, level, message) => {
            if (message.includes('Chrome') || message.includes('browser') || message.includes('compatibility')) {
                console.log('Console message related to browser compatibility:', message);
                this.bypassCompatibilityCheck();
            }
        });
    }

    injectCustomJS() {
        this.window.webContents.executeJavaScript(`
            // Clear service worker registrations to avoid caching issues
            window.navigator.serviceWorker.getRegistrations().then(registrations => {
                for (let registration of registrations) {
                    registration.unregister();
                }
            });

            // Function to handle browser compatibility check
            const handleBrowserCheck = () => {
                // Check for various browser compatibility messages
                const titleEl = document.querySelector('.window-title');
                const compatMsgEl = document.querySelector('h1, .landing-title');
                const browserWarning = document.querySelector('.browser-version-warning');
                
                // If we find any compatibility warning elements
                if ((titleEl && (titleEl.innerHTML.includes('Chrome') || titleEl.innerHTML.includes('browser'))) || 
                    (compatMsgEl && compatMsgEl.textContent.includes('Google Chrome')) ||
                    browserWarning) {
                    console.log('Detected browser compatibility warning, reloading...');
                    // Force reload the page to apply our user agent
                    setTimeout(() => window.location.reload(), 1000);
                    return true;
                }
                return false;
            };

            // Run check immediately
            if (!handleBrowserCheck()) {
                // Set up an observer to watch for compatibility messages that might appear later
                const observer = new MutationObserver((mutations) => {
                    if (handleBrowserCheck()) {
                        observer.disconnect();
                    }
                });
                
                // Start observing the document body for changes
                observer.observe(document.body || document.documentElement, {
                    childList: true,
                    subtree: true
                });
            }
        `);
    }

    bypassCompatibilityCheck() {
        // Execute script to bypass the compatibility check
        const script = fs.readFileSync(this.bypassScriptPath, 'utf8');
        this.window.webContents.executeJavaScript(script);
    }

    // Check if the window title indicates notifications
    hasNotifications() {
        const title = this.window.getTitle();
        return title.includes('(') && title.includes(')');
    }
}

module.exports = WhatsAppProvider;
