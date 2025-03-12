/**
 * @module WhatsAppProvider
 * @description WhatsApp web integration provider for the application.
 * Handles browser compatibility, notification monitoring, and custom JavaScript injection
 * for seamless WhatsApp Web functionality.
 */

const log = require('electron-log');
const BaseProvider = require('../abstract/base.provider');
const userAgentConfig = require('../../config/user-agent.config');

/**
 * WhatsApp web integration provider implementation.
 * Extends BaseProvider to provide WhatsApp-specific functionality:
 * - Browser compatibility handling
 * - Service worker management
 * - Notification monitoring
 * - External URL handling
 * @class WhatsAppProvider
 * @extends {BaseProvider}
 */
class WhatsAppProvider extends BaseProvider {
    /**
     * Creates a new WhatsAppProvider instance
     * @constructor
     */
    constructor() {
        super();
        
        /** @property {boolean} initialized - Whether provider has been initialized */
        this.initialized = false;
    }

    /**
     * Initialize the provider with WhatsApp-specific configuration
     * @method initialize
     * @throws {Error} If no user agent is configured for WhatsApp
     */
    initialize() {
        if (this.initialized) {
            return;
        }

        try {
            // Ensure we have the correct user agent
            const userAgent = userAgentConfig.getProviderUserAgent('whatsapp');
            if (!userAgent) {
                throw new Error('No user agent configured for WhatsApp');
            }

            this.userAgent = userAgent;
            this.initialized = true;
            log.info('WhatsApp provider initialized');
        } catch (error) {
            log.error('Error initializing WhatsApp provider:', error);
            throw error;
        }
    }

    /**
     * Get provider name
     * @method getName
     * @override
     * @returns {string} Provider name 'WhatsApp'
     */
    getName() {
        return 'WhatsApp';
    }

    /**
     * Get command line argument
     * @method getCommandArg
     * @override
     * @returns {string} Command argument '--whatsapp'
     */
    getCommandArg() {
        return '--whatsapp';
    }

    /**
     * Get base icon path
     * @method getBaseIconPath
     * @override
     * @returns {string} Icon path 'whatsapp'
     */
    getBaseIconPath() {
        return 'whatsapp';
    }

    /**
     * Get notification check interval
     * @method getNotificationInterval
     * @override
     * @returns {number} Interval of 3000ms (3 seconds)
     */
    getNotificationInterval() {
        return 3000; // 3 seconds
    }

    /**
     * Get provider URL
     * @method getUrl
     * @override
     * @returns {string} WhatsApp Web URL
     */
    getUrl() {
        return 'https://web.whatsapp.com/';
    }

    /**
     * Set up WhatsApp-specific event handlers for notifications and external URLs
     * @method setupEventHandlers
     * @override
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

        // Handle new windows (open in default browser)
        this.window.webContents.setWindowOpenHandler(({ url }) => {
            if (url && url.startsWith('https://')) {
                require('electron').shell.openExternal(url)
                    .catch(err => log.error('Error opening external URL:', err));
            }
            return { action: 'deny' };
        });
    }

    /**
     * Inject WhatsApp-specific JavaScript for browser compatibility and service worker management
     * @method injectCustomJS
     * @override
     */
    injectCustomJS() {
        if (!this.window || !this.window.webContents) {
            log.error('Window or webContents not available for custom JS injection');
            return;
        }

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

    /**
     * Check if the window title indicates notifications
     * @returns {boolean} True if notifications present
     */
    hasNotifications() {
        if (!this.window) {
            return false;
        }
        const title = this.window.getTitle();
        return title.includes('(') && title.includes(')');
    }
}

// Export the class instead of an instance
module.exports = WhatsAppProvider;
