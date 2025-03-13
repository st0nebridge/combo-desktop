/**
 * @module WhatsAppProvider
 * @description WhatsApp web integration provider for the application.
 * Handles browser compatibility, notification monitoring, and custom JavaScript injection
 * for seamless WhatsApp Web functionality.
 */

const BaseProvider = require('../abstract/base.provider');
const logger = require('../../services/logging.service');
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
     * @throws {Error} If BaseProvider is not properly extended
     */
    constructor() {
        super();
        
        /** @property {boolean} initialized - Whether provider has been initialized */
        this.initialized = false;
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
     * Get partition name for this provider
     * @method getPartitionName
     * @override
     * @returns {string} Partition name 'whatsapp'
     */
    getPartitionName() {
        return 'whatsapp';
    }

    /**
     * Get base icon path
     * @method getBaseIconPath
     * @override
     * @returns {string} Icon path
     */
    getBaseIconPath() {
        return super.getBaseIconPath();
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
     * Get window configuration for WhatsApp
     * @method getWindowConfig
     * @override
     * @returns {Object} Window configuration object
     */
    getWindowConfig() {
        return {
            width: 1200,
            height: 900,
            minWidth: 800,
            minHeight: 600,
            webPreferences: {
                ...this.getWebPreferences(),
                partition: this.getPartitionName()
            }
        };
    }

    /**
     * Get web preferences configuration for WhatsApp
     * @method getWebPreferences
     * @override
     * @returns {Object} Web preferences configuration
     */
    getWebPreferences() {
        return {
            ...super.getWebPreferences(),
            spellcheck: true,
            webgl: true,
            plugins: true
        };
    }

    /**
     * Set up WhatsApp-specific event handlers for notifications and external URLs
     * @method setupEventHandlers
     * @override
     * @throws {Error} If window or webContents are not available
     * @returns {void}
     */
    setupEventHandlers() {
        if (!this.window || !this.window.webContents) {
            const error = new Error('Window or webContents not available for setting up event handlers');
            logger.error(error.message);
            throw error;
        }
        
        // Monitor for notifications
        this.window.webContents.on('page-title-updated', (event, title) => {
            const windowName = this.getWindowName(this.profile || 'default');
            if (this.hasNotifications()) {
                const trayService = require('../../services/tray.service');
                trayService.setNotificationState(windowName, true);
            } else {
                const trayService = require('../../services/tray.service');
                trayService.setNotificationState(windowName, false);
            }
        });

        // Handle new windows (open in default browser)
        this.window.webContents.setWindowOpenHandler(({ url }) => {
            if (url && url.startsWith('https://')) {
                require('electron').shell.openExternal(url)
                    .catch(err => logger.error('Error opening external URL:', err));
            }
            return { action: 'deny' };
        });
    }

    /**
     * Check if window title indicates notifications
     * @method hasNotifications
     * @returns {boolean} True if window title indicates notifications
     */
    hasNotifications() {
        if (!this.window) {
            return false;
        }
        const title = this.window.getTitle();
        return title && title.includes('(');
    }

    /**
     * Start notification state
     * @method startNotification
     * @returns {void}
     */
    startNotification() {
        const windowName = this.getWindowName(this.profile || 'default');
        const trayService = require('../../services/tray.service');
        trayService.setNotificationState(windowName, true);
    }

    /**
     * Stop notification state
     * @method stopNotification
     * @returns {void}
     */
    stopNotification() {
        const windowName = this.getWindowName(this.profile || 'default');
        const trayService = require('../../services/tray.service');
        trayService.setNotificationState(windowName, false);
    }

    /**
     * Inject WhatsApp-specific JavaScript for browser compatibility and service worker management
     * @method injectCustomJS
     * @override
     * @throws {Error} If window or webContents are not available
     * @returns {void}
     */
    injectCustomJS() {
        if (!this.window || !this.window.webContents) {
            const error = new Error('Window or webContents not available for custom JS injection');
            logger.error(error.message);
            throw error;
        }

        logger.info('Injecting custom JavaScript for WhatsApp compatibility');
        
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

            // Run initial check and set up observer
            if (!handleBrowserCheck()) {
                // Set up observer to watch for compatibility messages
                const observer = new MutationObserver((mutations) => {
                    if (handleBrowserCheck()) {
                        observer.disconnect();
                    }
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            }
        `).catch(err => {
            logger.error('Error injecting custom JavaScript:', err);
        });
    }

    /**
     * Get context menu options for the tray icon
     * @method getContextMenuOptions
     * @override
     * @returns {Array<Object>} Menu template array
     */
    getContextMenuOptions() {
        const baseOptions = super.getContextMenuOptions();
        return [
            {
                label: 'Open WhatsApp',
                click: () => {
                    if (this.window) {
                        this.window.show();
                        this.window.focus();
                    }
                }
            },
            { type: 'separator' },
            ...baseOptions
        ];
    }
}

// Export the class instead of an instance
module.exports = WhatsAppProvider;
