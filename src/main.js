const { app } = require('electron');

// Import services
const logger = require('./services/logging.service');
const appManager = require('./services/app.manager');

// Import CLI handlers
const profileCLI = require('./cli/profile-cli');
const helpCLI = require('./cli/help-cli');

// Handle profile CLI commands
const profileCommandIndex = process.argv.indexOf('--profiles');
if (profileCommandIndex !== -1) {
    app.whenReady().then(() => {
        profileCLI.handleCommand(process.argv.slice(profileCommandIndex + 1));
    });
    return;
}

// Handle manual/help commands
const manualCommandIndex = process.argv.indexOf('--manual');
if (manualCommandIndex !== -1) {
    app.whenReady().then(() => {
        helpCLI.run(process.argv);
        app.exit(0);
    });
    return;
}

// Initialize app
app.whenReady().then(async () => {
    logger.info('Application starting...');
    await appManager.initialize();
});
