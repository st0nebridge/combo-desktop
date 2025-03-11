const { BrowserWindow } = require('electron');
const log = require('electron-log');

class WindowService {
    constructor() {
        // Map to store named windows
        this.namedWindows = new Map();
        // Array to store unnamed windows
        this.unnamedWindows = [];
        // Counter for generating unique window IDs
        this.windowCounter = 0;
    }

    /**
     * Create a new window with optional name
     * @param {Object} config - BrowserWindow configuration
     * @param {string} [name] - Optional name for the window
     * @returns {BrowserWindow} The created window instance
     */
    createWindow(config, name = null) {
        const window = new BrowserWindow(config);
        const windowId = ++this.windowCounter;

        // Store window metadata
        const windowMeta = {
            id: windowId,
            window,
            name,
            createdAt: new Date()
        };

        if (name) {
            log.info(`Creating named window: ${name} (ID: ${windowId})`);
            this.namedWindows.set(name, windowMeta);
        } else {
            log.info(`Creating unnamed window (ID: ${windowId})`);
            this.unnamedWindows.push(windowMeta);
        }

        // Clean up when window is closed
        window.on('closed', () => this.removeWindow(windowId, name));

        return window;
    }

    /**
     * Get a window by its name
     * @param {string} name - Name of the window to retrieve
     * @returns {BrowserWindow|null} The window instance if found, null otherwise
     */
    getWindowByName(name) {
        const windowMeta = this.namedWindows.get(name);
        return windowMeta ? windowMeta.window : null;
    }

    /**
     * Get all windows (both named and unnamed)
     * @returns {Array<Object>} Array of window metadata objects
     */
    getAllWindows() {
        return [
            ...Array.from(this.namedWindows.values()),
            ...this.unnamedWindows
        ];
    }

    /**
     * Get all named windows
     * @returns {Map<string, Object>} Map of named windows
     */
    getNamedWindows() {
        return this.namedWindows;
    }

    /**
     * Get all unnamed windows
     * @returns {Array<Object>} Array of unnamed windows
     */
    getUnnamedWindows() {
        return this.unnamedWindows;
    }

    /**
     * Remove a window from management
     * @private
     * @param {number} windowId - ID of the window to remove
     * @param {string} [name] - Name of the window if it was named
     */
    removeWindow(windowId, name = null) {
        if (name) {
            log.info(`Removing named window: ${name} (ID: ${windowId})`);
            this.namedWindows.delete(name);
        } else {
            log.info(`Removing unnamed window (ID: ${windowId})`);
            const index = this.unnamedWindows.findIndex(w => w.id === windowId);
            if (index !== -1) {
                this.unnamedWindows.splice(index, 1);
            }
        }
    }

    /**
     * Close all windows
     */
    closeAllWindows() {
        log.info('Closing all windows');
        for (const windowMeta of this.getAllWindows()) {
            if (!windowMeta.window.isDestroyed()) {
                windowMeta.window.close();
            }
        }
    }
}

module.exports = new WindowService();
