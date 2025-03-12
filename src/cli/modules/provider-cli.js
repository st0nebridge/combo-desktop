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
            'list': this.listProviders.bind(this),
            'init': this.initProvider.bind(this),
            'whatsapp': this.initWhatsApp.bind(this),
            'facebook': this.initFacebook.bind(this)
        };

        /** @property {Object} commandAliases - Map of command aliases to actual command names */
        this.commandAliases = {
            '--whatsapp': 'whatsapp',
            '--facebook': 'facebook'
        };
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

            // Check for provider commands and aliases
            if (this.commands[arg]) {
                result.command = arg;
                continue;
            }

            if (this.commandAliases[arg]) {
                result.command = this.commandAliases[arg];
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
        return false;
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

            log.info(`Executing provider command: ${args.command}`);
            return await this.commands[args.command](args);
        } catch (error) {
            log.error('Error executing provider command:', error);
            return false;
        }
    }

    /**
     * Initialize WhatsApp provider
     * @method initWhatsApp
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if initialization successful
     */
    async initWhatsApp(args) {
        log.info('Initializing WhatsApp provider');
        return await this.initProvider({
            provider: 'whatsapp',
            profile: args.profile,
            tray: args.tray
        });
    }

    /**
     * Initialize Facebook provider
     * @method initFacebook
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if initialization successful
     */
    async initFacebook(args) {
        log.info('Initializing Facebook provider');
        return await this.initProvider({
            provider: 'facebook',
            profile: args.profile,
            tray: args.tray
        });
    }

    /**
     * Initialize a provider with specified configuration
     * @method initProvider
     * @param {Object} args - Provider arguments
     * @returns {Promise<boolean>} True if initialization successful
     */
    async initProvider(args) {
        try {
            const { provider, profile, tray } = args;
            if (!provider) {
                log.error('No provider specified');
                return false;
            }

            log.info(`Initializing provider: ${provider} with profile: ${profile}`);
            const success = await appManager.initializeProvider(provider, profile, { tray });
            if (!success) {
                log.error(`Failed to initialize provider: ${provider}`);
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
        try {
            const providers = providerRegistry.getAvailableProviders();
            if (providers.length === 0) {
                log.info('No providers available');
                return true;
            }

            log.info('Available providers:');
            providers.forEach(({ name, commandArg }) => {
                log.info(`  ${name} (${commandArg})`);
            });

            return true;
        } catch (error) {
            log.error('Error listing providers:', error);
            return false;
        }
    }

    /**
     * Show provider CLI usage information
     * @method showUsage
     */
    showUsage() {
        const usage = `
Provider CLI Usage:
  yarn whatsapp           Launch WhatsApp provider
  yarn facebook          Launch Facebook provider
  yarn whatsapp --tray   Launch WhatsApp with tray icon
  yarn facebook --tray   Launch Facebook with tray icon
  yarn provider list     List available providers

Options:
  --profile <name>      Use specific profile (default: 'default')
  --tray               Create tray icon for provider
`;
        log.info(usage);
    }
}

module.exports = ProviderCLI;
