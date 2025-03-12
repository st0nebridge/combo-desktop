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
     * @returns {Electron.Tray|null} Created tray instance or null if creation fails
     * @throws {Error} If provider returns invalid tray icon
     */
    createTray(provider, windowName) {
        if (!windowName) {
            logger.error('Window name is required for tray creation');
            return null;
        }

        if (this.trays.has(windowName)) {
            logger.warn(`Tray already exists for window: ${windowName}`);
            return this.trays.get(windowName).tray;
        }

        try {
            const trayIcon = provider.getTrayIcon();
            if (!trayIcon || !trayIcon.image) {
                throw new Error('Invalid tray icon returned from provider');
            }

            const tray = new Tray(trayIcon.image);
            tray.setToolTip(`${provider.getName()} - ${windowName.split(':')[1]}`);

            // Set up context menu
            this.updateContextMenu(tray, provider);

            // Set up click handlers
            tray.on('click', () => {
                provider.handleTrayClick();
            });

            tray.on('double-click', () => {
                provider.handleTrayDoubleClick();
            });

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
                        tray.setImage(trayIcon.image);
                    }
                }, interval);
                this.notificationTimers.set(windowName, timer);
            } else {
                // Reset to normal icon
                const trayIcon = provider.getTrayIcon(false);
                if (trayIcon && trayIcon.image) {
                    tray.setImage(trayIcon.image);
                }
            }

            this.notificationStates.set(windowName, hasNotification);
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
     * Destroy tray icon for a window
     * @method destroyTray
     * @param {string} windowName - Name of window
     * @throws {Error} If tray destruction fails
     */
    destroyTray(windowName) {
        const trayInfo = this.trays.get(windowName);
        if (!trayInfo) {
            return;
        }

        try {
            const { tray } = trayInfo;
            this.clearNotificationTimer(windowName);
            tray.destroy();
            this.trays.delete(windowName);
            this.notificationStates.delete(windowName);
        } catch (error) {
            logger.error(`Error destroying tray for ${windowName}:`, error);
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
