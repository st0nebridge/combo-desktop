const { BrowserWindow } = require('electron');
const log = require('electron-log');
const path = require('path');

class WindowService {
    constructor() {
        this.windows = new Map(); // Map<windowName, BrowserWindow>
    }

    createWindow(config, windowName, metadata = {}) {
        try {
            if (!windowName) {
                throw new Error('Window name is required');
            }

            // Check if window already exists
            if (this.windows.has(windowName)) {
                log.info(`Window ${windowName} already exists, focusing...`);
                const existingWindow = this.windows.get(windowName);
                if (!existingWindow.isDestroyed()) {
                    existingWindow.focus();
                    return existingWindow;
                }
                // Window was destroyed, remove it from our map
                this.windows.delete(windowName);
            }

            // Create window with provided config
            const window = new BrowserWindow({
                ...config,
                show: false // Don't show until ready-to-show
            });

            // Store window reference
            this.windows.set(windowName, window);

            // Store metadata
            window.metadata = metadata;

            // Setup window events
            this.setupWindowEvents(window, windowName);

            return window;
        } catch (error) {
            log.error(`Error creating window ${windowName}:`, error);
            return null;
        }
    }

    setupWindowEvents(window, windowName) {
        if (!window || !windowName) {
            return;
        }

        // Show window when ready
        window.once('ready-to-show', () => {
            if (!window.isDestroyed()) {
                window.show();
            }
        });

        // Handle window close
        window.on('closed', async () => {
            try {
                // Cleanup session if provider exists
                if (window.metadata && window.metadata.provider) {
                    const { provider, profile } = window.metadata;
                    const instanceManager = require('./instance.manager');
                    await instanceManager.unregisterSession(provider, profile);
                }

                // Remove from our map
                this.windows.delete(windowName);
            } catch (error) {
                log.error(`Error cleaning up window ${windowName}:`, error);
            }
        });
    }

    getWindow(windowName) {
        return this.windows.get(windowName);
    }

    getAllWindows() {
        return Array.from(this.windows.values());
    }

    closeAllWindows() {
        this.windows.forEach((window, windowName) => {
            try {
                if (!window.isDestroyed()) {
                    window.close();
                }
            } catch (error) {
                log.error(`Error closing window ${windowName}:`, error);
            }
        });
    }
}

module.exports = new WindowService();
