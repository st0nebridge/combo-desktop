/**
 * @file Window management service that handles creation, lifecycle, and state
 * of all application windows. Provides centralized window control and event handling.
 */

// Import electron-related modules with fallbacks for robustness
let BrowserWindow, app, session;
try {
    const electron = require('electron');
    BrowserWindow = electron.BrowserWindow;
    app = electron.app;
    session = electron.session;
} catch (error) {
    console.error('Error loading electron modules:', error);
}

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
        // Map of all windows managed by the service
        this.windows = new Map();
        
        // Track whether the app is quitting
        this.isQuitting = false;
        
        // Default window options
        this.defaultOptions = {
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        };

        this.initialized = false;
    }

    /**
     * Initialize event listeners for the window service
     * Should be called after the app is ready
     * @method initEvents
     */
    initEvents() {
        // Listen for app quit event
        if (app) {
            app.on('before-quit', () => {
                this.isQuitting = true;
            });
        } else {
            log.warn('Electron app object not available for event binding');
        }
    }

    /**
     * Initialize the window service
     * @method init
     * @returns {Promise<void>}
     */
    async init() {
        if (this.initialized) {
            log.debug('Window service already initialized');
            return;
        }

        try {
            log.info('Initializing window service');
            
            // Check if Electron components are available
            if (!BrowserWindow || !app) {
                // TODO: Clean up these mock implementations
                log.warn('Could not initialize window service: Electron components unavailable');
                // Create a mock implementation for critical methods
                this.createWindow = (windowName, windowOptions, metadata) => {
                    log.warn(`Mock window created for: ${windowName} (actual window creation skipped due to missing Electron components)`);
                    
                    // Create a more robust mock webContents object
                    const mockWebContents = {
                        id: Math.floor(Math.random() * 10000),
                        on: () => {},
                        once: () => {},
                        session: {},
                        loadURL: (url) => {
                            log.info(`[MOCK] Loading URL in window ${windowName}: ${url}`);
                            return Promise.resolve();
                        },
                        executeJavaScript: (script) => {
                            log.info(`[MOCK] Executing JavaScript in window ${windowName}`);
                            log.debug(`[MOCK] Script content: ${script.substring(0, 100)}...`);
                            return Promise.resolve(true);
                        },
                        setUserAgent: () => {},
                        setWindowOpenHandler: () => {},
                        send: () => {}
                    };
                    
                    return { 
                        id: Math.floor(Math.random() * 10000),
                        metadata,
                        webContents: mockWebContents,
                        // Add methods directly on window object for compatibility
                        loadURL: (url) => {
                            log.info(`[MOCK] Loading URL in window ${windowName}: ${url}`);
                            return Promise.resolve();
                        },
                        executeJavaScript: (script) => {
                            log.info(`[MOCK] Executing JavaScript in window ${windowName}`);
                            log.debug(`[MOCK] Script content: ${script.substring(0, 100)}...`);
                            return Promise.resolve(true);
                        },
                        on: () => {},
                        once: () => {},
                        close: () => {},
                        show: () => {},
                        hide: () => {},
                        isFocused: () => false,
                        isDestroyed: () => false
                    };
                };
            }
            
            // Initialize event listeners
            this.initEvents();
            
            // Clean up any existing windows
            try {
                await this.cleanup();
            } catch (err) {
                log.warn('Error during window cleanup:', err);
            }
            
            this.initialized = true;
            log.info('Window service initialized');
        } catch (error) {
            log.error('Error initializing window service:', error);
        }
    }

    /**
     * Create a new window or get existing window
     * @method createWindow
     * @param {Object} options - Window creation options
     * @param {string} windowName - Name for the window
     * @param {Object} [metadata={}] - Additional metadata to attach to the window
     * @returns {Electron.BrowserWindow} Created or existing window
     */
    createWindow(options = {}, windowName, metadata = {}) {
        try {
            // Check if window already exists
            log.info(`Checking if window ${windowName} already exists...`);
            const existingWindow = this.windows.get(windowName);
            if (existingWindow && !existingWindow.isDestroyed()) {
                log.info(`Window ${windowName} already exists, returning existing window`);
                return existingWindow;
            }

            // Create new window with show: false to prevent automatic showing/focusing
            const windowOptions = {
                ...this.defaultOptions,
                ...options,
                show: false, // Prevent automatic showing and focusing
                webPreferences: {
                    ...this.defaultOptions.webPreferences,
                    ...options.webPreferences
                }
            };

            log.info(`Creating new window: ${windowName} with options:`, JSON.stringify({
                width: windowOptions.width,
                height: windowOptions.height,
                show: windowOptions.show,
                partition: windowOptions.webPreferences?.partition
            }));

            let window;
            
            // Check if BrowserWindow is available and is a constructor
            if (typeof BrowserWindow !== 'function') {
                // TODO: Cleanup mocks
                log.warn(`BrowserWindow is not available or not a constructor (type: ${typeof BrowserWindow}), using mock implementation`);
                
                // Create a mock window object with the necessary properties and methods
                const mockWebContents = {
                    on: () => {},
                    once: () => {},
                    session: {},
                    loadURL: (url) => {
                        log.info(`[MOCK] Loading URL in window ${windowName}: ${url}`);
                        return Promise.resolve();
                    },
                    executeJavaScript: (script) => {
                        log.info(`[MOCK] Executing JavaScript in window ${windowName}`);
                        log.debug(`[MOCK] Script content: ${script.substring(0, 100)}...`);
                        return Promise.resolve(true);
                    },
                    setUserAgent: () => {},
                    setWindowOpenHandler: () => {},
                    send: () => {}
                };
                
                window = {
                    id: Math.floor(Math.random() * 10000),
                    metadata,
                    on: () => {},
                    once: () => {},
                    webContents: mockWebContents,
                    // Add loadURL method directly on window object for compatibility
                    loadURL: (url) => {
                        log.info(`[MOCK] Loading URL in window ${windowName}: ${url}`);
                        return Promise.resolve();
                    },
                    executeJavaScript: (script) => {
                        log.info(`[MOCK] Executing JavaScript in window ${windowName}`);
                        log.debug(`[MOCK] Script content: ${script.substring(0, 100)}...`);
                        return Promise.resolve(true);
                    },
                    on: () => {},
                    once: () => {},
                    close: () => {
                        log.info(`[MOCK] Closing window ${windowName}`);
                        this.windows.delete(windowName);
                    },
                    show: () => { log.info(`[MOCK] Showing window ${windowName}`); },
                    hide: () => { log.info(`[MOCK] Hiding window ${windowName}`); },
                    isFocused: () => false,
                    isVisible: () => true,
                    isDestroyed: () => false
                };
            } else {
                try {
                    // Create a real Electron BrowserWindow
                    window = new BrowserWindow(windowOptions);
                } catch (error) {
                    log.error(`Error creating BrowserWindow: ${error.message}, falling back to mock implementation`);
                    
                    // Fallback to mock window
                    window = {
                        id: Math.floor(Math.random() * 10000),
                        metadata,
                        webContents: {
                            id: Math.floor(Math.random() * 10000),
                            on: () => {},
                            once: () => {},
                            session: {},
                            loadURL: (url) => {
                                log.info(`[MOCK] Loading URL in window ${windowName}: ${url}`);
                                return Promise.resolve();
                            },
                            executeJavaScript: (script) => {
                                log.info(`[MOCK] Executing JavaScript in window ${windowName}`);
                                return Promise.resolve();
                            },
                            setUserAgent: () => {},
                            setWindowOpenHandler: () => {},
                            send: () => {}
                        },
                        on: () => {},
                        once: () => {},
                        close: () => {
                            log.info(`[MOCK] Closing window ${windowName}`);
                            this.windows.delete(windowName);
                        },
                        show: () => { log.info(`[MOCK] Showing window ${windowName}`); },
                        hide: () => { log.info(`[MOCK] Hiding window ${windowName}`); },
                        isFocused: () => false,
                        isVisible: () => true,
                        isDestroyed: () => false
                    };
                }
            }

            // Store window reference
            this.windows.set(windowName, window);
            
            // Attach metadata to window
            window.metadata = metadata;
            
            // Set up window event handlers
            try {
                this.setupWindowEvents(window, windowName);
            } catch (error) {
                log.warn(`Error setting up window events: ${error.message}`);
            }
            
            log.info(`Created window: ${windowName} with profile: ${metadata.profile}`);
            return window;
        } catch (error) {
            log.error(`Error creating window ${windowName}:`, error);
            throw error;
        }
    }

    /**
     * Set up event handlers for a window
     * @method setupWindowEvents
     * @param {Electron.BrowserWindow} window - Window to set up events for
     * @param {string} windowName - Name of the window
     */
    setupWindowEvents(window, windowName) {
        if (!window || window.isDestroyed()) {
            log.error('Cannot setup events - window is destroyed or not available');
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

        // Handle window close event
        window.on('close', (event) => {
            // Skip if window is already destroyed
            if (window.isDestroyed()) {
                return;
            }

            const appManager = require('./app.manager');
            log.info(`Window close event: ${windowName}, forceClose=${window.forceClose}, isQuitting=${this.isQuitting || appManager.isQuitting}`);

            // Allow close if force flag is set or if app is quitting
            if (window.forceClose || this.isQuitting || appManager.isQuitting) {
                return;
            }

            // Prevent default close and hide instead
            event.preventDefault();
            window.hide();
            log.info(`Window ${windowName} hidden instead of closed`);
            
            try {
                const trayService = require('./tray.service');
                if (trayService.trays && trayService.trays.has(windowName)) {
                    trayService.updateTrayIcon(windowName, false);
                }
            } catch (error) {
                log.error(`Error updating tray icon for ${windowName}:`, error);
            }
        });

        // Handle window closed event (after window is actually closed)
        window.on('closed', () => {
            try {
                this.windows.delete(windowName);
                log.info(`Window ${windowName} closed. Windows remaining: ${this.windows.size}`);
            } catch (error) {
                log.error(`Error handling window closed event for ${windowName}:`, error);
            }
        });

        // Handle window hide event
        window.on('hide', () => {
            if (!this.isQuitting && !window.isDestroyed()) {
                log.info(`Window ${windowName} hidden`);
                try {
                    const trayService = require('./tray.service');
                    if (trayService.trays && trayService.trays.has(windowName)) {
                        trayService.updateTrayIcon(windowName, false);
                    }
                } catch (error) {
                    log.error(`Error updating tray icon for ${windowName}:`, error);
                }
            }
        });

        // Handle window show event
        window.on('show', () => {
            if (!window.isDestroyed()) {
                log.info(`Window ${windowName} shown`);
                try {
                    const trayService = require('./tray.service');
                    if (trayService.trays && trayService.trays.has(windowName)) {
                        trayService.updateTrayIcon(windowName, true);
                    }
                } catch (error) {
                    log.error(`Error updating tray icon for ${windowName}:`, error);
                }
            }
        });
    }

    /**
     * Clean up provider sessions and data for a window
     * @private
     * @method cleanupProviderSessions
     * @param {Electron.BrowserWindow} window - Window to clean up
     * @param {string} windowName - Name of the window
     * @returns {Promise<void>}
     */
    async cleanupProviderSessions(window, windowName) {

        // TODO see if this can be removed
        
        if (window.isDestroyed()) {
            return;
        }

        try {
            log.info(`Cleaning up provider sessions for ${windowName}`);

            // Get provider and profile from window metadata
            if (window.metadata && window.metadata.provider && window.metadata.profile) {
                const { provider, profile } = window.metadata;
                const providerName = provider.getName ? provider.getName() : provider.name;
                log.info(`Unregistering session for ${providerName}:${profile}`);

                // Unregister provider session
                const instanceManager = require('./instance.manager');
                await instanceManager.unregisterSession(providerName, profile);

                // Only clear session data if temp flag was set
                if (window.metadata.isTemp) {
                    log.info(`Temp flag set, clearing session data for ${windowName}`);
                    
                    // Get the actual partition name used (with persist: prefix)
                    let partitionName = provider.getPartitionName(profile);
                    if (!partitionName.startsWith('persist:')) {
                        partitionName = `persist:${partitionName}`;
                    }
                    
                    const { session } = require('electron');
                    const partitionSession = session.fromPartition(partitionName);
                    if (partitionSession) {
                        await partitionSession.clearStorageData();
                        log.info(`Cleared session data for ${windowName} (partition: ${partitionName})`);
                    }
                } else {
                    log.info(`Session data preserved for ${windowName} (temp flag not set)`);
                }
            }

            // Remove all listeners if window still exists
            if (!window.isDestroyed()) {
                window.removeAllListeners();
                log.info(`Removed all window listeners for ${windowName}`);
            }
        } catch (error) {
            log.error(`Error cleaning up provider sessions for ${windowName}:`, error);
            throw error;
        }
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
