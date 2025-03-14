/**
 * @module HelpCLI
 * @description CLI module for displaying help information and documentation.
 */

const BaseCLI = require('../abstract/base-cli');
const log = require('../../services/logging.service');

/**
 * CLI module for displaying help information.
 * Extends BaseCLI to provide help functionality:
 * - General help information
 * - Version information
 * - Manual pages
 * @class HelpCLI
 * @extends {BaseCLI}
 */
class HelpCLI extends BaseCLI {
    /**
     * Creates a new HelpCLI instance
     * @constructor
     */
    constructor() {
        super();
        
        // Define entry flag for help commands
        this.entryFlag = 'help';

        // Initialize CLI modules map
        this.cliModules = {};

        // Bind command functions using .bind() pattern for command mapping
        this.commands = {
            'version': this.showVersion.bind(this),
            'help': this.showUsage.bind(this),
            'manual': this.showManual.bind(this)
        };

        // Wait for next tick to ensure registry is initialized
        process.nextTick(() => {
            this.loadCliModules();
        });
    }

    /**
     * Load all CLI modules from the registry
     * @private
     */
    loadCliModules() {
        try {
            // Clear existing modules
            this.cliModules = {};

            // Get modules from registry
            const modules = global.cliRegistry.getModules();
            if (!modules) {
                log.error('CLI Registry not initialized');
                return;
            }

            // Iterate through all registered modules
            for (const module of modules.values()) {
                try {
                    // Only register modules that implement getManualTopic
                    const topic = module.getManualTopic && module.getManualTopic();
                    if (topic) {
                        this.cliModules[topic] = module;
                    }
                } catch (error) {
                    log.error(`Error loading CLI module ${module.constructor.name}:`, error);
                }
            }

            log.debug('Loaded manual topics:', Object.keys(this.cliModules));
        } catch (error) {
            log.error('Error loading CLI modules:', error);
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
            
            // Check for direct help flags
            if (Object.keys(this.commands).some(cmd => args.includes(`--${cmd}`))) {
                return true;
            }
            
            return false;
        } catch (error) {
            log.error('Error checking if help module can handle arguments:', error);
            return false;
        }
    }

    /**
     * Parse help-specific command line arguments
     * @method parseArgs
     * @param {Array<string>} args - Command line arguments
     * @returns {Object} Parsed arguments
     */
    parseArgs(args) {
        try {
            // Initialize result object
            const result = this.getBaseResultObject();

            // Check for direct flags
            for (const flag of Object.keys(this.commands)) {
                const fullFlag = `--${flag}`;
                const flagIndex = args.indexOf(fullFlag);
                
                if (flagIndex !== -1) {
                    result.command = flag;
                    
                    // Check for additional argument
                    if (flagIndex + 1 < args.length && !args[flagIndex + 1].startsWith('--')) {
                        result.topic = args[flagIndex + 1];
                    }
                    
                    return result;
                }
            }
            
            return result;
        } catch (error) {
            log.error('Error parsing help arguments:', error);
            return this.getBaseResultObject();
        }
    }

    /**
     * Check if this is a CLI command that shouldn't register a PID
     * @method isCliCommand
     * @returns {boolean} True if this is a CLI command
     */
    isCliCommand() {
        // Help commands are CLI commands that don't need to register a PID
        return true;
    }

    /**
     * Execute help-specific commands based on parsed arguments
     * @method execute
     * @param {Array<string>} args - Command line arguments
     * @param {Object} context - Execution context
     * @returns {Promise<{success: boolean, context: Object, continueExecution: boolean}>} Execution result
     */
    async execute(args, context) {
        try {
            // Parse the arguments
            const parsedArgs = this.parseArgs(args);
            
            // Handle common flags first
            if (parsedArgs.help) {
                await this.showUsage();
                return {
                    success: true,
                    context,
                    continueExecution: false
                };
            }
            
            if (parsedArgs.version) {
                await this.showVersion();
                return {
                    success: true,
                    context,
                    continueExecution: false
                };
            }
            
            if (parsedArgs.manual) {
                await this.showManual(parsedArgs.topic);
                return {
                    success: true,
                    context,
                    continueExecution: false
                };
            }
            
            // Execute the command handler based on the command name
            if (parsedArgs.command && this.commands[parsedArgs.command]) {
                const handler = this.commands[parsedArgs.command];
                const success = await handler(parsedArgs);
                
                return {
                    success,
                    context,
                    continueExecution: false
                };
            }
            
            // Default to showing usage if no specific command found
            await this.showUsage();
            return {
                success: true,
                context,
                continueExecution: true
            };
        } catch (error) {
            log.error('Error executing help command:', error);
            return {
                success: false,
                context,
                continueExecution: true
            };
        }
    }

    /**
     * Show usage information for the help module
     * @method showUsage
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if successful
     */
    async showUsage(args) {
        try {
            const baseCommand = this.getExecBaseCommand();
            console.log(`
Help Commands:
  --help                    Show this help information
  --version                Show version information
  --manual [topic]         Show detailed manual (optional topic)

Examples:
  ${baseCommand} --help                Show help information
  ${baseCommand} --manual profiles     Show manual for profiles
`);
            return true;
        } catch (error) {
            log.error('Error showing usage:', error);
            return false;
        }
    }

    /**
     * Show version information
     * @method showVersion
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if successful
     */
    async showVersion(args) {
        try {
            console.log(`
Version Information:
  Mode: ${process.env.NODE_ENV || 'production'}
  Electron: ${process.versions.electron}
  Chrome: ${process.versions.chrome}
  Node: ${process.versions.node}
  V8: ${process.versions.v8}
`);
            return true;
        } catch (error) {
            log.error('Error showing version:', error);
            return false;
        }
    }

    /**
     * Show detailed manual
     * @method showManual
     * @param {Object|string} args - Command arguments or topic string
     * @returns {Promise<boolean>} True if successful
     */
    async showManual(args) {
        try {
            // Handle both object and string input
            let topic = null;
            const cmd = this.getExecBaseCommand();
            
            if (typeof args === 'string') {
                topic = args;
            } else if (args && args.topic) {
                topic = args.topic;
            }
            
            // Reload modules to ensure we have latest
            this.loadCliModules();
            
            if (topic) {
                // Get the CLI module based on topic
                const cliModule = this.cliModules[topic.toLowerCase()];
                if (cliModule) {
                    try {
                        // Call the module's showManual method
                        await cliModule.showManual();
                        return true;
                    } catch (error) {
                        log.error(`Error showing manual for topic ${topic}:`, error);
                        console.log(`Error displaying manual for topic: ${topic}`);
                        return false;
                    }
                } else {
                    console.log(`No manual entry for topic: ${topic}`);
                    console.log('Available topics: ' + Object.keys(this.cliModules).join(', '));
                }
            } else {
                // Show general manual
                const topics = Object.entries(this.cliModules)
                    .map(([topic, module]) => `  ${topic.padEnd(12)} ${module.constructor.name.replace('CLI', '')} management`);

                console.log(`
Application Manual:

This application allows you to manage multiple messaging service accounts
through a unified desktop interface.

Available Topics:
${topics.join('\n')}

To view topic-specific manual:
  ${cmd} --manual TOPIC
`);
            }
            
            return true;
        } catch (error) {
            log.error('Error showing manual:', error);
            return false;
        }
    }
}

module.exports = HelpCLI;
