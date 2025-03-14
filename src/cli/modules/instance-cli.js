/**
 * @module InstanceCLI
 * @description CLI module for managing application instances.
 * Handles instance creation, listing, and killing.
 */

const BaseCLI = require('../abstract/base-cli');
const log = require('electron-log');
const instanceManager = require('../../services/instance.manager');

/**
 * CLI module for managing application instances.
 * Extends BaseCLI to provide instance management functionality:
 * - Instance creation
 * - Instance listing
 * - Instance killing
 * - Instance delegation
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
        this.moduleFlags = ['--instance', '--new-instance', '--one-instance', '--delegate-to', '--profile'];
        
        // Define entry flag for instance commands
        this.entryFlag = 'instance';

        // Bind command functions using .bind() pattern for command mapping
        this.commands = {
            'create': this.createNewInstance.bind(this),
            'list': this.listInstances.bind(this),
            'kill': this.killInstance.bind(this),
            'status': this.getStatus.bind(this),
            'reset': this.resetLock.bind(this)
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
            if (args.includes('--instance')) {
                return true;
            }
            
            // Check for instance management flags
            if (args.includes('--new-instance') || 
                args.includes('--one-instance') || 
                args.includes('--delegate-to') || 
                args.includes('--profile')) {
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
            
            // Check for --instance flag
            const instanceIndex = args.indexOf('--instance');
            if (instanceIndex !== -1 && instanceIndex + 1 < args.length) {
                const command = args[instanceIndex + 1];
                if (this.commands[command]) {
                    result.command = command;
                    
                    // Parse additional arguments for kill command
                    if (command === 'kill' && instanceIndex + 2 < args.length) {
                        result.instanceId = args[instanceIndex + 2];
                    }
                }
            }
            
            // Check for instance management flags
            result.newInstance = args.includes('--new-instance');
            result.oneInstance = args.includes('--one-instance');
            
            // Check for delegation flag
            const delegateIndex = args.indexOf('--delegate-to');
            if (delegateIndex !== -1 && delegateIndex + 1 < args.length) {
                result.delegateToPid = args[delegateIndex + 1];
                result.command = 'delegate';
            }
            
            // Check for profile flag
            const profileIndex = args.indexOf('--profile');
            if (profileIndex !== -1 && profileIndex + 1 < args.length) {
                result.profile = args[profileIndex + 1];
            }
            
            return result;
        } catch (error) {
            log.error('Error parsing instance arguments:', error);
            return null;
        }
    }

    /**
     * Check if this is a CLI command that shouldn't register a PID
     * @method isCliCommand
     * @returns {boolean} True if this is a CLI command
     */
    isCliCommand() {
        // Instance commands are CLI commands that don't need to register a PID
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

            if (!parsedArgs) {
                return {
                    success: false,
                    context,
                    continueExecution: true
                };
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
            
            // Initialize instance management context if not present
            if (!context.instanceManagement) {
                context.instanceManagement = {
                    forceNewInstance: false,
                    oneInstance: false,
                    // Default to profile isolation as per app_instances.md rules
                    profileIsolation: true
                };
            }
            
            // Handle profile flag
            if (parsedArgs.profile) {
                log.info(`Profile specified: ${parsedArgs.profile}`);
                context.profile = parsedArgs.profile;
            }
            
            // Handle instance management flags
            if (parsedArgs.newInstance || parsedArgs.oneInstance) {
                log.info('Instance management flags detected');
                
                // Update context properties for instance management
                if (parsedArgs.newInstance) {
                    context.instanceManagement.forceNewInstance = true;
                    // New instance overrides one instance
                    context.instanceManagement.oneInstance = false;
                    context.instanceManagement.profileIsolation = false;
                } else if (parsedArgs.oneInstance) {
                    context.instanceManagement.oneInstance = true;
                    context.instanceManagement.profileIsolation = false;
                }
                
                log.info('Updated context with instance management flags:', context.instanceManagement);
                
                // Continue execution to allow other modules to process their args
                return {
                    success: true,
                    context,
                    continueExecution: true
                };
            }
            
            // Handle delegation
            if (parsedArgs.command === 'delegate' && parsedArgs.delegateToPid) {
                const success = await this.delegateToInstance(parsedArgs.delegateToPid, args);
                return {
                    success,
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
            
            // If no specific command found but we have a profile, check if we need to delegate
            if (parsedArgs.profile && !parsedArgs.newInstance) {
                const delegated = await this.attemptProfileDelegation(parsedArgs.profile, args);
                if (delegated) {
                    return {
                        success: true,
                        context,
                        continueExecution: false
                    };
                }
            }
            
            // If no specific command found, continue execution
            return {
                success: true,
                context,
                continueExecution: true
            };
        } catch (error) {
            log.error('Error executing instance command:', error);
            return {
                success: false,
                context,
                continueExecution: false
            };
        }
    }

    /**
     * Show usage information for the instance module
     * @method showUsage
     */
    showUsage() {
        console.log('Instance Management Commands:');
        console.log('  --instance create                Create a new application instance');
        console.log('  --instance list                  List all running instances');
        console.log('  --instance kill <id>             Kill a specific instance by ID');
        console.log('  --instance status                Show instance manager status');
        console.log('  --instance reset                 Reset instance lock (emergency use only)');
        console.log('');
        console.log('Instance Management Flags:');
        console.log('  --new-instance                   Force creation of a new instance');
        console.log('  --one-instance                   Force all providers into one instance');
        console.log('  --profile <name>                 Specify profile for the current command');
        console.log('  --delegate-to <pid>              Delegate command to instance with specified PID');
    }

    /**
     * Create a new application instance
     * @method createNewInstance
     * @param {Object} args - Parsed arguments
     * @returns {Promise<boolean>} True if instance created successfully
     */
    async createNewInstance(args) {
        try {
            log.info('Creating new instance');
            const result = await instanceManager.createNewInstance();
            
            if (result.success) {
                console.log(`New instance created with ID: ${result.instanceId}`);
                return true;
            } else {
                console.error('Failed to create new instance:', result.error);
                return false;
            }
        } catch (error) {
            log.error('Error creating new instance:', error);
            console.error('Error creating new instance:', error.message);
            return false;
        }
    }

    /**
     * List all running instances
     * @method listInstances
     * @param {Object} args - Parsed arguments
     * @returns {Promise<boolean>} True if instances listed successfully
     */
    async listInstances(args) {
        try {
            log.info('Listing instances');
            const instances = await instanceManager.getInstances();
            
            if (instances.length === 0) {
                console.log('No running instances found');
            } else {
                console.log(`Found ${instances.length} running instances:`);
                instances.forEach(instance => {
                    console.log(`- ID: ${instance.id}, PID: ${instance.pid}, Profile: ${instance.profile || 'default'}, Created: ${new Date(instance.startTime).toLocaleString()}`);
                    if (instance.sessions && instance.sessions.length > 0) {
                        console.log(`  Sessions: ${instance.sessions.join(', ')}`);
                    }
                });
            }
            
            return true;
        } catch (error) {
            log.error('Error listing instances:', error);
            console.error('Error listing instances:', error.message);
            return false;
        }
    }

    /**
     * Kill a specific instance by ID
     * @method killInstance
     * @param {Object} args - Parsed arguments
     * @returns {Promise<boolean>} True if instance killed successfully
     */
    async killInstance(args) {
        try {
            if (!args.instanceId) {
                console.error('Instance ID is required');
                return false;
            }
            
            log.info(`Killing instance: ${args.instanceId}`);
            const result = await instanceManager.killInstance(args.instanceId);
            
            if (result) {
                console.log(`Instance ${args.instanceId} killed successfully`);
                return true;
            } else {
                console.error(`Failed to kill instance ${args.instanceId}`);
                return false;
            }
        } catch (error) {
            log.error(`Error killing instance ${args.instanceId}:`, error);
            console.error(`Error killing instance ${args.instanceId}:`, error.message);
            return false;
        }
    }

    /**
     * Reset instance lock (emergency use only)
     * @method resetLock
     * @param {Object} args - Parsed arguments
     * @returns {Promise<boolean>} True if lock reset successfully
     */
    async resetLock(args) {
        try {
            log.warn('Resetting instance lock (emergency use)');
            const result = await instanceManager.resetLock();
            
            if (result) {
                console.log('Instance lock reset successfully');
                return true;
            } else {
                console.error('Failed to reset instance lock');
                return false;
            }
        } catch (error) {
            log.error('Error resetting instance lock:', error);
            console.error('Error resetting instance lock:', error.message);
            return false;
        }
    }

    /**
     * Get instance manager status
     * @method getStatus
     * @param {Object} args - Parsed arguments
     * @returns {Promise<boolean>} True if status retrieved successfully
     */
    async getStatus(args) {
        try {
            log.info('Getting instance manager status');
            const status = await instanceManager.getStatus();
            
            console.log('Instance Manager Status:');
            console.log(`- Lock File: ${status.lockFile}`);
            console.log(`- Lock Exists: ${status.lockExists}`);
            console.log(`- Current Instance ID: ${status.currentId || 'None'}`);
            console.log(`- Running Instances: ${status.runningCount}`);
            
            return true;
        } catch (error) {
            log.error('Error getting instance status:', error);
            console.error('Error getting instance status:', error.message);
            return false;
        }
    }

    /**
     * Delegate command to a running instance
     * @method delegateToInstance
     * @param {string} pid - PID of the instance to delegate to
     * @param {Array<string>} args - Command line arguments
     * @returns {Promise<boolean>} True if delegation successful
     */
    async delegateToInstance(pid, args) {
        try {
            if (!pid) {
                log.error('Target PID is required for delegation');
                return false;
            }
            
            log.info(`Delegating command to instance with PID ${pid}`);
            
            // Remove delegation flags from args
            const delegateIndex = args.indexOf('--delegate-to');
            const cleanArgs = [...args];
            if (delegateIndex !== -1) {
                // Remove --delegate-to and its value
                cleanArgs.splice(delegateIndex, 2);
            }
            
            // Find the instance by PID
            const instances = await instanceManager.getInstances();
            const targetInstance = instances.find(instance => instance.pid.toString() === pid.toString());
            
            if (!targetInstance) {
                log.error(`No instance found with PID ${pid}`);
                return false;
            }
            
            // Process the command
            log.info(`Sending command to instance ${targetInstance.id}: ${cleanArgs.join(' ')}`);
            
            // Delegate the command to the instance manager
            const result = await instanceManager.delegateCommand(cleanArgs);
            
            if (result) {
                log.info('Command delegation completed successfully');
                return true;
            } else {
                log.error('Command delegation failed');
                return false;
            }
        } catch (error) {
            log.error(`Error delegating to instance with PID ${pid}:`, error);
            return false;
        }
    }

    /**
     * Attempt to delegate command to an instance running the specified profile
     * @method attemptProfileDelegation
     * @param {string} profile - Profile name
     * @param {Array<string>} args - Command line arguments
     * @returns {Promise<boolean>} True if delegation successful
     */
    async attemptProfileDelegation(profile, args) {
        try {
            log.info(`Checking if we need to delegate to an instance running profile: ${profile}`);
            
            // Get instance for the profile
            const instance = await instanceManager.getInstanceByProfile(profile);
            
            if (instance && instance.pid) {
                log.info(`Found instance running profile ${profile} with PID ${instance.pid}`);
                
                // Remove profile flag from args to avoid infinite delegation
                const profileIndex = args.indexOf('--profile');
                const cleanArgs = [...args];
                if (profileIndex !== -1) {
                    // Remove --profile and its value
                    cleanArgs.splice(profileIndex, 2);
                }
                
                // Delegate the command to the instance
                log.info(`Delegating command to instance running profile ${profile}: ${cleanArgs.join(' ')}`);
                
                // Use the delegateCommand method with the profile
                const result = await instanceManager.delegateCommand(cleanArgs, profile);
                
                if (result) {
                    log.info(`Successfully delegated command to instance running profile ${profile}`);
                    return true;
                } else {
                    log.warn(`Failed to delegate command to instance running profile ${profile}`);
                    return false;
                }
            }
            
            log.info(`No running instance found for profile ${profile}, continuing with normal execution`);
            return false;
        } catch (error) {
            log.error(`Error attempting profile delegation for ${profile}:`, error);
            return false;
        }
    }
}

module.exports = InstanceCLI;
