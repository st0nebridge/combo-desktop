/**
 * @file System tray management service that handles creation, updates,
 * and notification states of tray icons for application providers.
 */

const { Tray, Menu } = require('electron');
const logger = require('./logging.service');

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
        if (!windowName) {
            logger.error('Window name is required for tray creation');
            return null;
        }

        // Cleanup existing tray if any
        await this.destroyTray(windowName);

        try {
            const trayIcon = provider.getTrayIcon();
            if (!trayIcon || !trayIcon.image) {
                throw new Error('Invalid tray icon returned from provider');
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
            this.notificationStates.set(windowName, false);

            logger.info(`Created tray icon for ${windowName}`);
            return tray;
        } catch (error) {
            logger.error(`Error creating tray for ${windowName}:`, error);
            return null;
        }
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
        const trayInfo = this.trays.get(windowName);
        if (!trayInfo) {
            logger.warn(`No tray found for window: ${windowName}`);
            return;
        }

        try {
            const { tray, provider } = trayInfo;
            
            // Get correct icon based on state
            const hasNotification = this.notificationStates.get(windowName) || false;
            const trayIcon = provider.getTrayIcon(hasNotification, !isVisible);
            
            if (trayIcon && trayIcon.image) {
                logger.info('Updating tray icon from provider');
                tray.setImage(trayIcon.image);
            }

            // Update tooltip to show window state
            const profile = windowName.split(':')[1] || 'default';
            const state = isVisible ? 'Running' : 'Minimized to tray';
            tray.setToolTip(`${provider.getName()} (${profile}) - ${state}`);

            // Update context menu
            this.updateContextMenu(tray, provider);
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
     * Destroy tray icon for a window
     * @method destroyTray
     * @param {string} windowName - Name of window with tray
     * @returns {Promise<void>}
     */
    async destroyTray(windowName) {
        const trayInfo = this.trays.get(windowName);
        if (trayInfo) {
            try {
                const { tray } = trayInfo;
                
                // Clear notification state
                this.clearNotificationTimer(windowName);
                this.notificationStates.delete(windowName);

                // Remove all listeners and destroy
                tray.removeAllListeners();
                tray.destroy();

                // Remove from maps
                this.trays.delete(windowName);

                logger.info(`Destroyed tray icon for ${windowName}`);
            } catch (error) {
                logger.error(`Error destroying tray for ${windowName}:`, error);
            }
        }
    }

    /**
     * Clean up all tray icons and timers
     * @method cleanup
     */
    cleanup() {
        // Clear all notification timers and destroy trays
        for (const [windowName] of this.trays) {
            this.destroyTray(windowName);
        }
        this.trays.clear();
        this.notificationStates.clear();
        this.notificationTimers.clear();
    }
}

// Export a singleton instance
module.exports = new TrayService();
