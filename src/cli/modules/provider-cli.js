/**
 * @file CLI module for managing service providers.
 * Handles provider initialization, configuration, and command execution.
 */

const BaseCLI = require('../abstract/base-cli');
const providerRegistry = require('../../providers');
const appManager = require('../../services/app.manager');
const logger = require('../../services/logging.service');

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
            const { handled, skipNext } = this.parseCommonFlags(result, i);
            if (skipNext) {
                i++;
                continue;
            }
            if (handled) {
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

        // Return null if no valid command found and not a version check
        if (!result.command && !result.version) {
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
        // Version check is always a CLI command
        if (this.currentArgs && this.currentArgs.version) {
            return true;
        }
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
            // Store current args for isCliCommand
            this.currentArgs = args;

            // Handle version flag first
            if (args.version) {
                return super.execute(args);
            }

            if (!args || !args.command || !this.commands[args.command]) {
                logger.error('No valid provider or command specified');
                return false;
            }

            logger.info(`Executing provider command: ${args.command}`);
            return await this.commands[args.command](args);
        } catch (error) {
            logger.error('Error executing provider command:', error);
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
                logger.error('No provider specified');
                return false;
            }

            logger.info(`Initializing provider: ${providerName} with profile: ${args.profile}`);
            const success = await appManager.initializeProvider(providerName, args.profile, { tray: args.tray });
            if (!success) {
                logger.error(`Failed to initialize provider: ${providerName}`);
                return false;
            }

            return true;
        } catch (error) {
            logger.error('Error initializing provider:', error);
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
        logger.info('\nAvailable providers:');
        providers.forEach(provider => {
            logger.info(`  ${provider.name} (${provider.commandArg})`);
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
        
        logger.info(`
Usage: combo-desktop [options] [command]

Commands:
  list\t\t\tList available providers
${providerList}

Options:
  --help\t\t\tShow this help message
  --manual\t\tShow detailed manual
  --version\t\tShow version information
  --tray\t\t\tStart provider in tray
  --profile <name>\tUse specific profile (default: default)
`);
    }
}

module.exports = ProviderCLI;
