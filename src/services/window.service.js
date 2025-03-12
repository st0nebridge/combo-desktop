const { BrowserWindow, app } = require('electron');
const log = require('electron-log');

class WindowService {
    constructor() {
        this.windows = new Map(); // Map<windowName, BrowserWindow>
        this.isQuitting = false;
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

        // Handle window close attempt
        window.on('close', async (event) => {
            try {
                // Only prevent close if window should be hidden instead
                const shouldPreventClose = !window.forceClose && !this.isQuitting;
                if (shouldPreventClose) {
                    event.preventDefault();
                    window.hide();
                    return;
                }

                // Cleanup session if provider exists
                if (window.metadata && window.metadata.provider) {
                    const { provider, profile } = window.metadata;
                    const instanceManager = require('./instance.manager');
                    await instanceManager.unregisterSession(provider, profile);
                }

                // Remove from our map
                this.windows.delete(windowName);

                // Check if this was the last window
                if (this.windows.size === 0) {
                    // Set quitting flag to prevent windows from being hidden
                    this.isQuitting = true;
                    app.quit();
                }
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

    // Helper to get window and name from input
    resolveWindow(windowOrName) {
        if (!windowOrName) {
            return { window: null, windowName: null };
        }

        if (windowOrName instanceof BrowserWindow) {
            for (const [name, win] of this.windows.entries()) {
                if (win === windowOrName) {
                    return { window: win, windowName: name };
                }
            }
            return { window: windowOrName, windowName: null };
        }

        const window = this.windows.get(windowOrName);
        return { window, windowName: windowOrName };
    }

    showWindow(windowOrName) {
        try {
            const { window } = this.resolveWindow(windowOrName);
            if (window && !window.isDestroyed()) {
                window.show();
                window.focus();
            }
        } catch (error) {
            log.error('Error showing window:', error);
        }
    }

    hideWindow(windowOrName) {
        try {
            const { window } = this.resolveWindow(windowOrName);
            if (window && !window.isDestroyed()) {
                window.hide();
            }
        } catch (error) {
            log.error('Error hiding window:', error);
        }
    }

    toggleWindow(windowOrName) {
        try {
            const { window } = this.resolveWindow(windowOrName);
            if (window && !window.isDestroyed()) {
                if (window.isVisible()) {
                    window.hide();
                } else {
                    window.show();
                    window.focus();
                }
            }
        } catch (error) {
            log.error('Error toggling window:', error);
        }
    }

    closeWindow(windowOrName, force = false) {
        try {
            const { window } = this.resolveWindow(windowOrName);
            if (window && !window.isDestroyed()) {
                if (force) {
                    this.isQuitting = true;
                }
                window.forceClose = force;
                window.close();
            }
        } catch (error) {
            log.error('Error closing window:', error);
        }
    }

    closeAllWindows(force = false) {
        if (force) {
            this.isQuitting = true;
        }
        this.windows.forEach((window) => {
            try {
                if (!window.isDestroyed()) {
                    window.forceClose = force;
                    window.close();
                }
            } catch (error) {
                log.error('Error closing window:', error);
            }
        });
    }

    async cleanup() {
        // Set quitting flag to prevent window hide
        this.isQuitting = true;
        
        // Cleanup all windows
        for (const [windowName, window] of this.windows.entries()) {
            try {
                if (!window.isDestroyed()) {
                    window.forceClose = true;
                    window.close();
                }
            } catch (error) {
                log.error(`Error destroying window ${windowName}:`, error);
            }
        }
        this.windows.clear();
    }
}

module.exports = new WindowService();
