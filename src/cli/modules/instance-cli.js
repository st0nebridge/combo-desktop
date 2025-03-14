/**
 * @module InstanceCLI
 * @description CLI module for managing application instances.
 * Handles instance creation, locking, and management.
 */

const BaseCLI = require('../abstract/base-cli');
const log = require('electron-log');
const instanceManager = require('../../services/instance.manager');

/**
 * CLI module for managing application instances.
 * Extends BaseCLI to provide instance management functionality:
 * - Instance creation and termination
 * - Instance lock management
 * - Instance status and information
 * @class InstanceCLI
 * @extends {BaseCLI}
 */
class InstanceCLI extends BaseCLI {
    /**
     * Creates a new InstanceCLI instance
     * @constructor
     */
    constructor() {
        super();
        
        // Define module-specific flags
        this.moduleFlags = ['--instance', '--reset-lock', '--new-instance', '--one-instance'];
        
        // Define entry flag for instance commands
        this.entryFlag = 'instance';

        // Bind command functions using .bind() pattern for command mapping
        this.commands = {
            'reset-lock': this.resetLock.bind(this),
            'new': this.createNewInstance.bind(this),
            'list': this.listInstances.bind(this),
            'status': this.getStatus.bind(this),
            'kill': this.killInstance.bind(this)
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
            
            // Check for direct instance flags
            if (args.includes('--instance') || 
                args.includes('--reset-lock') || 
                args.includes('--new-instance') || 
                args.includes('--one-instance')) {
                return true;
            }
            
            return false;
        } catch (error) {
            log.error('Error checking if instance module can handle arguments:', error);
            return false;
        }
    }

    /**
     * Parse instance-specific command line arguments
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
            if (args.includes('--reset-lock')) {
                result.command = 'reset-lock';
                result.force = args.includes('--force');
                return result;
            }
            
            if (args.includes('--new-instance')) {
                result.command = 'new';
                return result;
            }
            
            if (args.includes('--one-instance')) {
                result.command = 'one';
                return result;
            }
            
            // Check for --instance command format
            const instanceIndex = args.indexOf('--instance');
            if (instanceIndex === -1) {
                return result;
            }
            
            // Get the subcommand (next argument after --instance)
            const subcommandIndex = instanceIndex + 1;
            if (subcommandIndex >= args.length) {
                return result;
            }
            
            const subcommand = args[subcommandIndex];
            
            // Check if subcommand exists in our command map
            if (this.commands[subcommand]) {
                result.command = subcommand;
                
                // Parse additional arguments based on the command
                if (subcommand === 'kill') {
                    const idIndex = args.indexOf('--id');
                    if (idIndex !== -1 && idIndex + 1 < args.length) {
                        result.id = args[idIndex + 1];
                    }
                }
                
                result.force = args.includes('--force');
            }

            return result;
        } catch (error) {
            log.error('Error parsing instance arguments:', error);
            return this.getBaseResultObject();
        }
    }

    /**
     * Check if this is a CLI command that shouldn't register a PID
     * @method isCliCommand
     * @returns {boolean} True if this is a CLI command
     */
    isCliCommand() {
        // Instance management commands are CLI commands that don't need to register a PID
        return true;
    }

    /**
     * Execute instance-specific commands based on parsed arguments
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
            
            // If no valid command found but we're handling this request, show usage
            if (this.canHandle(args)) {
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
            log.error('Error executing instance command:', error);
            return {
                success: false,
                context,
                continueExecution: true
            };
        }
    }

    /**
     * Show usage information for the instance module
     * @method showUsage
     */
    showUsage() {
        const cmd = this.getExecBaseCommand();
        console.log(`
Instance Management Commands:
  --instance reset-lock [--force]     Reset instance lock
  --instance new                      Create a new application instance
  --instance list                     List all running instances
  --instance status                   Show detailed instance status
  --instance kill [--id <id>]         Kill specific instance or all instances

Shorthand flags:
  --reset-lock                        Reset instance lock
  --new-instance                      Create a new application instance
  --one-instance                      Allow only one instance to run

Options:
  --force                             Force operation without confirmation
  --id <id>                           Specify instance ID for kill command

Examples:
  ${cmd} --instance reset-lock    Reset instance lock
  ${cmd} --instance new           Create a new instance
  ${cmd} --instance list          List all running instances
  ${cmd} --instance kill --id 123 Kill specific instance
`);
    }

    /**
     * Show detailed manual for the instance module
     * @method showManual
     */
    showManual() {
        const cmd = this.getExecBaseCommand();
        console.log(`
Instance Management Module Manual
================================

DESCRIPTION
-----------
The Instance Management module handles application instance creation, locking, 
and management. It provides functionality to create new instances, list running 
instances, check instance status, and terminate instances.

COMMANDS
--------
--instance reset-lock [--force]     Reset the instance lock file, allowing new instances
                                    to be created even if the lock file indicates another
                                    instance is running. Use --force to bypass confirmation.

--instance new                      Create a new application instance with a unique ID.
                                    This will launch a separate process.

--instance list                     List all currently running instances with their IDs,
                                    process IDs (PIDs), and start times.

--instance status                   Show detailed status information about the instance
                                    manager, including lock file status and running count.

--instance kill [--id <id>]         Terminate a specific instance by ID, or all instances
                                    if no ID is specified. Use --force to bypass confirmation
                                    when killing all instances.

SHORTHAND FLAGS
--------------
--reset-lock                        Shorthand for '--instance reset-lock'
--new-instance                      Shorthand for '--instance new'
--one-instance                      Allow only one instance to run at a time

OPTIONS
-------
--force                             Force operations without confirmation prompts
--id <id>                           Specify instance ID for the kill command

EXAMPLES
--------
${cmd} --instance reset-lock --force    Reset instance lock without confirmation
${cmd} --new-instance                   Create a new instance (shorthand)
${cmd} --instance list                  List all running instances
${cmd} --instance kill --id 123         Kill instance with ID 123
${cmd} --instance kill --force          Kill all instances without confirmation

NOTES
-----
- Instance locks prevent multiple instances from conflicting
- Each instance has a unique ID and runs in its own process
- The status command provides diagnostic information
- Use caution when resetting locks or killing instances
`);
    }

    /**
     * Reset the instance lock
     * @method resetLock
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if lock reset successful
     */
    async resetLock(args) {
        try {
            const force = args.force || false;
            
            if (!force) {
                console.log('Warning: Resetting the instance lock may cause conflicts if other instances are running.');
                console.log('Use --force to bypass this warning.');
                return false;
            }
            
            const result = await instanceManager.resetLock();
            
            if (result) {
                console.log('Instance lock reset successfully.');
                return true;
            } else {
                console.log('Failed to reset instance lock.');
                return false;
            }
        } catch (error) {
            log.error('Error resetting instance lock:', error);
            return false;
        }
    }

    /**
     * Create a new application instance
     * @method createNewInstance
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if instance created successfully
     */
    async createNewInstance(args) {
        try {
            const result = await instanceManager.createNewInstance();
            
            if (result) {
                console.log(`New instance created with ID: ${result.id}`);
                return true;
            } else {
                console.log('Failed to create new instance.');
                return false;
            }
        } catch (error) {
            log.error('Error creating new instance:', error);
            return false;
        }
    }

    /**
     * List all running instances
     * @method listInstances
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if instances listed successfully
     */
    async listInstances(args) {
        try {
            const instances = await instanceManager.getInstances();
            
            if (!instances || instances.length === 0) {
                console.log('No running instances found.');
                return true;
            }
            
            console.log('Running instances:');
            instances.forEach((instance, index) => {
                console.log(`[${index + 1}] ID: ${instance.id}, PID: ${instance.pid}, Started: ${instance.startTime}`);
            });
            
            return true;
        } catch (error) {
            log.error('Error listing instances:', error);
            return false;
        }
    }

    /**
     * Get status of running instances
     * @method getStatus
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if status retrieved successfully
     */
    async getStatus(args) {
        try {
            const status = await instanceManager.getStatus();
            
            console.log('Instance Manager Status:');
            console.log(`  Lock File: ${status.lockFile}`);
            console.log(`  Lock Exists: ${status.lockExists}`);
            console.log(`  Current Instance ID: ${status.currentId}`);
            console.log(`  Running Instances: ${status.runningCount}`);
            
            return true;
        } catch (error) {
            log.error('Error getting instance status:', error);
            return false;
        }
    }

    /**
     * Kill a specific instance or all instances
     * @method killInstance
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if instance(s) killed successfully
     */
    async killInstance(args) {
        try {
            const id = args.id;
            const force = args.force || false;
            
            if (id) {
                // Kill specific instance
                const result = await instanceManager.killInstance(id, force);
                
                if (result) {
                    console.log(`Instance ${id} killed successfully.`);
                    return true;
                } else {
                    console.log(`Failed to kill instance ${id}.`);
                    return false;
                }
            } else {
                // Kill all instances
                if (!force) {
                    console.log('Warning: This will kill all running instances.');
                    console.log('Use --force to bypass this warning.');
                    return false;
                }
                
                const result = await instanceManager.killAllInstances();
                
                if (result) {
                    console.log(`All instances killed successfully. Killed: ${result.killed}`);
                    return true;
                } else {
                    console.log('Failed to kill instances.');
                    return false;
                }
            }
        } catch (error) {
            log.error('Error killing instance(s):', error);
            return false;
        }
    }
}

module.exports = InstanceCLI;
