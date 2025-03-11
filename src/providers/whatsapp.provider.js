// WhatsApp provider functionality
const log = require('electron-log');
const BaseProvider = require('./base.provider');

/**
 * WhatsApp provider
 */
class WhatsAppProvider extends BaseProvider {
    getName() {
        return 'WhatsApp';
    }

    getCommandArg() {
        return '--whatsapp';
    }

    getBaseIconPath() {
        return 'whatsapp';
    }

    getNotificationInterval() {
        return 3000; // 3 seconds, using default
    }

    getUrl() {
        return 'https://web.whatsapp.com/';
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

    injectCustomJS() {
        log.info('Injecting custom JavaScript for WhatsApp compatibility');
        this.window.webContents.executeJavaScript(`
            // Clear service worker registrations to avoid caching issues
            window.navigator.serviceWorker.getRegistrations().then(registrations => {
                console.log('[WhatsApp Provider] Unregistering service workers:', registrations.length);
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
                
                console.log('[WhatsApp Provider] Checking for compatibility elements:');
                console.log('[WhatsApp Provider] - Title element:', titleEl ? titleEl.innerHTML : 'not found');
                console.log('[WhatsApp Provider] - Compatibility message:', compatMsgEl ? compatMsgEl.textContent : 'not found');
                console.log('[WhatsApp Provider] - Browser warning:', browserWarning ? 'found' : 'not found');
                
                // If we find any compatibility warning elements
                if ((titleEl && (titleEl.innerHTML.includes('Chrome') || titleEl.innerHTML.includes('browser'))) || 
                    (compatMsgEl && compatMsgEl.textContent.includes('Google Chrome')) ||
                    browserWarning) {
                    console.log('[WhatsApp Provider] Detected browser compatibility warning, reloading...');
                    // Force reload the page to apply our user agent
                    setTimeout(() => window.location.reload(), 1000);
                    return true;
                }
                return false;
            };

            // Run check immediately
            const initialCheckResult = handleBrowserCheck();
            console.log('[WhatsApp Provider] Initial compatibility check result:', initialCheckResult);
            
            if (!initialCheckResult) {
                // Set up an observer to watch for compatibility messages that might appear later
                console.log('[WhatsApp Provider] Setting up MutationObserver for compatibility detection');
                const observer = new MutationObserver((mutations) => {
                    if (handleBrowserCheck()) {
                        console.log('[WhatsApp Provider] MutationObserver detected compatibility issue, disconnecting');
                        observer.disconnect();
                    }
                });
                
                // Start observing the document body for changes
                observer.observe(document.body || document.documentElement, {
                    childList: true,
                    subtree: true
                });
                console.log('[WhatsApp Provider] MutationObserver started');
            }
        `).then(() => {
            log.info('Custom JavaScript injection completed');
        }).catch(err => {
            log.error('Error injecting custom JavaScript:', err);
        });
    }

    // Check if the window title indicates notifications
    hasNotifications() {
        const title = this.window.getTitle();
        return title.includes('(') && title.includes(')');
    }
}

module.exports = WhatsAppProvider;
