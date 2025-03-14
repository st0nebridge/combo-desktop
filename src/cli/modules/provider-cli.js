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
            'list': this.listProviders.bind(this)
        };
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

            for (const flag of this.moduleFlags) {
                if (args.includes(flag)) {
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
            
            // Check for --provider flag and commands
            const providerIndex = args.indexOf('--provider');
            if (providerIndex !== -1 && providerIndex + 1 < args.length) {
                const command = args[providerIndex + 1];
                if (command === 'list') {
                    result.command = 'list';
                }
            }
            
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
     * @returns {Promise<{success: boolean, context: Object, continueExecution: boolean, provider: string}>} Execution result
     */
    async execute(args, context = {}) {
        try {
            // Parse the arguments
            const parsedArgs = this.parseArgs(args);

            context.providers = parsedArgs.providers;
            
            // Handle common flags first
            if (parsedArgs.help) {
                this.showUsage();
                return {
                    success: true,
                    context,
                    continueExecution: false
                };
            }
            
            if (parsedArgs.version) {
                this.showVersion();
                return {
                    success: true,
                    context,
                    continueExecution: false
                };
            }
            
            // Handle command execution
            if (parsedArgs.command) {
                const handler = this.commands[parsedArgs.command];
                if (handler) {
                    const result = await handler(parsedArgs);
                    return {
                        success: result,
                        context,
                        continueExecution: false
                    };
                }
            }
            
            // If we're handling this request but no valid command found, show usage
            if (this.canHandle(args)) {
                // Check for provider args
                const providerArgs = this.moduleFlags.filter(key => args.includes(key));
                if (providerArgs.length > 0) {
                    return {
                        success: true,
                        context: {
                            ...context,
                            providers: providerArgs
                        },
                        continueExecution: true
                    };
                }

                logger.warn('No valid provider command found');
                this.showUsage();
                return {
                    success: true,
                    context,
                    continueExecution: false
                };
            }
            
            // Let other modules handle it
            return {
                success: false,
                context,
                continueExecution: true
            };
        } catch (error) {
            logger.error('Error executing provider command:', error);
            return {
                success: false,
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
  --<provider> [options]                   Start a specific provider

Provider Options:
  --profile <name>                         Use specific profile
  --tray                                   Start in tray mode
  --options <json>                         Provider-specific options as JSON

Examples:
  yarn start --provider list               List all available providers
  yarn start --whatsapp --profile work     Start WhatsApp with work profile
`);
    }

    /**
     * Show detailed manual for the provider module
     * @method showManual
     */
    showManual() {
        console.log(`
Provider Management Module Manual
================================

DESCRIPTION
-----------
The Provider Management module handles service provider initialization, configuration, 
and command execution. It allows users to list available providers and start specific 
providers with various configuration options.

COMMANDS
--------
--provider list                          List all available providers
--<provider> [options]                   Start a specific provider

OPTIONS
-------
--profile <name>                         Use specific profile configuration
--tray                                   Start in tray mode (minimized)
--options <json>                         Provider-specific options as JSON string

EXAMPLES
--------
yarn start --provider list               List all available providers
yarn start --whatsapp                    Start WhatsApp with default profile
yarn start --whatsapp --profile work     Start WhatsApp with work profile
yarn start --telegram --tray             Start Telegram in tray mode
yarn start --discord --options '{"theme":"dark"}'  Start Discord with dark theme

NOTES
-----
- Each provider may have additional specific options
- The --options parameter accepts a valid JSON string
- Multiple providers can be started simultaneously
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
                console.log(`[${index + 1}] ${provider.name}`);
                console.log(`    Command: ${provider.commandArg ? provider.commandArg.replace(/^--/, '') : 'N/A'}`);
                console.log(`    Description: ${provider.description || 'No description'}`);
                console.log('');
            });
            
            return true;
        } catch (error) {
            logger.error('Error listing providers:', error);
            return false;
        }
    }
}

module.exports = ProviderCLI;
