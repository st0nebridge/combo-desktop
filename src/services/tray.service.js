// Tray management logic
const { Tray, Menu } = require('electron');
const logger = require('./logging.service');

class TrayService {
    constructor() {
        this.trays = new Map(); // Map<windowName, { tray: Tray, provider: BaseProvider }>
        this.notificationStates = new Map(); // Map<windowName, boolean>
        this.notificationTimers = new Map(); // Map<windowName, Timer>
    }

    createTray(provider, windowName) {
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

            return tray;
        } catch (error) {
            logger.error(`Error creating tray for ${windowName}:`, error);
            return null;
        }
    }

    updateContextMenu(tray, provider) {
        try {
            const template = provider.getContextMenuOptions();
            const menu = Menu.buildFromTemplate(template);
            tray.setContextMenu(menu);
        } catch (error) {
            logger.error(`Error updating context menu:`, error);
        }
    }

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

    clearNotificationTimer(windowName) {
        const timer = this.notificationTimers.get(windowName);
        if (timer) {
            clearInterval(timer);
            this.notificationTimers.delete(windowName);
        }
    }

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

module.exports = new TrayService();
