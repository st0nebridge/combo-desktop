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
     * Find all occurrences of a value in an array
     * @method findAllIndices
     * @param {Array} array - The array to search in
     * @param {*} value - The value to search for
     * @returns {Array<number>} Array of indices where the value was found
     * @private
     */
    findAllIndices(array, value) {
        const indices = [];
        let idx = array.indexOf(value);
        while (idx !== -1) {
            indices.push(idx);
            idx = array.indexOf(value, idx + 1);
        }
        return indices;
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
            result.sessions = [];
            
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
            
            // Check for global profile flag
            let globalProfile = null;
            const profileIndex = args.indexOf('--profile');
            if (profileIndex !== -1 && profileIndex + 1 < args.length) {
                const profileValue = args[profileIndex + 1];
                // Only use as profile if it's not another flag
                if (!profileValue.startsWith('--')) {
                    globalProfile = profileValue;
                    logger.info(`Found global profile override: ${globalProfile}`);
                }
            }
            
            // Check for direct provider flags
            const providers = providerRegistry.getAvailableProviders();
            for (const provider of providers) {
                if (provider.commandArg && args.includes(provider.commandArg)) {
                    const providerName = provider.commandArg.replace(/^--/, '');
                    
                    // Find all occurrences of this provider flag
                    const flagIndices = this.findAllIndices(args, provider.commandArg);
                    
                    // Add to providers array only once
                    if (!result.providers.includes(providerName)) {
                        result.providers.push(providerName);
                    }
                    
                    // Process each occurrence of the provider flag
                    for (const flagIndex of flagIndices) {
                        let profile = globalProfile || 'default';
                        
                        // Check for profile value after provider flag
                        if (flagIndex !== -1 && flagIndex + 1 < args.length) {
                            const nextArg = args[flagIndex + 1];
                            // Only use as profile if it's not another flag
                            if (!nextArg.startsWith('--')) {
                                profile = nextArg;
                                logger.info(`Found specific profile for ${providerName}: ${profile}`);
                            }
                        }
                        
                        // Add to sessions array, ensuring no duplicates
                        const existingIndex = result.sessions.findIndex(s => 
                            s.provider === providerName && s.profile === profile
                        );
                        
                        if (existingIndex === -1) {
                            result.sessions.push({
                                provider: providerName,
                                profile: profile
                            });
                            logger.info(`Added session: ${providerName}:${profile}`);
                        }
                    }
                    
                    // Check for tray flag
                    result.tray = args.includes('--tray');
                }
            }
            
            // Check for window show behavior flag (outside provider loop)
            const windowShowIndex = args.indexOf('--window-show');
            if (windowShowIndex !== -1 && windowShowIndex + 1 < args.length) {
                const windowShowValue = args[windowShowIndex + 1];
                const validBehaviors = ['auto', 'minimize', 'hidden', 'background', 'bring-to-front'];
                if (validBehaviors.includes(windowShowValue)) {
                    result.windowShowBehavior = windowShowValue;
                    logger.info(`Found window show behavior: ${windowShowValue}`);
                } else {
                    logger.warn(`Invalid window show behavior: ${windowShowValue}. Valid options: ${validBehaviors.join(', ')}`);
                }
            }
            
            // Check for options flag (outside provider loop)
            const optionsIndex = args.indexOf('--options');
            if (optionsIndex !== -1 && optionsIndex + 1 < args.length) {
                try {
                    result.options = JSON.parse(args[optionsIndex + 1]);
                } catch (error) {
                    logger.error('Error parsing options JSON:', error);
                    result.options = {};
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

            // Update context with provider information
            context.providers = parsedArgs.providers;
            context.sessions = parsedArgs.sessions;
            
            // Pass window show behavior to context if specified
            if (parsedArgs.windowShowBehavior) {
                context.windowShowBehavior = parsedArgs.windowShowBehavior;
            }
            
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
            
            // If we're handling this request but no valid command found
            if (this.canHandle(args)) {
                // Check for provider args
                const providerArgs = this.moduleFlags.filter(key => args.includes(key));
                if (providerArgs.length > 0) {
                    logger.info('Provider CLI context:', context);
                    return {
                        success: true,
                        context,
                        continueExecution: true
                    };
                }
            }
            
            // Default to showing usage if no specific command found
            this.showUsage();
            return {
                success: false,
                context,
                continueExecution: false
            };
        } catch (error) {
            logger.error('Error executing provider command:', error);
            return {
                success: false,
                context,
                continueExecution: false
            };
        }
    }

    /**
     * Show usage information for the provider module
     * @method showUsage
     */
    showUsage() {
        const cmd = this.getExecBaseCommand();
        console.log(`
Provider Management Commands:
  --provider list                          List available providers
  --<provider> [options]                   Start a specific provider

Provider Options:
  --profile <n>                         Use specific profile
  --tray                                   Start in tray mode
  --window-show <behavior>                 Window show behavior (auto, minimize, hidden, background, bring-to-front)
  --options <json>                         Provider-specific options as JSON

Examples:
  ${cmd} --provider list               List all available providers
  ${cmd} --whatsapp --profile work     Start WhatsApp with work profile
  ${cmd} --whatsapp --window-show hidden    Start WhatsApp hidden in background
  ${cmd} --facebook --window-show minimize  Start Facebook minimized to tray
`);
    }

    /**
     * Show detailed manual for the provider module
     * @method showManual
     */
    showManual() {
        const cmd = this.getExecBaseCommand();
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
--profile <n>                         Use specific profile configuration
--tray                                   Start in tray mode (minimized)
--window-show <behavior>                 Window show behavior: auto (default), minimize, hidden, background, bring-to-front
--options <json>                         Provider-specific options as JSON string

EXAMPLES
--------
${cmd} --provider list               List all available providers
${cmd} --whatsapp                    Start WhatsApp with default profile
${cmd} --whatsapp --profile work     Start WhatsApp with work profile
${cmd} --whatsapp --window-show hidden    Start WhatsApp hidden in background
${cmd} --facebook --tray             Start Facebook in tray mode
${cmd} --facebook --window-show minimize  Start Facebook minimized to tray

NOTES
-----
- Each provider may have additional specific options
- The --options parameter accepts a valid JSON string
- Multiple providers can be started simultaneously

WINDOW SHOW BEHAVIORS
---------------------
- auto: Show and focus window immediately (default)
- minimize: Create window but minimize to tray
- hidden: Create window but keep it hidden
- background: Create window in background without focus
- bring-to-front: Show existing window and bring to front (for delegation)
`);
    }

    /**
     * Get the manual topic for this CLI module
     * @method getManualTopic
     * @returns {string} The topic name for this module's manual
     */
    getManualTopic() {
        return 'provider';
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
