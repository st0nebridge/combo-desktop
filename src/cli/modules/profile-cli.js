/**
 * @module ProfileCLI
 * @description CLI module for managing application profiles.
 * Handles profile creation, deletion, and switching.
 */

const BaseCLI = require('../abstract/base-cli');
const log = require('electron-log');
const profileManager = require('../../services/profile.manager');

/**
 * CLI module for managing application profiles.
 * Extends BaseCLI to provide profile management functionality:
 * - Profile creation and deletion
 * - Profile listing and switching
 * - Profile configuration
 * @class ProfileCLI
 * @extends {BaseCLI}
 */
class ProfileCLI extends BaseCLI {
    /**
     * Creates a new ProfileCLI instance
     * @constructor
     */
    constructor() {
        super();
        
        // Define module-specific flags
        this.moduleFlags = ['--profile', '--profiles'];
        
        // Define entry flag for profile commands
        this.entryFlag = 'profile';

        // Bind command functions using .bind() pattern for command mapping
        this.commands = {
            'list': this.listProfiles.bind(this),
            'create': this.createProfile.bind(this),
            'delete': this.deleteProfile.bind(this),
            'switch': this.switchProfile.bind(this)
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
            
            // Check for direct profile flags
            if (args.includes('--profile') || args.includes('--profiles')) {
                return true;
            }
            
            return false;
        } catch (error) {
            log.error('Error checking if profile module can handle arguments:', error);
            return false;
        }
    }

    /**
     * Parse profile-specific command line arguments
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
            
            // Check for direct flags
            if (args.includes('--profile') || args.includes('--profiles')) {
                // Get the index of the flag
                const flagIndex = args.indexOf('--profile') !== -1 ? 
                    args.indexOf('--profile') : args.indexOf('--profiles');
                
                // Get the command (next argument after the flag)
                if (flagIndex !== -1 && flagIndex + 1 < args.length && !args[flagIndex + 1].startsWith('--')) {
                    const command = args[flagIndex + 1];
                    
                    if (this.commands[command]) {
                        result.command = command;
                        
                        // Parse additional arguments
                        for (let i = flagIndex + 2; i < args.length; i++) {
                            if (args[i] === '--name' && i + 1 < args.length) {
                                result.name = args[i + 1];
                                i++; // Skip the next argument as it's the value
                            } else if (args[i] === '--provider' && i + 1 < args.length) {
                                result.provider = args[i + 1];
                                i++; // Skip the next argument as it's the value
                            } else if (args[i] === '--force') {
                                result.force = true;
                            }
                        }
                        
                        return result;
                    }
                }
                
                // Default to list if no command specified
                result.command = 'list';
                return result;
            }
            
            return null;
        } catch (error) {
            log.error('Error parsing profile arguments:', error);
            return null;
        }
    }

    /**
     * Check if this is a CLI command that shouldn't register a PID
     * @method isCliCommand
     * @returns {boolean} True if this is a CLI command
     */
    isCliCommand() {
        // Profile commands are CLI commands that don't need to register a PID
        return true;
    }

    /**
     * Execute profile-specific commands based on parsed arguments
     * @method execute
     * @param {Array<string>} args - Command line arguments
     * @param {Object} context - Execution context
     * @returns {Promise<{success: boolean, context: Object, continueExecution: boolean, provider: string}>} Execution result
     */
    async execute(args, context) {
        try {
            // Parse the arguments
            const parsedArgs = this.parseArgs(args);

            if (!parsedArgs || !parsedArgs.command) {
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
            
            // Execute the command handler based on the command name
            const handler = this.commands[parsedArgs.command];
            if (handler) {
                const success = await handler(parsedArgs);
                
                // Update context with profile information if applicable
                if (success && parsedArgs.provider) {
                    return {
                        success: true,
                        context: {
                            ...context,
                            profileCommand: parsedArgs.command,
                            profileName: parsedArgs.name,
                            profileProvider: parsedArgs.provider
                        },
                        continueExecution: false,
                        provider: parsedArgs.provider
                    };
                }
                
                return {
                    success,
                    context,
                    continueExecution: false
                };
            }
            
            // Default to showing usage if no specific command found
            this.showUsage();
            return {
                success: false,
                context,
                continueExecution: false
            };
        } catch (error) {
            log.error('Error executing profile command:', error);
            return {
                success: false,
                context,
                continueExecution: false
            };
        }
    }

    /**
     * Show usage information for the profile module
     * @method showUsage
     */
    showUsage() {
        console.log(`
Profile Management Commands:
  --profile list                     List all available profiles
  --profile create --name NAME --provider PROVIDER
                                     Create a new profile
  --profile delete --name NAME [--force]
                                     Delete an existing profile
  --profile switch --name NAME       Switch to a different profile

Options:
  --name NAME                        Profile name
  --provider PROVIDER                Profile provider (e.g., 'whatsapp', 'telegram')
  --force                            Force operation without confirmation

Examples:
  yarn start --profile list                       List all profiles
  yarn start --profile create --name work --provider whatsapp
                                                  Create a new WhatsApp profile named 'work'
  yarn start --profile delete --name work --force Delete the 'work' profile without confirmation
  yarn start --profile switch --name personal     Switch to the 'personal' profile
`);
    }

    /**
     * List all available profiles
     * @method listProfiles
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if listing was successful
     */
    async listProfiles(args) {
        try {
            log.info('Listing all profiles');
            const profiles = await profileManager.getAllProfiles();
            
            if (Object.keys(profiles).length === 0) {
                console.log('No profiles found.');
            } else {
                console.log('Available profiles:');
                Object.values(profiles).forEach(profile => {
                    const isActive = profile.active ? ' (active)' : '';
                    console.log(`  - ${profile.profileName} (${profile.providerName})${isActive}`);
                });
            }
            
            return true;
        } catch (error) {
            log.error('Error listing profiles:', error);
            return false;
        }
    }

    /**
     * Create a new profile
     * @method createProfile
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if creation was successful
     */
    async createProfile(args) {
        try {
            if (!args.name) {
                console.log('Error: Profile name is required');
                console.log('Usage: --profile create --name NAME --provider PROVIDER');
                return false;
            }
            
            if (!args.provider) {
                console.log('Error: Provider is required');
                console.log('Usage: --profile create --name NAME --provider PROVIDER');
                return false;
            }
            
            log.info(`Creating profile: ${args.name} (${args.provider})`);
            
            // Check if profile already exists
            const exists = await profileManager.profileExists(args.name);
            if (exists) {
                console.log(`Error: Profile '${args.name}' already exists`);
                return false;
            }
            
            // Create the profile
            await profileManager.createProfile(args.name, args.provider);
            console.log(`Profile '${args.name}' created successfully`);
            
            return true;
        } catch (error) {
            log.error('Error creating profile:', error);
            console.log(`Error creating profile: ${error.message}`);
            return false;
        }
    }

    /**
     * Delete an existing profile
     * @method deleteProfile
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if deletion was successful
     */
    async deleteProfile(args) {
        try {
            if (!args.name) {
                console.log('Error: Profile name is required');
                console.log('Usage: --profile delete --name NAME [--force]');
                return false;
            }
            
            log.info(`Deleting profile: ${args.name}`);
            
            // Check if profile exists
            const exists = await profileManager.profileExists(args.name);
            if (!exists) {
                console.log(`Error: Profile '${args.name}' does not exist`);
                return false;
            }
            
            // Confirm deletion if not forced
            if (!args.force) {
                console.log(`Warning: This will delete the profile '${args.name}' and all its data`);
                console.log('Use --force to confirm deletion');
                return false;
            }
            
            // Delete the profile
            await profileManager.deleteProfile(args.name);
            console.log(`Profile '${args.name}' deleted successfully`);
            
            return true;
        } catch (error) {
            log.error('Error deleting profile:', error);
            console.log(`Error deleting profile: ${error.message}`);
            return false;
        }
    }

    /**
     * Switch to a different profile
     * @method switchProfile
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if switch was successful
     */
    async switchProfile(args) {
        try {
            if (!args.name) {
                console.log('Error: Profile name is required');
                console.log('Usage: --profile switch --name NAME');
                return false;
            }
            
            log.info(`Switching to profile: ${args.name}`);
            
            // Check if profile exists
            const exists = await profileManager.profileExists(args.name);
            if (!exists) {
                console.log(`Error: Profile '${args.name}' does not exist`);
                return false;
            }
            
            // Switch to the profile
            await profileManager.setActiveProfile(args.name);
            console.log(`Switched to profile '${args.name}'`);
            
            return true;
        } catch (error) {
            log.error('Error switching profile:', error);
            console.log(`Error switching profile: ${error.message}`);
            return false;
        }
    }
}

module.exports = ProfileCLI;
