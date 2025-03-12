const { app } = require('electron');
const log = require('electron-log');

// Import services
const appManager = require('./services/app.manager');

// Import CLI handlers
const providerCLI = require('./cli/provider-cli');
const instanceCLI = require('./cli/instance-cli');
const profileCLI = require('./cli/profile-cli');
const helpCLI = require('./cli/help-cli');

// Initialize app
app.whenReady().then(async () => {
    log.info('Application starting...');

    // Handle CLI commands that don't need full app initialization
    if (providerCLI.isCliCommand() || instanceCLI.isCliCommand()) {
        if (instanceCLI.isCliCommand()) {
            await instanceCLI.execute();
        }
        app.exit(0);
        return;
    }

    // Handle help/manual command
    if (process.argv.includes('--manual')) {
        await helpCLI.showManual();
        app.exit(0);
        return;
    }

    // Handle profile commands
    if (process.argv.includes('--list-profiles')) {
        await profileCLI.listProfiles();
        app.exit(0);
        return;
    }

    // Initialize app for normal operation
    const success = await appManager.initialize();
    
    // If initialization failed, exit
    if (!success) {
        app.exit(1);
        return;
    }

    // Handle window-all-closed event
    app.on('window-all-closed', () => {
        // Keep app running if there are active sessions
        const instanceManager = require('./services/instance.manager');
        if (instanceManager.activeSessions.size > 0) {
            return;
        }
        app.quit();
    });
});
