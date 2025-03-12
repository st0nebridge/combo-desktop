/**
 * @module ProviderCLI
 * @description CLI module for managing service providers and their configuration.
 * Handles provider initialization, configuration, and instance management.
 */

const BaseCLI = require('../abstract/base-cli');
const log = require('electron-log');
const { app } = require('electron');
const path = require('path');

/**
 * CLI module for managing service providers.
 * Extends BaseCLI to provide provider-specific functionality:
 * - Provider initialization and configuration
 * - Profile management for providers
 * - Instance control
 * @class ProviderCLI
 * @extends {BaseCLI}
 */
class ProviderCLI extends BaseCLI {
    /**
     * Creates a new ProviderCLI instance
     * @constructor
     */
    constructor() {
        super();
        
        /** @property {Array<string>} moduleFlags - Supported command flags */
        this.moduleFlags = [
            '--whatsapp',
            '--facebook'
        ];

        // Bind command functions using .bind() pattern for command mapping
        /** @property {Object} commands - Map of provider names to initialization functions */
        this.commands = {
            'whatsapp': this.initProvider.bind(this, 'whatsapp'),
            'facebook': this.initProvider.bind(this, 'facebook')
        };
    }

    /**
     * Get provider-specific result object with additional fields
     * @method getProviderResultObject
     * @returns {Object} Result object with structure { help: false, manual: false, config: null, profile: null, providers: [], newInstance: false, oneInstance: false, resetLock: false, cliCommand: false }
     */
    getProviderResultObject() {
        const result = this.getBaseResultObject();
        return {
            ...result,
            config: null,
            profile: null,
            providers: [],
            newInstance: false,
            oneInstance: false,
            resetLock: false,
            cliCommand: false
        };
    }

    /**
     * Parse provider-specific command line arguments
     * @method parseArgs
     * @override
     * @returns {Object|null} Parsed arguments or null if no provider flags found
     */
    parseArgs() {
        const result = this.getProviderResultObject();

        let i = 0;
        while (i < this.args.length) {
            const arg = this.args[i];

            // Handle provider commands
            if (arg === '--whatsapp' || arg === '--facebook') {
                let profile = null;
                if (i + 1 < this.args.length && !this.args[i + 1].startsWith('--')) {
                    profile = this.args[i + 1];
                    i += 2;
                } else {
                    i++;
                }
                result.providers.push({ provider: arg.slice(2), profile });
                continue;
            }

            // Handle instance flags
            if (arg === '--new-instance') {
                result.newInstance = true;
                i++;
                continue;
            }

            if (arg === '--one-instance') {
                result.oneInstance = true;
                i++;
                continue;
            }

            if (arg === '--reset-lock') {
                result.resetLock = true;
                result.cliCommand = true;
                i++;
                continue;
            }

            // Handle config flag
            if (arg === '--config') {
                if (i + 1 < this.args.length && !this.args[i + 1].startsWith('--')) {
                    result.config = this.args[i + 1];
                    i += 2;
                    continue;
                }
                i++;
                continue;
            }

            // Handle profile flag
            if (arg === '--profile') {
                if (i + 1 < this.args.length && !this.args[i + 1].startsWith('--')) {
                    result.profile = this.args[i + 1];
                    i += 2;
                    continue;
                }
                i++;
                continue;
            }

            // Use common flag parsing
            i = this.parseCommonFlags(result, i);
        }

        // Return null if no providers or special flags found
        if (result.providers.length === 0 && 
            !result.newInstance && 
            !result.oneInstance && 
            !result.resetLock && 
            !result.help && 
            !result.manual) {
            return null;
        }

        return result;
    }

    /**
     * Initialize a provider with optional profile
     * @method initProvider
     * @param {string} provider - Provider name (e.g., 'whatsapp', 'facebook')
     * @param {string} [profile] - Optional profile name
     * @throws {Error} If provider initialization fails
     */
    initProvider(provider, profile) {
        log.info(`Initializing provider ${provider}${profile ? ` with profile ${profile}` : ''}`);
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
     * Execute provider-specific commands based on parsed arguments
     * @method execute
     * @override
     * @param {Object} args - Parsed arguments from parseArgs()
     * @throws {Error} If command execution fails or config validation fails
     */
    execute(args) {
        if (!args) {
            return;
        }

        // Show help if requested
        if (args.help) {
            this.showUsage();
            return;
        }

        // Show manual if requested
        if (args.manual) {
            this.showManual();
            return;
        }

        // Validate config file if specified
        if (args.config) {
            this.validateFilePath(args.config);
        }

        // Execute provider commands
        for (const { provider, profile } of args.providers) {
            if (this.commands[provider]) {
                this.commands[provider](profile);
            }
        }

        // Log other flags
        if (args.newInstance) {
            log.info('Forcing new instance');
        }
        if (args.oneInstance) {
            log.info('Enforcing single instance');
        }
        if (args.resetLock) {
            log.info('Resetting instance lock');
        }
    }

    /**
     * Show basic usage information and available commands
     * @method showUsage
     * @override
     */
    showUsage() {
        console.log('\nProvider CLI Usage:');
        console.log('  --whatsapp [profile]    Start WhatsApp with optional profile');
        console.log('  --facebook [profile]    Start Facebook with optional profile');
        console.log('\nConfiguration Options:');
        console.log('  --config <path>         Use specific configuration file');
        console.log('  --profile <name>        Use specific profile');
        console.log('\nInstance Options:');
        console.log('  --new-instance          Force new instance');
        console.log('  --one-instance          Allow only one instance');
        console.log('  --reset-lock            Reset instance lock');
        console.log('\nHelp Options:');
        console.log('  --help                  Show help information');
        console.log('  --manual                Show detailed manual\n');
    }

    /**
     * Show detailed manual with provider configuration information
     * @method showManual
     * @override
     */
    showManual() {
        console.log('\nProvider CLI Manual:');
        console.log('\n1. Providers');
        console.log('   Use --whatsapp or --facebook to start specific providers');
        console.log('   Optionally specify a profile name after the provider flag');
        console.log('\n2. Configuration');
        console.log('   Use --config to specify a custom config file');
        console.log('   Use --profile to specify a named profile');
        console.log('\n3. Instance Management');
        console.log('   Use --new-instance to force a new instance');
        console.log('   Use --one-instance to allow only one instance');
        console.log('   Use --reset-lock to reset instance lock\n');
    }
}

module.exports = ProviderCLI;
