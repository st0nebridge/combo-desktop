/**
 * @file System tray management service that handles creation, updates,
 * and notification states of tray icons for application providers.
 */

const { Tray, Menu } = require('electron');
const logger = require('./logging.service');

// Import error recovery utilities
const { 
    ErrorCategory, 
    RecoverableError, 
    createError, 
    safeExecute, 
    logDiagnostics 
} = require('../utils/error-recovery');
const { createTransaction, withTransaction } = require('../utils/transaction');

/**
 * Service for managing system tray icons.
 * Handles tray lifecycle, notifications, and menu management:
 * - Tray creation and cleanup
 * - Notification state and blinking
 * - Context menu updates
 * - Click event handling
 * @class TrayService
 */
class TrayService {
    /**
     * Creates a new TrayService instance
     * @constructor
     */
    constructor() {
        /** @property {Map<string, Object>} trays - Map of window names to tray info objects */
        this.trays = new Map(); // Map<windowName, { tray: Tray, provider: BaseProvider }>
        
        /** @property {Map<string, boolean>} notificationStates - Map of window names to notification states */
        this.notificationStates = new Map(); // Map<windowName, boolean>
        
        /** @property {Map<string, NodeJS.Timer>} notificationTimers - Map of window names to notification timers */
        this.notificationTimers = new Map(); // Map<windowName, Timer>

        /** @property {boolean} initialized - Whether the service has been initialized */
        this.initialized = false;
    }

    /**
     * Initialize the tray service
     * @method init
     * @returns {Promise<void>}
     */
    async init() {
        if (this.initialized) {
            logger.debug('Tray service already initialized');
            return;
        }

        const transaction = createTransaction('tray-service-init');
        
        try {
            await withTransaction(transaction, async () => {
                await safeExecute(async () => {
                    logger.info('Initializing tray service');
                    // Clear any existing trays
                    await this.cleanup();
                    this.initialized = true;
                    logger.info('Tray service initialized');
                }, {
                    errorMessage: 'Error initializing tray service',
                    category: ErrorCategory.INSTANCE_ERROR,
                    context: { serviceType: 'tray' }
                });
            });
        } catch (error) {
            logDiagnostics('tray-service-init-failed', { error });
            throw error;
        }
    }

    /**
     * Create a new tray icon for a provider
     * @method createTray
     * @param {BaseProvider} provider - Provider instance to create tray for
     * @param {string} windowName - Name of associated window (format: providerName:profile)
     * @returns {Promise<Electron.Tray|null>} Created tray instance or null if creation fails
     * @throws {Error} If provider returns invalid tray icon
     */
    async createTray(provider, windowName) {
        return await safeExecute(async () => {
            if (!windowName) {
                throw createError('Window name is required for tray creation', {
                    category: ErrorCategory.INSTANCE_ERROR,
                    context: { provider: provider?.getName?.() }
                });
            }

            // Cleanup existing tray if any - but don't await it
            this.destroyTray(windowName).catch(err => {
                logger.error(`Error destroying existing tray for ${windowName}:`, err);
            });

            const trayIcon = provider.getTrayIcon();
            if (!trayIcon || !trayIcon.image) {
                throw createError('Invalid tray icon returned from provider', {
                    category: ErrorCategory.INSTANCE_ERROR,
                    context: { provider: provider?.getName?.(), windowName }
                });
            }

            logger.info('Creating tray with icon from provider');
            const tray = new Tray(trayIcon.image);
            
            // Set initial tooltip
            const profile = windowName.split(':')[1] || 'default';
            tray.setToolTip(`${provider.getName()} (${profile}) - Starting...`);

            // Set up context menu
            const template = provider.getContextMenuOptions();
            const menu = Menu.buildFromTemplate(template);
            tray.setContextMenu(menu);

            // Set up click handlers
            tray.on('click', () => provider.handleTrayClick());
            tray.on('double-click', () => provider.handleTrayDoubleClick());

            // Store tray and provider reference
            this.trays.set(windowName, { tray, provider });
            
            // Initialize notification state
            this.notificationStates.set(windowName, false);

            logger.info(`Tray created successfully for ${windowName}`);
            return tray;
        }, {
            errorMessage: `Failed to create tray for ${windowName}`,
            category: ErrorCategory.INSTANCE_ERROR,
            context: { provider: provider?.getName?.(), windowName }
        });
    }

    /**
     * Update the context menu for a tray icon
     * @method updateContextMenu
     * @param {Electron.Tray} tray - Tray instance to update
     * @param {BaseProvider} provider - Provider instance to get menu from
     * @throws {Error} If menu creation fails
     */
    updateContextMenu(tray, provider) {
        try {
            const template = provider.getContextMenuOptions();
            const menu = Menu.buildFromTemplate(template);
            tray.setContextMenu(menu);
        } catch (error) {
            logger.error(`Error updating context menu:`, error);
        }
    }

    /**
     * Update tray icon state based on window visibility
     * @method updateTrayIcon
     * @param {string} windowName - Name of window with tray
     * @param {boolean} isVisible - Whether window is visible
     */
    updateTrayIcon(windowName, isVisible) {
        try {
            const trayInfo = this.trays.get(windowName);
            if (!trayInfo) {
                logger.debug(`No tray found for window: ${windowName}`);
                return;
            }

            logger.debug(`Window ${isVisible ? 'shown' : 'hidden'} for ${windowName}`);
            const { tray, provider } = trayInfo;
            
            // Update tray icon if it exists and is not destroyed
            if (tray && !tray.isDestroyed()) {
                // Update tooltip to show window state
                const profile = windowName.split(':')[1] || 'default';
                const state = isVisible ? 'Running' : 'Minimized to tray';
                tray.setToolTip(`${provider.getName()} (${profile}) - ${state}`);
            }
        } catch (error) {
            logger.error(`Error updating tray icon for ${windowName}:`, error);
        }
    }

    /**
     * Set notification state for a tray icon
     * @method setNotificationState
     * @param {string} windowName - Name of window with tray (format: providerName:profile)
     * @param {boolean} hasNotification - Whether notification is active
     * @throws {Error} If notification state update fails
     */
    setNotificationState(windowName, hasNotification) {
        const trayInfo = this.trays.get(windowName);
        if (!trayInfo) {
            logger.warn(`No tray found for window: ${windowName}`);
            return;
        }

        try {
            const { tray, provider } = trayInfo;
            const currentState = this.notificationStates.get(windowName);

            // Don't update if state hasn't changed
            if (currentState === hasNotification) {
                return;
            }

            // Clear existing notification timer if any
            this.clearNotificationTimer(windowName);

            if (hasNotification) {
                // Start notification blinking
                const interval = provider.getNotificationInterval();
                let blinkState = false;
                
                const timer = setInterval(() => {
                    blinkState = !blinkState;
                    const trayIcon = provider.getTrayIcon(blinkState);
                    if (trayIcon && trayIcon.image) {
                        logger.info('Blinking tray icon from provider');
                        tray.setImage(trayIcon.image);
                    }
                }, interval);
                
                this.notificationTimers.set(windowName, timer);
            } else {
                // Reset to normal icon
                const trayIcon = provider.getTrayIcon(false);
                if (trayIcon && trayIcon.image) {
                    logger.info('Resetting tray icon from provider');
                    tray.setImage(trayIcon.image);
                }
            }

            this.notificationStates.set(windowName, hasNotification);
            logger.info(`Updated notification state for ${windowName}: ${hasNotification}`);
        } catch (error) {
            logger.error(`Error updating notification state for ${windowName}:`, error);
        }
    }

    /**
     * Clear notification timer for a window
     * @method clearNotificationTimer
     * @param {string} windowName - Name of window
     */
    clearNotificationTimer(windowName) {
        const timer = this.notificationTimers.get(windowName);
        if (timer) {
            clearInterval(timer);
            this.notificationTimers.delete(windowName);
        }
    }

    /**
     * Start notification blinking for a window
     * @method startNotification
     * @param {Electron.BrowserWindow} window - Window to start notification for
     * @param {number} interval - Blink interval in milliseconds
     */
    startNotification(window, interval) {
        if (!window || !window.metadata || !window.metadata.provider) {
            logger.warn('Invalid window for notification');
            return;
        }

        const { provider } = window.metadata;
        const windowName = `${provider.getName()}:${provider.profile}`;
        this.setNotificationState(windowName, true);
    }

    /**
     * Stop notification blinking for a window
     * @method stopNotification
     * @param {Electron.BrowserWindow} window - Window to stop notification for
     */
    stopNotification(window) {
        if (!window || !window.metadata || !window.metadata.provider) {
            logger.warn('Invalid window for notification');
            return;
        }

        const { provider } = window.metadata;
        const windowName = `${provider.getName()}:${provider.profile}`;
        this.setNotificationState(windowName, false);
    }

    /**
     * Destroy a tray icon and clean up resources
     * @method destroyTray
     * @param {string} windowName - Name of window with tray
     * @returns {Promise<void>}
     */
    async destroyTray(windowName) {
        try {
            const trayInfo = this.trays.get(windowName);
            if (!trayInfo) {
                logger.debug(`No tray found for window: ${windowName}`);
                return;
            }

            const { tray } = trayInfo;
            if (tray && !tray.isDestroyed()) {
                logger.info(`Destroying tray for ${windowName}`);
                tray.destroy();
            }

            // Clear notification state and timer
            if (this.notificationTimers.has(windowName)) {
                clearInterval(this.notificationTimers.get(windowName));
                this.notificationTimers.delete(windowName);
            }
            this.notificationStates.delete(windowName);
            this.trays.delete(windowName);
        } catch (error) {
            logger.error(`Error destroying tray for ${windowName}:`, error);
            // Force cleanup on timeout
            this.notificationTimers.delete(windowName);
            this.notificationStates.delete(windowName);
            this.trays.delete(windowName);
        }
    }

    /**
     * Clean up all tray icons and resources
     * @method cleanup
     */
    async cleanup() {
        try {
            logger.info('Cleaning up tray service');
            
            // Create a copy of window names to avoid modification during iteration
            const windowNames = [...this.trays.keys()];
            
            // Clean up each tray
            for (const windowName of windowNames) {
                try {
                    const trayInfo = this.trays.get(windowName);
                    if (trayInfo) {
                        const { tray } = trayInfo;
                        if (tray && !tray.isDestroyed()) {
                            logger.info(`Destroying tray for ${windowName}`);
                            tray.destroy();
                        }
                    }
                } catch (error) {
                    logger.error(`Error destroying tray for ${windowName}:`, error);
                }
            }

            // Clear all maps
            this.trays.clear();
            this.notificationStates.clear();
            this.notificationTimers.clear();
            
            logger.info('Tray service cleanup complete');
        } catch (error) {
            logger.error('Error during tray cleanup:', error);
            // Force cleanup on error
            this.trays.clear();
            this.notificationStates.clear();
            this.notificationTimers.clear();
        }
    }
}

// Export a singleton instance
module.exports = new TrayService();
