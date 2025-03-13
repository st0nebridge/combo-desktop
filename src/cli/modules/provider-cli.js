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
            const commandName = provider.commandArg.startsWith('--') ? 
                provider.commandArg : `--${provider.commandArg}`;
            const cleanName = commandName.replace(/^--/, '');
            
            // Register both with and without -- prefix for flexibility
            this.commands[cleanName] = this.initProvider.bind(this, cleanName);
            this.commands[commandName] = this.initProvider.bind(this, cleanName);
        }

        /** @property {Object|null} currentArgs - Current command arguments */
        this.currentArgs = null;
    }

    /**
     * Parse command line arguments
     * @method parseArgs
     * @param {Array} args - Command line arguments
     * @returns {Object|null} Parsed arguments or null if no match
     */
    parseArgs(args) {
        if (!args || args.length === 0) {
            return null;
        }

        const result = {
            providers: [],
            command: null,
            profile: null,
            tray: true,
            version: false,
            isCliCommand: true
        };

        // Log the arguments we're parsing
        logger.debug(`ProviderCLI parsing arguments: ${JSON.stringify(args)}`);

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];

            // Skip empty arguments
            if (!arg) {
                continue;
            }

            // Handle version flag
            if (arg === '--version' || arg === '-v') {
                result.version = true;
                continue;
            }

            // Handle --no-tray flag
            if (arg === '--no-tray') {
                result.tray = false;
                continue;
            }

            // Handle --profile flag
            if (arg === '--profile' || arg === '-p') {
                if (i + 1 < args.length) {
                    result.profile = args[++i];
                }
                continue;
            }

            // Check for provider commands with -- prefix
            const argWithPrefix = arg.startsWith('--') ? arg : `--${arg}`;
            const cleanArg = arg.replace(/^--/, '');
            
            // Check if this is a provider command (either with or without -- prefix)
            if ((this.commands[arg] || this.commands[argWithPrefix]) && cleanArg !== 'list') {
                // If it's a provider command, add it to the providers array
                logger.debug(`Found provider command: ${cleanArg}`);
                result.providers.push(cleanArg);
                result.isCliCommand = false;
                continue;
            }

            // Handle list command separately
            if (arg === 'list' || arg === '--list') {
                result.command = 'list';
                result.isCliCommand = true;
                continue;
            }
        }

        // Return null if no valid providers or commands found
        if (result.providers.length === 0 && !result.command && !result.version) {
            logger.debug('No valid providers or commands found in arguments');
            return null;
        }

        logger.debug(`Parsed provider arguments: ${JSON.stringify(result)}`);
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
     * Initialize a provider with proper error handling
     * @method initProvider
     * @param {string} providerName - Name of the provider to initialize
     * @param {Object} args - Command line arguments
     * @returns {Promise<boolean>} True if initialization successful
     * @private
     */
    async initProvider(providerName, args) {
        try {
            logger.info(`Initializing provider: ${providerName}`);
            
            // Get the provider instance
            const provider = providerRegistry.getProvider(providerName);
            if (!provider) {
                logger.error(`Provider not found: ${providerName}`);
                return false;
            }
            
            // Initialize the provider
            const profileName = args.profile || 'default';
            logger.info(`Starting initialization of ${provider.getName()} with profile ${profileName}`);
            
            const result = await appManager.initializeProvider(providerName, profileName, { 
                tray: args.tray 
            });
            
            if (result) {
                logger.info(`Provider ${providerName} initialized successfully`);
                return true;
            } else {
                logger.error(`Provider ${providerName} failed to initialize`);
                return false;
            }
        } catch (error) {
            logger.error(`Error initializing provider ${providerName}:`, error);
            return false;
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
            // Store current args for isCliCommand
            this.currentArgs = args;

            // Handle version flag first
            if (args.version) {
                return super.execute(args);
            }

            // Handle list command
            if (args.command === 'list' && this.commands.list) {
                return await this.commands.list(args);
            }

            // Handle provider initialization
            if (args.providers && args.providers.length > 0) {
                logger.info(`Initializing ${args.providers.length} providers: ${args.providers.join(', ')}`);
                
                // Process each provider separately
                for (const providerName of args.providers) {
                    try {
                        // Get the provider instance
                        const provider = providerRegistry.getProvider(providerName);
                        if (!provider) {
                            logger.error(`Provider not found: ${providerName}`);
                            continue;
                        }
                        
                        const profileName = args.profile || 'default';
                        logger.info(`Starting initialization for provider: ${provider.getName()} with profile: ${profileName}`);
                        
                        // Start initialization without waiting for it to complete
                        // This allows the app to continue running while providers initialize
                        this.startProviderInitialization(providerName, profileName, args.tray);
                    } catch (error) {
                        logger.error(`Error starting provider ${providerName}:`, error);
                    }
                }
                
                // Return true to indicate we've started the initialization process
                return true;
            }

            logger.error('No valid provider or command specified');
            return false;
        } catch (error) {
            logger.error('Error executing provider command:', error);
            return false;
        }
    }

    /**
     * Start provider initialization without waiting for it to complete
     * @method startProviderInitialization
     * @param {string} providerName - Name of the provider to initialize
     * @param {string} profileName - Profile name
     * @param {boolean} useTray - Whether to use tray icon
     * @private
     */
    startProviderInitialization(providerName, profileName, useTray) {
        // Start the initialization process in the background immediately
        // No delay between providers - all start concurrently
        logger.info(`Starting immediate initialization of ${providerName}`);
        
        setTimeout(() => {
            appManager.initializeProvider(providerName, profileName, { tray: useTray })
                .then(result => {
                    if (result) {
                        logger.info(`Provider ${providerName} initialized successfully`);
                    } else {
                        logger.error(`Provider ${providerName} failed to initialize`);
                    }
                })
                .catch(error => {
                    logger.error(`Error initializing provider ${providerName}:`, error);
                });
        }, 0);
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
  --tray\t\t\tStart with window hidden (minimized to tray)
  --profile <name>\tUse specific profile (default: default)

Note: All provider sessions will have a tray icon for quick access.
      Close button will hide window to tray instead of quitting.
      Click tray icon to toggle window visibility.
      Use 'Quit' from tray menu to fully close the application.
`);
    }
}

module.exports = ProviderCLI;
