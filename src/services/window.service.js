const { BrowserWindow } = require('electron');
const log = require('electron-log');
const profileManager = require('./profile.manager');

class WindowService {
    constructor() {
        // Map to store named windows
        this.namedWindows = new Map();
        // Array to store unnamed windows
        this.unnamedWindows = [];
        // Counter for generating unique window IDs
        this.windowCounter = 0;
        // Map to store session windows
        this.sessionWindows = new Map();
    }

    /**
     * Create a new window with optional name
     * @param {Object} config - BrowserWindow configuration
     * @param {string} [name] - Optional name for the window
     * @param {Object} [session] - Optional session info { provider, profile }
     * @returns {BrowserWindow} The created window instance
     */
    createWindow(config, name = null, session = null) {
        // Check if session window already exists
        if (session) {
            const sessionKey = profileManager.getPartitionName(session.provider, session.profile);
            const existingWindow = this.sessionWindows.get(sessionKey);
            if (existingWindow && !existingWindow.window.isDestroyed()) {
                existingWindow.window.show();
                return existingWindow.window;
            }

            // Ensure proper session partitioning
            if (!config.webPreferences) {
                config.webPreferences = {};
            }
            config.webPreferences.partition = sessionKey;
        }

        const window = new BrowserWindow(config);
        const windowId = ++this.windowCounter;

        // Store window metadata
        const windowMeta = {
            id: windowId,
            window,
            name,
            session,
            createdAt: new Date()
        };

        if (name) {
            log.info(`Creating named window: ${name} (ID: ${windowId})`);
            this.namedWindows.set(name, windowMeta);
        } else {
            log.info(`Creating unnamed window (ID: ${windowId})`);
            this.unnamedWindows.push(windowMeta);
        }

        // Store session window if applicable
        if (session) {
            const sessionKey = profileManager.getPartitionName(session.provider, session.profile);
            this.sessionWindows.set(sessionKey, windowMeta);
            log.info(`Window assigned to session: ${sessionKey}`);
        }

        // Clean up when window is closed
        window.on('closed', () => this.removeWindow(windowId, name));

        return window;
    }

    /**
     * Get a window by its session
     * @param {string} provider - Provider name
     * @param {string} profile - Profile name
     * @returns {BrowserWindow|null} The window instance if found, null otherwise
     */
    getWindowBySession(provider, profile = 'default') {
        const sessionKey = profileManager.getPartitionName(provider, profile);
        const windowMeta = this.sessionWindows.get(sessionKey);
        return windowMeta ? windowMeta.window : null;
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
     * Get all session windows
     * @returns {Map<string, Object>} Map of session windows
     */
    getSessionWindows() {
        return this.sessionWindows;
    }

    /**
     * Get session metadata for a window
     * @param {string} provider - Provider name
     * @param {string} profile - Profile name
     * @returns {Object|null} Session metadata if found
     */
    getSessionMetadata(provider, profile = 'default') {
        const sessionKey = profileManager.getPartitionName(provider, profile);
        return this.sessionWindows.get(sessionKey);
    }

    /**
     * Remove a window from management
     * @private
     * @param {number} windowId - ID of the window to remove
     * @param {string} [name] - Name of the window if it was named
     */
    removeWindow(windowId, name = null) {
        let windowMeta;

        if (name) {
            log.info(`Removing named window: ${name} (ID: ${windowId})`);
            windowMeta = this.namedWindows.get(name);
            this.namedWindows.delete(name);
        } else {
            log.info(`Removing unnamed window (ID: ${windowId})`);
            const index = this.unnamedWindows.findIndex(w => w.id === windowId);
            if (index !== -1) {
                windowMeta = this.unnamedWindows[index];
                this.unnamedWindows.splice(index, 1);
            }
        }

        // Remove from session windows if applicable
        if (windowMeta?.session) {
            const sessionKey = profileManager.getPartitionName(
                windowMeta.session.provider,
                windowMeta.session.profile || 'default'
            );
            this.sessionWindows.delete(sessionKey);
            log.info(`Window removed from session: ${sessionKey}`);
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
