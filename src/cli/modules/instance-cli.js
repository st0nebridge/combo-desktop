/**
 * @module InstanceCLI
 * @description CLI module for managing application instances and their lifecycle.
 * Handles instance creation, listing, locking, and tray behavior.
 */

const BaseCLI = require('../abstract/base-cli');
const log = require('electron-log');
const fs = require('fs-extra');
const path = require('path');
const { app } = require('electron');

/**
 * CLI module for managing application instances.
 * Extends BaseCLI to provide instance management functionality:
 * - Instance listing and status
 * - Instance lock management
 * - Tray and startup behavior
 * @class InstanceCLI
 * @extends {BaseCLI}
 */
class InstanceCLI extends BaseCLI {
    /**
     * Creates a new InstanceCLI instance
     * @constructor
     */
    constructor() {
        super();
        
        /** @property {Array<string>} moduleFlags - Supported command flags */
        this.moduleFlags = [
            '--instances',
            '--new-instance',
            '--one-instance',
            '--reset-lock',
            '--tray'
        ];

        // Initialize paths
        this.initializePaths();

        // Bind command functions
        /** @property {Object} commands - Map of command names to handler functions */
        this.commands = {
            'instances': this.listInstances.bind(this),
            'reset-lock': this.resetLock.bind(this)
        };
    }

    /**
     * Initialize instance-related paths and ensure directories exist
     * @method initializePaths
     * @throws {Error} If initialization fails
     */
    initializePaths() {
        try {
            // Ensure app name is set before getting userData path
            if (!app.name) {
                const packageJson = require('../../../package.json');
                app.name = packageJson.name;
            }

            const userData = app.getPath('userData');
            this.instanceLockFile = path.join(userData, 'instance.lock');
            this.pidFile = path.join(userData, 'pids.json');

            // Ensure directories exist
            fs.ensureDirSync(userData);
        } catch (error) {
            log.error('Error initializing instance paths:', error);
            throw error;
        }
    }

    /**
     * Get instance-specific result object with additional fields
     * @method getInstanceResultObject
     * @returns {Object} Result object with structure { help: false, manual: false, tray: false, newInstance: false, oneInstance: false, resetLock: false, instances: false, cliCommand: false }
     */
    getInstanceResultObject() {
        const result = this.getBaseResultObject();
        return {
            ...result,
            tray: false,
            newInstance: false,
            oneInstance: false,
            resetLock: false,
            instances: false,
            cliCommand: false
        };
    }

    /**
     * Parse instance-specific command line arguments
     * @method parseArgs
     * @override
     * @returns {Object|null} Parsed arguments or null if no instance flags found
     */
    parseArgs() {
        const result = this.getInstanceResultObject();

        let i = 0;
        while (i < this.args.length) {
            const arg = this.args[i];

            switch (arg) {
                case '--tray': {
                    result.tray = true;
                    i++;
                    break;
                }
                case '--new-instance': {
                    result.newInstance = true;
                    i++;
                    break;
                }
                case '--one-instance': {
                    result.oneInstance = true;
                    i++;
                    break;
                }
                case '--reset-lock': {
                    result.resetLock = true;
                    result.cliCommand = true;
                    i++;
                    break;
                }
                case '--instances': {
                    result.instances = true;
                    result.cliCommand = true;
                    i++;
                    break;
                }
                default: {
                    i = this.parseCommonFlags(result, i);
                }
            }
        }

        // Return null if no instance-specific flags found
        if (!result.tray && 
            !result.newInstance && 
            !result.oneInstance && 
            !result.resetLock && 
            !result.instances && 
            !result.help && 
            !result.manual) {
            return null;
        }

        return result;
    }

    /**
     * Check if the current command is a CLI command
     * @method isCliCommand
     * @override
     * @returns {boolean} True if this is a CLI command
     */
    isCliCommand() {
        try {
            const args = this.parseArgs();
            return args && args.cliCommand;
        } catch (error) {
            log.error('Error checking CLI command:', error);
            return false;
        }
    }

    /**
     * Execute instance-specific commands based on parsed arguments
     * @method execute
     * @override
     * @param {Object} args - Parsed arguments from parseArgs()
     * @throws {Error} If command execution fails
     */
    execute(args) {
        try {
            if (!args) {
                return;
            }

            if (args.help) {
                this.showUsage();
                return;
            }

            if (args.manual) {
                this.showManual();
                return;
            }

            // Execute bound commands
            if (args.instances && this.commands.instances) {
                this.commands.instances();
                return;
            }

            if (args.resetLock && this.commands['reset-lock']) {
                this.commands['reset-lock']();
                return;
            }

            // Handle instance flags
            if (args.tray) {
                log.info('Starting minimized to tray');
            }
            if (args.newInstance) {
                log.info('Forcing new instance');
            }
            if (args.oneInstance) {
                log.info('Enforcing single instance');
            }
        } catch (error) {
            log.error('Error executing instance command:', error);
            throw error;
        }
    }

    /**
     * Show basic usage information and available commands
     * @method showUsage
     * @override
     */
    showUsage() {
        console.log('\nInstance Management Commands:');
        console.log('  --instances       List running instances');
        console.log('  --new-instance    Force create new instance');
        console.log('  --one-instance    Force use existing instance');
        console.log('  --reset-lock      Reset instance lock file');
        console.log('  --tray            Start minimized to tray');
        console.log('\nHelp Options:');
        console.log('  --help            Show this help');
        console.log('  --manual          Show detailed manual\n');
    }

    /**
     * Show detailed manual with instance management information
     * @method showManual
     * @override
     */
    showManual() {
        console.log('\nInstance Management Manual:');
        console.log('\n1. Instance Isolation');
        console.log('   Each instance runs in its own process and can have its own profile.');
        console.log('   Use --new-instance to force create a new instance.');
        console.log('   Use --one-instance to force use an existing instance.');
        console.log('\n2. Lock Management');
        console.log('   The app uses a lock file to track running instances.');
        console.log('   If the app crashes, the lock might remain.');
        console.log('   Use --reset-lock to clear a stuck lock file.');
        console.log('\n3. Tray Mode');
        console.log('   Start the app minimized to tray with --tray.\n');
    }

    /**
     * List all running application instances
     * @method listInstances
     * @throws {Error} If unable to read instance information
     */
    async listInstances() {
        try {
            if (!fs.existsSync(this.instanceLockFile)) {
                console.log('\nNo instances running.\n');
                return;
            }

            const pids = await fs.readJson(this.pidFile, { throws: false }) || {};
            const runningPids = Object.entries(pids)
                .filter(([pid]) => {
                    try {
                        process.kill(parseInt(pid), 0);
                        return true;
                    } catch {
                        return false;
                    }
                });

            if (runningPids.length === 0) {
                console.log('\nNo instances running.\n');
                return;
            }

            console.log('\nRunning instances:');
            for (const [pid, info] of runningPids) {
                console.log(`  - PID ${pid}${info.profile ? ` (${info.profile})` : ''}`);
            }
            console.log();
        } catch (error) {
            log.error('Error listing instances:', error);
            throw error;
        }
    }

    /**
     * Reset the instance lock file
     * @method resetLock
     * @throws {Error} If unable to reset lock file
     */
    async resetLock() {
        try {
            await fs.remove(this.instanceLockFile);
            console.log('\nInstance lock reset.\n');
        } catch (error) {
            log.error('Error resetting instance lock:', error);
            throw error;
        }
    }
}

module.exports = InstanceCLI;
