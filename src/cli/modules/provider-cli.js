/**
 * @file CLI module for managing service providers.
 * Handles provider initialization, configuration, and command execution.
 */

const BaseCLI = require('../abstract/base-cli');
const providerRegistry = require('../../providers');
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

        // Define module-specific flags
        this.moduleFlags = ['--provider'];
        
        // Add provider-specific flags
        const providers = providerRegistry.getAvailableProviders();
        for (const provider of providers) {
            if (provider.commandArg) {
                this.moduleFlags.push(provider.commandArg);
            }
        }

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
        for (const provider of providers) {
            if (provider.commandArg) {
                const commandName = provider.commandArg.replace(/^--/, '');
                this.commands[commandName] = this.initProvider.bind(this, commandName);
            }
        }
    }

    /**
     * Check if this module can handle the given arguments
     * @method canHandle
     * @param {Array<string>} args - Command line arguments
     * @returns {boolean} True if module can handle these arguments
     */
    canHandle(args) {
        try {
            if (!args || args.length === 0) {
                return false;
            }
            
            // Check for --provider flag
            if (args.includes('--provider')) {
                return true;
            }
            
            // Check for provider-specific flags
            const providers = providerRegistry.getAvailableProviders();
            for (const provider of providers) {
                if (provider.commandArg && args.includes(provider.commandArg)) {
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            logger.error('Error checking if provider module can handle arguments:', error);
            return false;
        }
    }

    /**
     * Parse command line arguments
     * @method parseArgs
     * @param {Array<string>} args - Command line arguments
     * @returns {Object} Parsed arguments
     */
    parseArgs(args) {
        try {
            // Initialize result object
            const result = this.getBaseResultObject();
            result.providers = [];
            
            // Parse common flags
            this.parseCommonFlags(args, result);
            
            // Check for direct provider flags
            const providers = providerRegistry.getAvailableProviders();
            for (const provider of providers) {
                if (provider.commandArg && args.includes(provider.commandArg)) {
                    const providerName = provider.commandArg.replace(/^--/, '');
                    result.providers.push(providerName);
                    
                    // Check for profile flag
                    const profileIndex = args.indexOf('--profile');
                    if (profileIndex !== -1 && profileIndex + 1 < args.length) {
                        result.profile = args[profileIndex + 1];
                    } else {
                        result.profile = 'default';
                    }
                    
                    // Check for tray flag
                    result.tray = args.includes('--tray');
                    
                    // Check for options flag
                    const optionsIndex = args.indexOf('--options');
                    if (optionsIndex !== -1 && optionsIndex + 1 < args.length) {
                        try {
                            result.options = JSON.parse(args[optionsIndex + 1]);
                        } catch (error) {
                            logger.error('Error parsing options JSON:', error);
                            result.options = {};
                        }
                    }
                }
            }
            
            // Check for --provider command format
            const providerIndex = args.indexOf('--provider');
            if (providerIndex !== -1) {
                // Get the subcommand (next argument after --provider)
                const subcommandIndex = providerIndex + 1;
                if (subcommandIndex < args.length) {
                    const subcommand = args[subcommandIndex];
                    
                    // Check if subcommand exists in our command map
                    if (this.commands[subcommand]) {
                        result.command = subcommand;
                        
                        // Parse additional arguments based on the command
                        if (subcommand === 'stop' || subcommand === 'restart') {
                            const nameIndex = args.indexOf('--name');
                            if (nameIndex !== -1 && nameIndex + 1 < args.length) {
                                result.providerName = args[nameIndex + 1];
                            }
                        }
                    }
                }
            }
            
            return result;
        } catch (error) {
            logger.error('Error parsing provider arguments:', error);
            return this.getBaseResultObject();
        }
    }

    /**
     * Check if this is a CLI command that shouldn't register a PID
     * @method isCliCommand
     * @returns {boolean} True if this is a CLI command
     */
    isCliCommand() {
        // Provider commands that don't start a provider are CLI commands
        // Provider initialization commands are not CLI commands
        return true;
    }

    /**
     * Execute provider commands based on parsed arguments
     * @method execute
     * @param {Array<string>} args - Command line arguments
     * @param {Object} context - Execution context
     * @returns {Promise<{success: boolean, isCliCommand: boolean, processedProviders: Array<string>, context: Object, continueExecution: boolean}>} Execution result
     */
    async execute(args, context = {}) {
        try {
            // Parse the arguments
            const parsedArgs = this.parseArgs(args);
            
            // Handle common flags first
            if (parsedArgs.help) {
                this.showUsage();
                return {
                    success: true,
                    isCliCommand: true,
                    processedProviders: [],
                    context,
                    continueExecution: false
                };
            }
            
            if (parsedArgs.version) {
                this.showVersion();
                return {
                    success: true,
                    isCliCommand: true,
                    processedProviders: [],
                    context,
                    continueExecution: false
                };
            }
            
            // Handle provider initialization
            if (parsedArgs.providers && parsedArgs.providers.length > 0) {
                const result = await this.initProviders(parsedArgs);
                return {
                    success: result,
                    isCliCommand: false,
                    processedProviders: parsedArgs.providers,
                    context,
                    continueExecution: true
                };
            }
            
            // Handle command execution
            if (parsedArgs.command) {
                const handler = this.commands[parsedArgs.command];
                if (handler) {
                    const result = await handler(parsedArgs);
                    return {
                        success: result,
                        isCliCommand: true,
                        processedProviders: [],
                        context,
                        continueExecution: false
                    };
                }
            }
            
            // If we're handling this request but no valid command found, show usage
            if (this.canHandle(args)) {
                logger.warn('No valid provider command found');
                this.showUsage();
                return {
                    success: true,
                    isCliCommand: true,
                    processedProviders: [],
                    context,
                    continueExecution: false
                };
            }
            
            // Let other modules handle it
            return {
                success: false,
                isCliCommand: false,
                processedProviders: [],
                context,
                continueExecution: true
            };
        } catch (error) {
            logger.error('Error executing provider command:', error);
            return {
                success: false,
                isCliCommand: false,
                processedProviders: [],
                context,
                continueExecution: true
            };
        }
    }

    /**
     * Show usage information for the provider module
     * @method showUsage
     */
    showUsage() {
        console.log(`
Provider Management Commands:
  --provider list                          List available providers
  --provider status                        Show provider status
  --provider stop --name <provider>        Stop a running provider
  --provider restart --name <provider>     Restart a running provider
  --<provider> [options]                   Start a specific provider

Provider Options:
  --profile <name>                         Use specific profile
  --tray                                   Start in tray mode
  --options <json>                         Provider-specific options as JSON

Examples:
  yarn start --provider list               List all available providers
  yarn start --whatsapp --profile work     Start WhatsApp with work profile
  yarn start --provider stop --name whatsapp Stop WhatsApp provider
`);
    }

    /**
     * List all available providers
     * @method listProviders
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if providers listed successfully
     */
    async listProviders(args) {
        try {
            const providers = providerRegistry.getAvailableProviders();
            
            if (providers.length === 0) {
                console.log('No providers available.');
                return true;
            }
            
            console.log('Available providers:');
            providers.forEach((provider, index) => {
                console.log(`[${index + 1}] ${provider.name} (${provider.id})`);
                console.log(`    Command: ${provider.commandArg || 'N/A'}`);
                console.log(`    Description: ${provider.description || 'No description'}`);
                console.log('');
            });
            
            return true;
        } catch (error) {
            logger.error('Error listing providers:', error);
            return false;
        }
    }

    /**
     * Get status of all providers
     * @method getStatus
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if status retrieved successfully
     */
    async getStatus(args) {
        try {
            const status = await providerRegistry.getStatus();
            
            console.log('Provider Status:');
            
            if (!status || Object.keys(status).length === 0) {
                console.log('  No active providers');
                return true;
            }
            
            for (const [providerId, providerStatus] of Object.entries(status)) {
                console.log(`  ${providerId}:`);
                console.log(`    Running: ${providerStatus.running}`);
                console.log(`    Status: ${providerStatus.status}`);
                console.log(`    Profiles: ${providerStatus.profiles.join(', ')}`);
                console.log('');
            }
            
            return true;
        } catch (error) {
            logger.error('Error getting provider status:', error);
            return false;
        }
    }

    /**
     * Stop a specific provider
     * @method stopProvider
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if provider stopped successfully
     */
    async stopProvider(args) {
        try {
            if (!args.providerName) {
                console.log('Error: Provider name is required');
                this.showUsage();
                return false;
            }
            
            const result = await providerRegistry.stopProvider(args.providerName);
            
            if (result) {
                console.log(`Provider ${args.providerName} stopped successfully.`);
                return true;
            } else {
                console.log(`Failed to stop provider ${args.providerName}.`);
                return false;
            }
        } catch (error) {
            logger.error('Error stopping provider:', error);
            return false;
        }
    }

    /**
     * Restart a specific provider
     * @method restartProvider
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if provider restarted successfully
     */
    async restartProvider(args) {
        try {
            if (!args.providerName) {
                console.log('Error: Provider name is required');
                this.showUsage();
                return false;
            }
            
            const result = await providerRegistry.restartProvider(args.providerName);
            
            if (result) {
                console.log(`Provider ${args.providerName} restarted successfully.`);
                return true;
            } else {
                console.log(`Failed to restart provider ${args.providerName}.`);
                return false;
            }
        } catch (error) {
            logger.error('Error restarting provider:', error);
            return false;
        }
    }

    /**
     * Initialize a specific provider
     * @method initProvider
     * @param {string} providerName - Name of the provider to initialize
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if provider initialized successfully
     */
    async initProvider(providerName, args) {
        try {
            logger.info(`Initializing provider: ${providerName}`);
            
            // Get provider configuration
            const config = {
                profile: args.profile || 'default',
                tray: args.tray || false,
                options: args.options || {}
            };
            
            // Initialize the provider
            const result = await providerRegistry.initializeProvider(providerName, config);
            
            if (result) {
                logger.info(`Provider ${providerName} initialized successfully.`);
                return true;
            } else {
                logger.error(`Failed to initialize provider ${providerName}.`);
                return false;
            }
        } catch (error) {
            logger.error(`Error initializing provider ${providerName}:`, error);
            return false;
        }
    }

    /**
     * Initialize multiple providers
     * @method initProviders
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if all providers initialized successfully
     */
    async initProviders(args) {
        try {
            if (!args.providers || args.providers.length === 0) {
                return false;
            }
            
            let allSuccess = true;
            
            for (const providerName of args.providers) {
                const success = await this.initProvider(providerName, args);
                allSuccess = allSuccess && success;
            }
            
            return allSuccess;
        } catch (error) {
            logger.error('Error initializing providers:', error);
            return false;
        }
    }
}

module.exports = ProviderCLI;
