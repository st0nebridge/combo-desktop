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
        let i = 0;

        while (i < this.args.length) {
            const arg = this.args[i];
            
            // Handle --config flag
            if (arg === '--config') {
                if (i + 1 < this.args.length) {
                    this.configFile = this.args[i + 1];
                    i += 2;
                } else {
                    i++;
                }
                continue;
            }

            // Skip CLI flags
            if (this.isCliFlag(arg)) {
                i++;
                continue;
            }

            // Only process provider arguments that start with --
            if (arg.startsWith('--')) {
                const provider = arg; // Keep the -- prefix
                let profile = null;

                // Check if next argument exists and is not a flag/provider
                if (i + 1 < this.args.length && !this.args[i + 1].startsWith('--')) {
                    profile = this.args[i + 1];
                    i += 2;
                } else {
                    i++;
                }

                providers.push({ provider, profile });
            } else {
                // Skip non-provider arguments
                i++;
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
            '--help',
            '--manual'
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
                   arg === '--help' ||
                   arg === '--manual';
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
