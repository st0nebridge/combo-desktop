/**
 * @module HelpCLI
 * @description CLI module that handles help, manual, and version information commands.
 * Provides functionality for displaying usage information, detailed manual,
 * and version details.
 */

const BaseCLI = require('../abstract/base-cli');
const log = require('electron-log');
const { app } = require('electron');

/**
 * CLI module for handling help and documentation commands.
 * Extends BaseCLI to provide help-specific functionality:
 * - Version information
 * - Usage guide
 * - Detailed manual
 * @class HelpCLI
 * @extends {BaseCLI}
 */
class HelpCLI extends BaseCLI {
    /**
     * Creates a new HelpCLI instance
     * @constructor
     */
    constructor() {
        super();
        
        /** @property {Array<string>} moduleFlags - Supported command flags */
        this.moduleFlags = [
            '--help',
            '--manual',
            '--version'
        ];

        // Initialize paths
        this.initializePaths();

        // Bind command functions
        /** @property {Object} commands - Map of command names to handler functions */
        this.commands = {
            'version': this.showVersion.bind(this),
            'help': this.showUsage.bind(this),
            'manual': this.showManual.bind(this)
        };
    }

    /**
     * Initialize help paths and application metadata
     * @method initializePaths
     * @throws {Error} If initialization fails
     */
    initializePaths() {
        try {
            if (!app.name) {
                const packageJson = require('../../../package.json');
                app.name = packageJson.name;
            }

            this.mode = process.env.NODE_ENV || 'development';
            log.debug(`Help CLI initialized with mode: ${this.mode}`);
        } catch (error) {
            log.error('Error initializing help paths:', error);
            throw error;
        }
    }

    /**
     * Get help-specific result object with additional fields
     * @method getHelpResultObject
     * @returns {Object} Result object with structure { help: false, manual: false, version: false, cliCommand: false }
     */
    getHelpResultObject() {
        const result = this.getBaseResultObject();
        return {
            ...result,
            version: false,
            cliCommand: false
        };
    }

    /**
     * Parse help-specific command line arguments
     * @method parseArgs
     * @override
     * @returns {Object|null} Parsed arguments or null if no help flags found
     */
    parseArgs() {
        const result = this.getHelpResultObject();

        let i = 0;
        while (i < this.args.length) {
            const arg = this.args[i];

            switch (arg) {
                case '--version': {
                    result.version = true;
                    result.cliCommand = true;
                    i++;
                    break;
                }
                case '--help': {
                    result.help = true;
                    result.cliCommand = true;
                    i++;
                    break;
                }
                case '--manual': {
                    result.manual = true;
                    result.cliCommand = true;
                    i++;
                    break;
                }
                default: {
                    i = this.parseCommonFlags(result, i);
                }
            }
        }

        // Return null if no help-specific flags found
        if (!result.version && !result.help && !result.manual) {
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
     * Execute help-specific commands based on parsed arguments
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

            if (args.version && this.commands.version) {
                this.commands.version();
                return;
            }

            if (args.help && this.commands.help) {
                this.commands.help();
                return;
            }

            if (args.manual && this.commands.manual) {
                this.commands.manual();
                return;
            }
        } catch (error) {
            log.error('Error executing help command:', error);
            throw error;
        }
    }

    /**
     * Show version and environment information
     * @method showVersion
     * @throws {Error} If version information cannot be retrieved
     */
    showVersion() {
        try {
            const packageJson = require('../../../package.json');
            console.log(`\n${packageJson.name} v${packageJson.version}`);
            console.log(`Mode: ${this.mode}`);
            console.log(`Electron: ${process.versions.electron}`);
            console.log(`Chrome: ${process.versions.chrome}`);
            console.log(`Node: ${process.versions.node}\n`);
        } catch (error) {
            log.error('Error showing version:', error);
            throw error;
        }
    }

    /**
     * Show basic usage information and available commands
     * @method showUsage
     * @override
     */
    showUsage() {
        console.log('\nHelp Commands:');
        console.log('  --help           Show this help information');
        console.log('  --manual         Show detailed manual');
        console.log('  --version        Show version information\n');
    }

    /**
     * Show detailed manual with overview and command descriptions
     * @method showManual
     */
    showManual() {
        console.log('\nApplication Manual:');
        console.log('\n1. Overview');
        console.log('   This application provides a unified interface for');
        console.log('   managing multiple messaging providers.');
        console.log('\n2. Commands');
        console.log('   --help: Show quick reference guide');
        console.log('   --manual: Show this detailed manual');
        console.log('   --version: Display version and environment info');
        console.log('\n3. Environment');
        console.log(`   Current mode: ${this.mode}`);
        console.log('   The application behavior may vary based on mode.\n');
    }
}

module.exports = HelpCLI;
