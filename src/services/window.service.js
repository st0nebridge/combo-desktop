/**
 * @file Window management service that handles creation, lifecycle, and state
 * of all application windows. Provides centralized window control and event handling.
 */

const { BrowserWindow, app } = require('electron');
const log = require('electron-log');

/**
 * Service for managing application windows.
 * Handles window lifecycle, state management, and events:
 * - Window creation and configuration
 * - Window visibility and focus
 * - Window cleanup and session management
 * - Window event handling
 * @class WindowService
 */
class WindowService {
    /**
     * Creates a new WindowService instance
     * @constructor
     */
    constructor() {
        /** @property {Map<string, Electron.BrowserWindow>} windows - Map of window names to window instances */
        this.windows = new Map();
        
        /** @property {boolean} isQuitting - Whether the app is in the process of quitting */
        this.isQuitting = false;
    }

    /**
     * Create a new browser window with the specified configuration
     * @method createWindow
     * @param {Object} config - Window configuration options
     * @param {string} windowName - Unique identifier for the window
     * @param {Object} [metadata={}] - Additional metadata to attach to the window
     * @returns {Electron.BrowserWindow|null} Created window or null if creation fails
     * @throws {Error} If window name is not provided
     */
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
                    existingWindow.show();
                    existingWindow.focus();
                    return existingWindow;
                }
                // Window was destroyed, remove it from our map
                this.windows.delete(windowName);
            }

            // Enforce security settings
            const webPreferences = {
                ...config.webPreferences,
                contextIsolation: true,
                webSecurity: true,
                nodeIntegration: false,
                enableRemoteModule: false
            };

            // Create window with provided config and enforced security
            const window = new BrowserWindow({
                ...config,
                show: false, // Don't show until ready-to-show
                webPreferences
            });

            // Store window reference and metadata
            this.windows.set(windowName, window);
            window.metadata = metadata;

            // Setup window events
            this.setupWindowEvents(window, windowName);

            return window;
        } catch (error) {
            log.error(`Error creating window ${windowName}:`, error);
            return null;
        }
    }

    /**
     * Set up event handlers for a window
     * @method setupWindowEvents
     * @param {Electron.BrowserWindow} window - Window to set up events for
     * @param {string} windowName - Name of the window
     */
    setupWindowEvents(window, windowName) {
        if (!window || !windowName) {
            return;
        }

        // Show window when ready if not starting in tray
        window.once('ready-to-show', () => {
            if (!window.isDestroyed() && (!window.metadata || !window.metadata.startHidden)) {
                window.show();
                // Update tray icon state
                const trayService = require('./tray.service');
                trayService.updateTrayIcon(windowName, true);
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
                    // Update tray icon state
                    const trayService = require('./tray.service');
                    trayService.updateTrayIcon(windowName, false);
                    return;
                }

                // Remove from our map
                this.windows.delete(windowName);

                // Check if this was the last window
                if (this.windows.size === 0) {
                    // Set quitting flag to prevent windows from being hidden
                    this.isQuitting = true;
                    
                    try {
                        // Clean up tray icons to allow app to exit
                        const trayService = require('./tray.service');
                        trayService.cleanup();
                        
                        // Clean up instance manager
                        const instanceManager = require('./instance.manager');
                        await instanceManager.cleanup();
                    } catch (cleanupError) {
                        // Log but continue with quit even if cleanup fails
                        const log = require('../services/logging.service');
                        log.error('Error during final cleanup:', cleanupError);
                    }
                    
                    // Force quit the application
                    const { app } = require('electron');
                    
                    // Use a timeout to ensure all async operations have time to complete
                    // but don't emit events that could trigger race conditions
                    process.nextTick(() => {
                        app.exit(0); // Force immediate exit
                    });
                }
            } catch (error) {
                const log = require('../services/logging.service');
                log.error(`Error cleaning up window ${windowName}:`, error);
                
                // Ensure app quits even if there's an error
                const { app } = require('electron');
                app.exit(1);
            }
        });

        // Handle window hide event
        window.on('hide', () => {
            // Only update tray if we're not quitting
            if (!this.isQuitting) {
                // Update tray icon state
                const trayService = require('./tray.service');
                trayService.updateTrayIcon(windowName, false);

                if (window.metadata && window.metadata.provider) {
                    const { provider } = window.metadata;
                    if (provider.onWindowHide) {
                        provider.onWindowHide();
                    }
                }
            }
        });

        // Handle window show event
        window.on('show', () => {
            // Only update tray if we're not quitting
            if (!this.isQuitting) {
                // Update tray icon state
                const trayService = require('./tray.service');
                trayService.updateTrayIcon(windowName, true);

                if (window.metadata && window.metadata.provider) {
                    const { provider } = window.metadata;
                    if (provider.onWindowShow) {
                        provider.onWindowShow();
                    }
                }
            }
        });

        // Clear event listeners on window destruction
        window.on('closed', async () => {
            try {
                // Cleanup session if provider exists
                if (window.metadata && window.metadata.provider) {
                    const { provider, profile } = window.metadata;
                    const instanceManager = require('./instance.manager');
                    await instanceManager.unregisterSession(provider, profile);
                }
            } catch (error) {
                log.error(`Error cleaning up session for window ${windowName}:`, error);
            } finally {
                window.removeAllListeners();
            }
        });
    }

    /**
     * Get a window by its name
     * @method getWindow
     * @param {string} windowName - Name of the window to retrieve
     * @returns {Electron.BrowserWindow|undefined} The window instance if found
     */
    getWindow(windowName) {
        return this.windows.get(windowName);
    }

    /**
     * Get all active windows
     * @method getAllWindows
     * @returns {Electron.BrowserWindow[]} Array of all window instances
     */
    getAllWindows() {
        return Array.from(this.windows.values());
    }

    /**
     * Resolve a window reference from either a window instance or name
     * @method resolveWindow
     * @param {Electron.BrowserWindow|string} windowOrName - Window instance or name
     * @returns {Object} Object containing window and windowName
     * @property {Electron.BrowserWindow|null} window - Resolved window instance
     * @property {string|null} windowName - Resolved window name
     */
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

    /**
     * Show and focus a window
     * @method showWindow
     * @param {Electron.BrowserWindow|string} windowOrName - Window instance or name
     * @throws {Error} If window operation fails
     */
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

    /**
     * Hide a window
     * @method hideWindow
     * @param {Electron.BrowserWindow|string} windowOrName - Window instance or name
     * @throws {Error} If window operation fails
     */
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

    /**
     * Toggle window visibility
     * @method toggleWindow
     * @param {Electron.BrowserWindow|string} windowOrName - Window instance or name
     * @throws {Error} If window operation fails
     */
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

    /**
     * Close a window
     * @method closeWindow
     * @param {Electron.BrowserWindow|string} windowOrName - Window instance or name
     * @param {boolean} [force=false] - Force close without allowing prevention
     * @throws {Error} If window operation fails
     */
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

    /**
     * Close all windows
     * @method closeAllWindows
     * @param {boolean} [force=false] - Force close without allowing prevention
     * @throws {Error} If window operation fails
     */
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

    /**
     * Clean up all windows and prepare for app quit
     * @method cleanup
     * @throws {Error} If cleanup fails
     */
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

// Export a singleton instance
module.exports = new WindowService();
