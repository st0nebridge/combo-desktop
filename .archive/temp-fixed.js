/**
 * Get the PID file path
 * @method getPidFilePath
 * @private
 * @returns {string} The PID file path
 */
getPidFilePath() {
    const path = require('path');
    const os = require('os');
    let appName = 'desk-tray';
    let userDataPath;
    
    // Get app name safely
    try {
        const packageJson = require('../../package.json');
        appName = packageJson.name || appName;
    } catch (error) {
        log.warn('Could not load package.json for PID file path, using default', error);
    }
    
    // Get userData path safely
    try {
        if (app && typeof app.getPath === 'function') {
            userDataPath = app.getPath('userData');
        } else {
            userDataPath = path.join(os.tmpdir(), appName);
            log.warn(`Could not get userData path, using temporary path: ${userDataPath}`);
        }
    } catch (error) {
        userDataPath = path.join(os.tmpdir(), appName);
        log.warn(`Error getting userData path, using temporary path: ${userDataPath}`, error);
    }
    
    return path.join(userDataPath, `${appName}.pids.json`);
}
