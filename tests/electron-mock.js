/**
 * @file Electron Mock
 * @description Mock implementation of Electron for testing
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Create fixtures directory for userData if it doesn't exist
const fixturesDir = path.join(__dirname, 'fixtures');
const userDataDir = path.join(fixturesDir, 'userData');
fs.mkdirSync(userDataDir, { recursive: true });

// Set app name for testing
process.env.APP_NAME = process.env.APP_NAME || 'desk-tray';

/**
 * Mock implementation of Electron app
 */
const app = {
    // Use getter for name to ensure it's always up-to-date with process.env.APP_NAME
    get name() {
        return process.env.APP_NAME || 'desk-tray';
    },
    getPath: (name) => {
        switch (name) {
            case 'userData':
                return userDataDir;
            case 'appData':
                return path.join(os.tmpdir(), 'appData');
            case 'temp':
                return os.tmpdir();
            case 'desktop':
                return path.join(os.homedir(), 'Desktop');
            case 'documents':
                return path.join(os.homedir(), 'Documents');
            case 'downloads':
                return path.join(os.homedir(), 'Downloads');
            case 'home':
                return os.homedir();
            default:
                return path.join(fixturesDir, name);
        }
    },
    getAppPath: () => {
        return path.resolve(__dirname, '..');
    },
    getVersion: () => {
        return '1.0.0-test';
    },
    quit: () => {
        console.log('Mock app quit called');
    },
    exit: (code) => {
        console.log(`Mock app exit called with code: ${code}`);
    },
    isPackaged: false,
    whenReady: () => Promise.resolve(),
    on: (event, callback) => {
        if (event === 'ready') {
            // Call ready callback immediately
            setTimeout(callback, 0);
        }
        return app;
    },
    once: (event, callback) => {
        if (event === 'ready') {
            // Call ready callback immediately
            setTimeout(callback, 0);
        }
        return app;
    },
    removeListener: () => {},
    removeAllListeners: () => {},
    isReady: () => true
};

/**
 * Mock implementation of Electron dialog
 */
const dialog = {
    showOpenDialog: async () => ({
        canceled: false,
        filePaths: [path.join(fixturesDir, 'mockFile.txt')]
    }),
    showSaveDialog: async () => ({
        canceled: false,
        filePath: path.join(fixturesDir, 'mockSave.txt')
    }),
    showMessageBox: async () => ({
        response: 0
    })
};

/**
 * Mock implementation of Electron BrowserWindow
 */
class BrowserWindow {
    constructor(options = {}) {
        this.options = options;
        this.webContents = {
            send: (channel, ...args) => {
                console.log(`Mock send to channel ${channel}:`, ...args);
            },
            on: () => {},
            once: () => {},
            removeListener: () => {},
            removeAllListeners: () => {},
            session: {
                on: () => {},
                once: () => {},
                removeListener: () => {},
                removeAllListeners: () => {}
            }
        };
    }

    loadURL() {
        return Promise.resolve();
    }

    loadFile() {
        return Promise.resolve();
    }

    show() {}
    hide() {}
    close() {}
    focus() {}
    maximize() {}
    minimize() {}
    restore() {}
    isMaximized() { return false; }
    isMinimized() { return false; }
    isVisible() { return true; }
    isFocused() { return true; }
    
    on() { return this; }
    once() { return this; }
    removeListener() {}
    removeAllListeners() {}
}

/**
 * Mock implementation of Electron ipcMain
 */
const ipcMain = {
    on: (channel, listener) => {
        console.log(`Mock ipcMain registered listener for channel: ${channel}`);
        return ipcMain;
    },
    once: (channel, listener) => {
        console.log(`Mock ipcMain registered one-time listener for channel: ${channel}`);
        return ipcMain;
    },
    removeListener: () => {},
    removeAllListeners: () => {}
};

/**
 * Mock implementation of Electron ipcRenderer
 */
const ipcRenderer = {
    on: (channel, listener) => {
        console.log(`Mock ipcRenderer registered listener for channel: ${channel}`);
        return ipcRenderer;
    },
    once: (channel, listener) => {
        console.log(`Mock ipcRenderer registered one-time listener for channel: ${channel}`);
        return ipcRenderer;
    },
    send: (channel, ...args) => {
        console.log(`Mock ipcRenderer sent message to channel ${channel}:`, ...args);
    },
    invoke: (channel, ...args) => {
        console.log(`Mock ipcRenderer invoked channel ${channel}:`, ...args);
        return Promise.resolve({});
    },
    removeListener: () => {},
    removeAllListeners: () => {}
};

/**
 * Mock implementation of Electron Menu
 */
const Menu = {
    buildFromTemplate: (template) => {
        return {
            popup: () => {},
            closePopup: () => {},
            items: template.map((item, index) => ({ ...item, id: index }))
        };
    },
    setApplicationMenu: () => {}
};

/**
 * Mock implementation of Electron Tray
 */
class Tray {
    constructor(iconPath) {
        this.iconPath = iconPath;
    }

    setContextMenu() {}
    setToolTip() {}
    setImage() {}
    on() { return this; }
    once() { return this; }
    removeListener() {}
    removeAllListeners() {}
}

/**
 * Mock implementation of Electron shell
 */
const shell = {
    openExternal: (url) => {
        console.log(`Mock shell opening external URL: ${url}`);
        return Promise.resolve();
    },
    openPath: (path) => {
        console.log(`Mock shell opening path: ${path}`);
        return Promise.resolve();
    },
    showItemInFolder: (path) => {
        console.log(`Mock shell showing item in folder: ${path}`);
    }
};

/**
 * Mock implementation of Electron nativeImage
 */
const nativeImage = {
    createFromPath: (path) => ({
        resize: (options) => ({
            toDataURL: () => 'data:image/png;base64,mockImageData'
        }),
        toDataURL: () => 'data:image/png;base64,mockImageData'
    }),
    createEmpty: () => ({
        resize: (options) => ({
            toDataURL: () => 'data:image/png;base64,mockImageData'
        }),
        toDataURL: () => 'data:image/png;base64,mockImageData'
    })
};

/**
 * Mock implementation of Electron clipboard
 */
const clipboard = {
    writeText: (text) => {
        console.log(`Mock clipboard writing text: ${text}`);
    },
    readText: () => 'Mock clipboard text',
    clear: () => {}
};

/**
 * Mock implementation of Electron screen
 */
const screen = {
    getPrimaryDisplay: () => ({
        workAreaSize: { width: 1920, height: 1080 },
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
        scaleFactor: 1,
        size: { width: 1920, height: 1080 }
    }),
    getAllDisplays: () => [
        {
            workAreaSize: { width: 1920, height: 1080 },
            bounds: { x: 0, y: 0, width: 1920, height: 1080 },
            workArea: { x: 0, y: 0, width: 1920, height: 1080 },
            scaleFactor: 1,
            size: { width: 1920, height: 1080 }
        }
    ],
    getCursorScreenPoint: () => ({ x: 0, y: 0 }),
    on: () => {},
    once: () => {},
    removeListener: () => {},
    removeAllListeners: () => {}
};

// Export the mock
module.exports = {
    app,
    BrowserWindow,
    dialog,
    ipcMain,
    ipcRenderer,
    Menu,
    Tray,
    shell,
    nativeImage,
    clipboard,
    screen
};