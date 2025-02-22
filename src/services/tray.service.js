// Tray management logic
const { Tray, Menu } = require('electron');

class TrayService {
    constructor() {
        this.tray = null;
    }

    createTray(iconPath, contextMenu) {
        this.tray = new Tray(iconPath);
        this.tray.setContextMenu(Menu.buildFromTemplate(contextMenu));
        // Additional tray setup can go here
    }

    // Add other tray-related methods here
}

module.exports = new TrayService();
