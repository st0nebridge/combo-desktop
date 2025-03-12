/**
 * @file CLI module for managing service providers.
 * Handles provider initialization, configuration, and command execution.
 */

const log = require('electron-log');
const BaseCLI = require('../abstract/base-cli');
const providerRegistry = require('../../providers');
const appManager = require('../../services/app.manager');

/**
 * CLI module for managing service providers.
 * Handles:
 * - Provider initialization and configuration
 * - Command parsing and execution
 * - Provider-specific arguments
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

        /** @property {Object} commands - Map of command names to handler functions */
        this.commands = {
            'list': this.listProviders.bind(this)
        };

        // Auto-register provider commands from registry
        const providers = providerRegistry.getAvailableProviders();
        for (const provider of providers) {
            const commandName = provider.commandArg.replace(/^--/, '');
            this.commands[commandName] = this.initProvider.bind(this, commandName);
            this.commands[provider.commandArg] = this.initProvider.bind(this, commandName);
        }

        /** @property {Object|null} currentArgs - Current command arguments */
        this.currentArgs = null;
    }

    /**
     * Parse provider-specific command line arguments
     * @method parseArgs
     * @param {Array<string>} args - Command line arguments
     * @param {number} startIndex - Starting index in args array
     * @returns {Object} Parsed arguments object
     */
    parseArgs(args, startIndex = 0) {
        const result = this.getBaseResultObject();
        result.tray = false;
        result.command = null;
        result.profile = 'default';
        result.isCliCommand = true; // Default to true for utility commands

        // Handle no args case
        if (!args || args.length === 0) {
            return null;
        }

        // Process each argument
        for (let i = startIndex; i < args.length; i++) {
            const arg = args[i];
            
            // Check for base flags first
            const baseResult = this.parseCommonFlags(result, i);
            if (baseResult.skipNext) {
                i++;
                continue;
            }
            if (baseResult.handled) {
                continue;
            }

            // Handle provider-specific flags
            if (arg === '--tray') {
                result.tray = true;
                continue;
            }

            // Handle profile flag
            if (arg === '--profile') {
                if (i + 1 < args.length) {
                    result.profile = args[++i];
                }
                continue;
            }

            // Check for provider commands
            if (this.commands[arg]) {
                result.command = arg;
                // If it's a provider command (not list), it's not a CLI command
                result.isCliCommand = (arg === 'list');
                continue;
            }

            // Check for provider commands without -- prefix
            if (this.commands[`--${arg}`]) {
                result.command = `--${arg}`;
                // Provider commands are not CLI commands
                result.isCliCommand = false;
                continue;
            }
        }

        // Return null if no valid command found
        if (!result.command) {
            return null;
        }

        return result;
    }

    /**
     * Check if this is a CLI command that needs a PID
     * @method isCliCommand
     * @returns {boolean} True if this is a CLI command
     */
    isCliCommand() {
        // Get the last parsed args from execute
        return this.currentArgs ? this.currentArgs.isCliCommand : true;
    }

    /**
     * Execute provider commands based on parsed arguments
     * @method execute
     * @param {Object} args - Parsed command line arguments
     * @returns {Promise<boolean>} True if execution successful
     */
    async execute(args) {
        try {
            if (!args || !args.command || !this.commands[args.command]) {
                log.error('No valid provider or command specified');
                return false;
            }

            // Store current args for isCliCommand
            this.currentArgs = args;

            log.info(`Executing provider command: ${args.command}`);
            return await this.commands[args.command](args);
        } catch (error) {
            log.error('Error executing provider command:', error);
            return false;
        }
    }

    /**
     * Initialize a provider with specified configuration
     * @method initProvider
     * @param {string} providerName - Name of the provider to initialize
     * @param {Object} args - Provider arguments
     * @returns {Promise<boolean>} True if initialization successful
     */
    async initProvider(providerName, args) {
        try {
            if (!providerName) {
                log.error('No provider specified');
                return false;
            }

            log.info(`Initializing provider: ${providerName} with profile: ${args.profile}`);
            const success = await appManager.initializeProvider(providerName, args.profile, { tray: args.tray });
            if (!success) {
                log.error(`Failed to initialize provider: ${providerName}`);
                return false;
            }

            return true;
        } catch (error) {
            log.error('Error initializing provider:', error);
            return false;
        }
    }

    /**
     * List available providers
     * @method listProviders
     * @returns {Promise<boolean>} True if successful
     */
    async listProviders() {
        const providers = providerRegistry.getAvailableProviders();
        log.info('\nAvailable providers:');
        providers.forEach(provider => {
            log.info(`  ${provider.name} (${provider.commandArg})`);
        });
        return true;
    }

    /**
     * Show provider CLI usage
     * @method showUsage
     */
    showUsage() {
        const providers = providerRegistry.getAvailableProviders();
        const providerList = providers.map(p => `  ${p.commandArg}\t\t${p.name}`).join('\n');
        
        log.info(`
Provider Commands:
  list\t\tList available providers
${providerList}

Options:
  --profile <name>\tUse specific profile (default: default)
  --tray\t\tStart in tray
  --help\t\tShow this help
  --manual\tShow detailed manual
`);
    }
}

module.exports = ProviderCLI;
