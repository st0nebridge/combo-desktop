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

        // Define entry flag for provider commands
        this.entryFlag = 'provider';

        // Define command map according to CLI module rules
        this.commands = {
            'list': this.listProviders.bind(this),
            'status': this.getStatus.bind(this),
            'stop': this.stopProvider.bind(this),
            'restart': this.restartProvider.bind(this)
        };

        // Auto-register provider commands from registry
        const providers = providerRegistry.getAvailableProviders();
        for (const provider of providers) {
            const commandName = provider.commandArg.replace(/^--/, '');
            this.commands[commandName] = this.initProvider.bind(this, commandName);
        }
    }

    /**
     * Parse command line arguments
     * @method parseArgs
     * @param {Object} args - Command line arguments
     * @returns {Object|null} Parsed arguments or null if no provider flags found
     */
    async parseArgs(args) {
        try {
            // Check for entry flag first
            if (!args[this.entryFlag]) {
                return null;
            }

            // Get the subcommand
            const subcommand = args._[0];
            
            // Check if subcommand exists in our command map
            if (this.commands[subcommand]) {
                // Parse additional arguments
                const commandArgs = {
                    providerName: args.name,
                    profile: args.profile || 'default',
                    tray: args.tray || false,
                    options: args.options
                };

                // Validate required arguments for specific commands
                if ((subcommand === 'stop' || subcommand === 'restart') && !commandArgs.providerName) {
                    logger.error('Error: provider name is required');
                    this.showUsage();
                    return null;
                }

                return {
                    command: subcommand,
                    handler: this.commands[subcommand],
                    args: commandArgs
                };
            }

            // Check for direct provider initialization
            const providers = args._.filter(arg => this.commands[arg]);
            if (providers.length > 0) {
                const initArgs = {
                    providers,
                    profile: args.profile || 'default',
                    tray: args.tray || false,
                    options: args.options
                };

                return {
                    command: 'init',
                    handler: this.initProviders.bind(this),
                    args: initArgs
                };
            }

            // If no valid subcommand but entry flag is present, show usage
            this.showUsage();
            return null;
        } catch (error) {
            logger.error('Error parsing provider arguments:', error);
            throw error;
        }
    }

    /**
     * Execute provider commands based on parsed arguments
     * @method execute
     * @param {Object} args - Parsed command line arguments
     * @returns {Promise<boolean>} True if execution successful
     */
    async execute(args) {
        try {
            if (!args || !args.command || !args.handler) {
                return false;
            }

            // Execute the command handler with parsed arguments
            return await args.handler(args.args);
        } catch (error) {
            logger.error('Error executing provider command:', error);
            return false;
        }
    }

    /**
     * Show usage information for the provider module
     * @method showUsage
     */
    showUsage() {
        console.log(`
Provider Control Commands:
  --provider list                          List available providers
  --provider status                        Show provider status
  --provider stop --name <provider>        Stop a running provider
  --provider restart --name <provider>     Restart a running provider
  --provider <provider> [options]          Start a specific provider

Options:
  --profile <name>              Use specified profile (default: 'default')
  --tray                        Start minimized to tray
  --options <json>              Additional provider options as JSON string

Examples:
  yarn start --provider whatsapp                      Start WhatsApp with default profile
  yarn start --provider whatsapp --profile work       Start WhatsApp with work profile
  yarn start --provider list                          List available providers
  yarn start --provider status                        Show provider status
  yarn start --provider stop --name whatsapp          Stop WhatsApp provider
`);
    }

    /**
     * Initialize multiple providers
     * @method initProviders
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if all providers initialized successfully
     */
    async initProviders(args) {
        try {
            logger.info(`Initializing ${args.providers.length} providers: ${args.providers.join(', ')}`);
            
            for (const providerName of args.providers) {
                const success = await this.initProvider(providerName, args);
                if (!success) {
                    return false;
                }
            }
            return true;
        } catch (error) {
            logger.error('Error initializing providers:', error);
            return false;
        }
    }

    /**
     * Initialize a provider with proper error handling
     * @method initProvider
     * @param {string} providerName - Name of the provider to initialize
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if provider initialized successfully
     */
    async initProvider(providerName, args) {
        try {
            logger.info(`Initializing provider: ${providerName}`);
            const provider = providerRegistry.getProvider(providerName);
            
            if (!provider) {
                logger.error(`Provider not found: ${providerName}`);
                return false;
            }

            await appManager.initProvider(provider, {
                profile: args.profile,
                tray: args.tray,
                options: args.options
            });

            logger.info(`Successfully initialized provider: ${providerName}`);
            return true;
        } catch (error) {
            logger.error(`Error initializing provider ${providerName}:`, error);
            return false;
        }
    }

    /**
     * List available providers
     * @method listProviders
     * @returns {Promise<boolean>} True if listing successful
     */
    async listProviders() {
        try {
            const providers = providerRegistry.getAvailableProviders();
            if (!providers || providers.length === 0) {
                console.log('\nNo providers available.\n');
                return true;
            }

            console.log('\nAvailable Providers:');
            providers.forEach(provider => {
                console.log(`  - ${provider.name}`);
                if (provider.description) {
                    console.log(`    ${provider.description}`);
                }
            });
            console.log();
            return true;
        } catch (error) {
            logger.error('Error listing providers:', error);
            return false;
        }
    }

    /**
     * Get status of running providers
     * @method getStatus
     * @returns {Promise<boolean>} True if status check successful
     */
    async getStatus() {
        try {
            const status = await appManager.getProvidersStatus();
            if (!status || Object.keys(status).length === 0) {
                console.log('\nNo active providers.\n');
                return true;
            }

            console.log('\nProvider Status:');
            Object.entries(status).forEach(([provider, info]) => {
                console.log(`  ${provider}:`);
                console.log(`    Status: ${info.status}`);
                console.log(`    Profile: ${info.profile}`);
                if (info.error) {
                    console.log(`    Error: ${info.error}`);
                }
            });
            console.log();
            return true;
        } catch (error) {
            logger.error('Error getting provider status:', error);
            return false;
        }
    }

    /**
     * Stop a running provider
     * @method stopProvider
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if provider stopped successfully
     */
    async stopProvider(args) {
        try {
            const { providerName } = args;
            await appManager.stopProvider(providerName);
            console.log(`Successfully stopped provider: ${providerName}`);
            return true;
        } catch (error) {
            logger.error('Error stopping provider:', error);
            return false;
        }
    }

    /**
     * Restart a running provider
     * @method restartProvider
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if provider restarted successfully
     */
    async restartProvider(args) {
        try {
            const { providerName } = args;
            await appManager.restartProvider(providerName);
            console.log(`Successfully restarted provider: ${providerName}`);
            return true;
        } catch (error) {
            logger.error('Error restarting provider:', error);
            return false;
        }
    }
}

module.exports = ProviderCLI;
