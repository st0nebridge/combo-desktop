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

        /** @property {Array<string>} moduleFlags - List of module-specific flags */
        this.moduleFlags = ['--provider'];

        /** @property {Object|null} currentArgs - Current command arguments */
        this.currentArgs = null;
    }

    /**
     * Parse command line arguments
     * @method parseArgs
     * @param {Array<string>} args - Command line arguments
     * @returns {Object} Parsed arguments
     */
    parseArgs(args) {
        if (!args || args.length === 0) {
            return null;
        }

        const result = this.getBaseResultObject();
        result.providers = [];
        result.providerProfiles = {};
        result.command = null;
        result.tray = false;
        result.profile = 'default';

        // Parse common flags first
        for (let i = 0; i < args.length; i++) {
            const { handled, skipNext } = this.parseCommonFlags(result, i);
            if (handled) {
                if (skipNext) {
                    i++;
                }
                continue;
            }

            const arg = args[i];
            const cleanArg = arg.replace(/^--/, '');

            // Check for command
            if (this.commands[cleanArg]) {
                result.command = cleanArg;
                continue;
            }

            // Check for tray mode
            if (arg === '--tray') {
                result.tray = true;
                continue;
            }

            // Check for profile flag
            if (arg === '--profile' && i + 1 < args.length) {
                result.profile = args[++i];
                continue;
            }

            // Check for provider flags
            if (this.commands[cleanArg] && cleanArg !== 'list') {
                // Check if the next argument is a profile specification
                if (i + 2 < args.length && args[i + 1] === '--profile') {
                    const profileName = args[i + 2];
                    result.providers.push(cleanArg);
                    result.providerProfiles[cleanArg] = profileName;
                    i += 2;
                } else {
                    result.providers.push(cleanArg);
                    result.providerProfiles[cleanArg] = result.profile;
                }
            }
        }

        return result.providers.length > 0 || result.command || result.help || result.version ? result : null;
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

            // Handle common flags first
            if (args.help) {
                this.showUsage();
                return true;
            }

            if (args.version) {
                return super.execute(args);
            }

            // Handle command if present
            if (args.command && this.commands[args.command]) {
                return await this.commands[args.command](args);
            }

            // Handle provider initialization
            if (args.providers && args.providers.length > 0) {
                logger.info(`Initializing ${args.providers.length} providers: ${args.providers.join(', ')}`);
                
                // Initialize each provider with its profile
                for (const providerName of args.providers) {
                    const profileName = args.providerProfiles[providerName] || args.profile;
                    const success = await this.initProvider(providerName, { ...args, profile: profileName });
                    if (!success) {
                        return false;
                    }
                }
                return true;
            }

            // No valid command or providers found
            this.showUsage();
            return false;
        } catch (error) {
            logger.error('Error executing provider command:', error);
            this.showUsage();
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
  --whatsapp [--profile <name>]    Start WhatsApp provider with optional profile
  --facebook [--profile <name>]    Start Facebook provider with optional profile
  list                            List available providers
  status                          Show provider status
  stop <provider>                 Stop a running provider
  restart <provider>              Restart a running provider

Options:
  --tray                          Start minimized to tray
  --profile <name>                Use specified profile (default: 'default')
  --help                          Show this help information
  --version                       Show version information

Examples:
  yarn start --whatsapp                     Start WhatsApp with default profile
  yarn start --whatsapp --profile work      Start WhatsApp with work profile
  yarn start --whatsapp --facebook          Start both providers with default profile
  yarn start list                           List available providers
  yarn start status                         Show provider status
`);
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
     * Start provider initialization without waiting for it to complete
     * @method startProviderInitialization
     * @param {string} providerName - Name of the provider to initialize
     * @param {string} profileName - Profile name
     * @param {boolean} useTray - Whether to use tray icon
     * @private
     */
    startProviderInitialization(providerName, profileName, useTray) {
        // Get the provider instance to check if it's valid
        const provider = providerRegistry.getProvider(providerName);
        if (!provider) {
            logger.error(`Provider not found: ${providerName}`);
            return;
        }
        
        const providerDisplayName = provider.getName();
        const sessionKey = `${providerDisplayName}:${profileName}`;
        
        // Check if session already exists in instance manager
        const instanceManager = require('../../services/instance.manager');
        if (instanceManager.hasSession(sessionKey)) {
            logger.info(`Session ${sessionKey} already exists, skipping initialization`);
            
            // Check if window exists and show it if needed
            const windowService = require('../../services/window.service');
            const windowName = sessionKey;
            const { window: existingWindow } = windowService.resolveWindow(windowName);
            
            if (existingWindow && !existingWindow.isDestroyed() && !existingWindow.isVisible()) {
                logger.info(`Window ${windowName} already exists, showing without focus...`);
                existingWindow.show();
            }
            
            return;
        }
        
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
     * Get the base result object for parsing command line arguments
     * @method getBaseResultObject
     * @returns {Object} Base result object
     */
    getBaseResultObject() {
        return {
            providers: [],
            providerProfiles: {}, // Map of provider to profile
            command: null,
            tray: false,
            profile: 'default',
            version: false,
            help: false
        };
    }

    /**
     * Parse common flags from command line arguments
     * @method parseCommonFlags
     * @param {Object} result - Parsed arguments
     * @param {number} index - Current index in the arguments array
     * @returns {Object} Object with handled and skipNext properties
     */
    parseCommonFlags(result, index) {
        const arg = result.args[index];
        if (arg === '--help') {
            result.help = true;
            return { handled: true, skipNext: false };
        }
        if (arg === '--version') {
            result.version = true;
            return { handled: true, skipNext: false };
        }
        return { handled: false, skipNext: false };
    }

    /**
     * Get the status of a provider
     * @method getStatus
     * @param {Object} args - Command line arguments
     * @returns {Promise<boolean>} True if successful
     */
    async getStatus(args) {
        // TO DO: Implement getStatus logic
        return true;
    }

    /**
     * Stop a running provider
     * @method stopProvider
     * @param {Object} args - Command line arguments
     * @returns {Promise<boolean>} True if successful
     */
    async stopProvider(args) {
        // TO DO: Implement stopProvider logic
        return true;
    }

    /**
     * Restart a running provider
     * @method restartProvider
     * @param {Object} args - Command line arguments
     * @returns {Promise<boolean>} True if successful
     */
    async restartProvider(args) {
        // TO DO: Implement restartProvider logic
        return true;
    }
}

module.exports = ProviderCLI;
