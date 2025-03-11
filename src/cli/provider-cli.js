const log = require('electron-log');
const fs = require('fs');
const providerRegistry = require('../providers/provider.registry');

class ProviderCLI {
    constructor() {
        this.args = process.argv.slice(2);
        this.configFile = null;
    }

    /**
     * Parse arguments for providers
     * @returns {Array<{provider: string, profile: string}>} Array of provider and profile pairs
     */
    parseProviderArgs() {
        const providers = [];
        let currentProvider = null;
        let currentProfile = null;

        for (let i = 0; i < this.args.length; i++) {
            const arg = this.args[i];
            
            if (arg === '--config') {
                if (i + 1 < this.args.length) {
                    this.configFile = this.args[i + 1];
                    i++; // Skip next argument
                }
                continue;
            }

            if (this.isCliFlag(arg)) {
                continue;
            }

            if (arg.startsWith('--profile=')) {
                currentProfile = arg.split('=')[1];
                if (currentProvider) {
                    providers.push({ provider: currentProvider, profile: currentProfile });
                    currentProvider = null;
                    currentProfile = null;
                }
                continue;
            }

            currentProvider = arg;
            if (currentProfile) {
                providers.push({ provider: currentProvider, profile: currentProfile });
                currentProvider = null;
                currentProfile = null;
            } else {
                providers.push({ provider: currentProvider, profile: null });
                currentProvider = null;
            }
        }

        return providers;
    }

    /**
     * Check if an argument is a CLI flag
     * @param {string} arg - The argument to check
     * @returns {boolean} True if the argument is a CLI flag
     */
    isCliFlag(arg) {
        const cliFlags = [
            '--tray',
            '--new-instance',
            '--one-instance',
            '--reset-lock',
            '--version',
            '--help'
        ];
        return cliFlags.includes(arg);
    }

    /**
     * Check if this is a CLI command that shouldn't register a PID
     * @returns {boolean} True if this is a CLI command
     */
    isCliCommand() {
        return this.args.some(arg => {
            return arg === '--reset-lock' || 
                   arg === '--version' || 
                   arg === '--help';
        });
    }

    /**
     * Check if the application should start minimized
     * @returns {boolean} True if --tray argument is present
     */
    shouldStartMinimized() {
        return this.args.includes('--tray');
    }

    /**
     * Check if a new instance should be forced
     * @returns {boolean} True if --new-instance argument is present
     */
    shouldForceNewInstance() {
        return this.args.includes('--new-instance');
    }

    /**
     * Check if only one instance should be allowed
     * @returns {boolean} True if --one-instance argument is present
     */
    shouldUseOneInstance() {
        return this.args.includes('--one-instance');
    }

    /**
     * Check if instance lock should be reset
     * @returns {boolean} True if --reset-lock argument is present
     */
    shouldResetLock() {
        return this.args.includes('--reset-lock');
    }

    /**
     * Get config file path if specified
     * @returns {string|null} Config file path or null
     */
    getConfigFile() {
        return this.configFile;
    }
}

module.exports = new ProviderCLI();
