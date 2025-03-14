/**
 * @module HelpCLI
 * @description CLI module for displaying help information and documentation.
 */

const BaseCLI = require('../abstract/base-cli');
const log = require('electron-log');
const { app } = require('electron');

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
        
        // Define module-specific flags
        this.moduleFlags = ['--help', '--manual', '--version'];
        
        // Define entry flag for help commands
        this.entryFlag = 'help';

        // Bind command functions using .bind() pattern for command mapping
        this.commands = {
            'version': this.showVersion.bind(this),
            'help': this.showUsage.bind(this),
            'manual': this.showManual.bind(this)
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
            
            // Check for direct help flags
            if (args.includes('--help') || args.includes('--manual') || args.includes('--version')) {
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
            
            // Parse common flags
            this.parseCommonFlags(args, result);
            
            // Check for direct flags first
            if (args.includes('--help')) {
                result.command = 'help';
                
                // Check for help command format (--help <command>)
                const helpIndex = args.indexOf('--help');
                if (helpIndex !== -1 && helpIndex + 1 < args.length && !args[helpIndex + 1].startsWith('--')) {
                    const subcommand = args[helpIndex + 1];
                    
                    if (this.commands[subcommand]) {
                        result.command = subcommand;
                    }
                }
                
                return result;
            }
            
            if (args.includes('--version')) {
                result.command = 'version';
                return result;
            }
            
            if (args.includes('--manual')) {
                result.command = 'manual';
                
                // Check for manual topic
                const manualIndex = args.indexOf('--manual');
                if (manualIndex !== -1 && manualIndex + 1 < args.length && !args[manualIndex + 1].startsWith('--')) {
                    result.topic = args[manualIndex + 1];
                }
                
                return result;
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
            console.log(`
Help Commands:
  --help                    Show this help information
  --help version           Show version information
  --help manual [topic]    Show detailed manual (optional topic)
  --version                Show version information
  --manual [topic]         Show detailed manual (optional topic)

Examples:
  yarn start --help                Show help information
  yarn start --help version        Show version information
  yarn start --help manual         Show detailed manual
  yarn start --manual profiles     Show manual for profiles
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
            
            if (typeof args === 'string') {
                topic = args;
            } else if (args && args.topic) {
                topic = args.topic;
            }
            
            if (topic) {
                console.log(`\nManual for topic: ${topic}\n`);
                
                // Show topic-specific manual
                switch (topic.toLowerCase()) {
                    case 'profiles':
                    case 'profile': {
                        console.log(`
Profile Management:
  Profiles allow you to manage multiple configurations for different accounts.
  Each profile is associated with a specific provider (e.g., WhatsApp, Telegram).
  
  Commands:
    --profile list                     List all available profiles
    --profile create --name NAME --provider PROVIDER
                                       Create a new profile
    --profile delete --name NAME [--force]
                                       Delete an existing profile
    --profile switch --name NAME       Switch to a different profile
`);
                        break;
                    }
                    case 'providers':
                    case 'provider': {
                        console.log(`
Provider Management:
  Providers are the messaging services that can be used with this application.
  
  Available Providers:
    whatsapp       WhatsApp messaging service
    telegram       Telegram messaging service
    
  Usage:
    --provider NAME         Specify provider to use
    --provider-config PATH  Specify provider configuration file
`);
                        break;
                    }
                    default: {
                        console.log(`No manual entry for topic: ${topic}`);
                        console.log('Available topics: profiles, providers');
                    }
                }
            } else {
                // Show general manual
                console.log(`
Application Manual:

This application allows you to manage multiple messaging service accounts
through a unified desktop interface.

Available Topics:
  profiles    Profile management
  providers   Provider management

To view topic-specific manual:
  yarn start --manual TOPIC
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
