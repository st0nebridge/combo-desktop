/**
 * @module ProfileCLI
 * @description CLI module for managing application profiles.
 * Handles profile listing and deletion.
 */

const BaseCLI = require('../abstract/base-cli');
const log = require('electron-log');
const profileManager = require('../../services/profile.manager');

/**
 * CLI module for managing application profiles.
 * Extends BaseCLI to provide profile management functionality:
 * - Profile listing
 * - Profile deletion (single or all)
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
            'delete': this.deleteProfile.bind(this),
            'delete-all': this.deleteAllProfiles.bind(this)
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
        
        // Check for --profiles flag (always for profile management)
        if (args.includes('--profiles')) {
            return true;
        }

        // Allow handling when --profile flag is present even before parsing commands
        if (args.includes('--profile')) {
            return true;
        }
        
        // Check for --profile flag followed by a profile management command
        const profileIndex = args.indexOf('--profile');
        if (profileIndex !== -1 && profileIndex + 1 < args.length) {
            const nextArg = args[profileIndex + 1];
                // Only handle if the next argument is a profile management command
                if (this.commands[nextArg]) {
                    return true;
                }
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
            
            // Check for --profile or --profiles flag
            let profileIndex = args.indexOf('--profile');
            if (profileIndex === -1) {
                profileIndex = args.indexOf('--profiles');
            }
            
            if (profileIndex !== -1 && profileIndex + 1 < args.length) {
                const command = args[profileIndex + 1];
                if (this.commands[command]) {
                    result.command = command;
                    
                    // Parse additional arguments for delete command
                    if (command === 'delete' && profileIndex + 2 < args.length) {
                        // Next argument after 'delete' is the profile name
                        result.profileName = args[profileIndex + 2];
                        
                        // Check for provider-specific flags
                        const providerFlags = this.getProviderFlags(args);
                        if (providerFlags.length > 0) {
                            result.providerName = providerFlags[0].replace('--', '');
                        }
                    }
                }
            }
            
            return result;
        } catch (error) {
            log.error('Error parsing profile arguments:', error);
            return null;
        }
    }

    /**
     * Get provider flags from arguments
     * @method getProviderFlags
     * @param {Array<string>} args - Command line arguments
     * @returns {Array<string>} Provider flags found in arguments
     * @private
     */
    getProviderFlags(args) {
        // Check for provider flags like --whatsapp, --telegram, etc.
        const providerFlags = [];
        const knownProviders = ['whatsapp', 'telegram', 'facebook', 'slack', 'discord'];
        
        for (const provider of knownProviders) {
            const flag = `--${provider}`;
            if (args.includes(flag)) {
                providerFlags.push(flag);
            }
        }
        
        return providerFlags;
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

            // Handle common flags first (including help)
            if (parsedArgs.help || args.includes('--help')) {
                this.showUsage();
                return {
                    success: true,
                    context,
                    continueExecution: false
                };
            }
            
            // If no command but profile flag is present, default to list
            if (!parsedArgs.command && (args.includes('--profile') || args.includes('--profiles'))) {
                parsedArgs.command = 'list';
            }
            
            // Execute the command handler based on the command name
            const handler = this.commands[parsedArgs.command];
            if (handler) {
                const success = await handler(parsedArgs);
                
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
        const cmd = this.getExecBaseCommand();
        console.log(`
Profile Management Commands:
  --profile list                     List all available profiles, grouped by provider
  --profile delete PROFILE_NAME      Delete a profile with the specified name for all providers
  --profile delete PROFILE_NAME --provider
                                     Delete a profile for a specific provider only
  --profile delete-all               Delete all profiles

Examples:
  ${cmd} --profile list                       List all profiles
  ${cmd} --profile delete work                Delete the 'work' profile for all providers
  ${cmd} --profile delete work --whatsapp     Delete the 'work' profile for WhatsApp only
  ${cmd} --profile delete-all                 Delete all profiles
`);
    }

    /**
     * Show detailed manual for the profile module
     * @method showManual
     */
    showManual() {
        const cmd = this.getExecBaseCommand();
        console.log(`
Profile Management Module Manual
===============================

DESCRIPTION
-----------
The Profile Management module handles application profiles for different messaging services.
Profiles allow users to maintain separate configurations for different accounts or use cases,
such as work and personal profiles for the same messaging service.

COMMANDS
--------
--profile list                     List all available profiles with their provider.
                                   This is the default command when only --profile is specified.

--profile delete PROFILE_NAME      Delete a profile with the specified name for all providers.
                                   Use with a provider flag to delete only for that provider.

--profile delete-all               Delete all profiles for all providers.

EXAMPLES
--------
${cmd} --profile list
    List all available profiles grouped by provider.

${cmd} --profile delete work
    Delete the 'work' profile for all providers.

${cmd} --profile delete work --whatsapp
    Delete the 'work' profile for WhatsApp only.

${cmd} --profile delete-all
    Delete all profiles for all providers.

NOTES
-----
- Profiles are stored in the application data directory
- Each profile maintains separate cookies, cache, and settings
- Multiple profiles can exist for the same provider
`);
    }

    /**
     * Get the manual topic for this CLI module
     * @method getManualTopic
     * @returns {string} The topic name for this module's manual
     */
    getManualTopic() {
        return 'profile';
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
                return true;
            }
            
            // Group profiles by provider
            const profilesByProvider = {};
            
            Object.values(profiles).forEach(profile => {
                const providerName = profile.providerName;
                if (!profilesByProvider[providerName]) {
                    profilesByProvider[providerName] = [];
                }
                profilesByProvider[providerName].push(profile);
            });
            
            console.log('Available profiles:');
            
            // Display profiles grouped by provider
            for (const [provider, providerProfiles] of Object.entries(profilesByProvider)) {
                console.log(`\n${provider.charAt(0).toUpperCase() + provider.slice(1)}:`);
                
                for (const profile of providerProfiles) {
                    const isActive = profile.active ? ' (active)' : '';
                    console.log(`  - ${profile.profileName}${isActive}`);
                }
            }
            
            return true;
        } catch (error) {
            log.error('Error listing profiles:', error);
            console.log(`Error listing profiles: ${error.message}`);
            return false;
        }
    }

    /**
     * Delete a profile
     * @method deleteProfile
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if deletion was successful
     */
    async deleteProfile(args) {
        try {
            if (!args.profileName) {
                console.log('Error: Profile name is required');
                console.log('Usage: --profile delete PROFILE_NAME [--provider]');
                return false;
            }
            
            const profileName = args.profileName;
            const providerName = args.providerName;
            
            if (providerName) {
                // Delete profile for specific provider
                log.info(`Deleting profile: ${profileName} (${providerName})`);
                
                try {
                    await profileManager.deleteProfile(providerName, profileName);
                    console.log(`Profile '${profileName}' for ${providerName} deleted successfully`);
                    return true;
                } catch (error) {
                    if (error.message.includes('does not exist')) {
                        console.log(`Profile '${profileName}' does not exist for ${providerName}`);
                    } else {
                        console.log(`Error deleting profile: ${error.message}`);
                    }
                    return false;
                }
            } else {
                // Delete profile for all providers
                log.info(`Deleting profile: ${profileName} (all providers)`);
                
                const profiles = await profileManager.getAllProfiles();
                const matchingProfiles = Object.values(profiles).filter(
                    profile => profile.profileName === profileName
                );
                
                if (matchingProfiles.length === 0) {
                    console.log(`Error: Profile '${profileName}' does not exist for any provider`);
                    return false;
                }
                
                let success = true;
                
                for (const profile of matchingProfiles) {
                    try {
                        await profileManager.deleteProfile(profile.providerName, profileName);
                        console.log(`Profile '${profileName}' for ${profile.providerName} deleted successfully`);
                    } catch (error) {
                        console.log(`Error deleting profile for ${profile.providerName}: ${error.message}`);
                        success = false;
                    }
                }
                
                return success;
            }
        } catch (error) {
            log.error('Error deleting profile:', error);
            console.log(`Error deleting profile: ${error.message}`);
            return false;
        }
    }

    /**
     * Delete all profiles
     * @method deleteAllProfiles
     * @returns {Promise<boolean>} True if deletion was successful
     */
    async deleteAllProfiles() {
        try {
            log.info('Deleting all profiles');
            
            // Get current profiles to show count
            const profiles = await profileManager.getAllProfiles();
            const count = Object.keys(profiles).length;
            
            if (count === 0) {
                console.log('No profiles to delete.');
                return true;
            }
            
            // Delete all profiles
            await profileManager.deleteAllProfiles();
            console.log(`All profiles (${count}) deleted successfully`);
            
            return true;
        } catch (error) {
            log.error('Error deleting all profiles:', error);
            console.log(`Error deleting all profiles: ${error.message}`);
            return false;
        }
    }
}

module.exports = ProfileCLI;
