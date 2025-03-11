const log = require('electron-log');

class LoggingService {
    constructor() {
        this.initializeLogging();
    }

    initializeLogging() {
        log.transports.console.level = 'debug';
        log.transports.file.level = 'debug';
        log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
        log.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] {text}';
        log.errorHandler.startCatching();
        log.info('Logging initialized');
    }

    info(...args) {
        log.info(...args);
    }

    warn(...args) {
        log.warn(...args);
    }

    error(...args) {
        log.error(...args);
    }

    debug(...args) {
        log.debug(...args);
    }
}

module.exports = new LoggingService();
