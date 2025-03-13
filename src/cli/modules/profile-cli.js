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
     * Parse profile-specific command line arguments
     * @method parseArgs
     * @param {Object} args - Command line arguments
     * @returns {Object|null} Parsed arguments or null if no profile flags found
     */
    async parseArgs(args) {
        try {
            // Check for entry flag first
            if (!args[this.entryFlag]) {
                return null;
            }

            // Get the subcommand
            const subcommand = args._[0];
            
            // Check if subcommand exists in our command map
            if (this.commands[subcommand]) {
                return {
                    command: subcommand,
                    handler: this.commands[subcommand],
                    args: {
                        name: args.name || null,
                        provider: args.provider || null,
                        force: args.force || false
                    }
                };
            }

            // If no valid subcommand but entry flag is present, show usage
            this.showUsage();
            return null;
        } catch (error) {
            log.error('Error parsing profile arguments:', error);
            return null;
        }
    }

    /**
     * Execute profile-specific commands based on parsed arguments
     * @method execute
     * @param {Object} args - Parsed arguments from parseArgs()
     * @returns {Promise<boolean>} True if execution successful
     */
    async execute(args) {
        try {
            if (!args || !args.command || !args.handler) {
                return false;
            }

            // Execute the command handler with parsed arguments
            return await args.handler(args.args);
        } catch (error) {
            log.error('Error executing profile command:', error);
            return false;
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
            
            if (profiles.length === 0) {
                console.log('No profiles found.');
            } else {
                console.log('Available profiles:');
                profiles.forEach(profile => {
                    const isActive = profile.active ? ' (active)' : '';
                    console.log(`  - ${profile.name} (${profile.provider})${isActive}`);
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
     * @returns {Promise<boolean>} True if profile creation successful
     */
    async createProfile(args) {
        try {
            const { name, provider } = args;
            
            if (!name || !provider) {
                log.error('Error creating profile: --provider and --name are required');
                console.error('Error: --provider and --name are required');
                return false;
            }
            
            log.info(`Creating new profile: ${name} (${provider})`);
            await profileManager.createProfile(name, provider);
            console.log(`Profile '${name}' created successfully.`);
            return true;
        } catch (error) {
            log.error('Error creating profile:', error);
            console.error(`Error creating profile: ${error.message}`);
            return false;
        }
    }

    /**
     * Delete an existing profile
     * @method deleteProfile
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if profile deletion successful
     */
    async deleteProfile(args) {
        try {
            const { name, force } = args;
            
            if (!name) {
                log.error('Error deleting profile: --name is required');
                console.error('Error: --name is required');
                return false;
            }
            
            if (!force) {
                console.log(`Warning: This will permanently delete the '${name}' profile.`);
                console.log('Use --force to bypass this warning.');
                return false;
            }
            
            log.info(`Deleting profile: ${name}`);
            await profileManager.deleteProfile(name);
            console.log(`Profile '${name}' deleted successfully.`);
            return true;
        } catch (error) {
            log.error('Error deleting profile:', error);
            console.error(`Error deleting profile: ${error.message}`);
            return false;
        }
    }

    /**
     * Switch to a different profile
     * @method switchProfile
     * @param {Object} args - Command arguments
     * @returns {Promise<boolean>} True if profile switch successful
     */
    async switchProfile(args) {
        try {
            const { name } = args;
            
            if (!name) {
                log.error('Error switching profile: --name is required');
                console.error('Error: --name is required');
                return false;
            }
            
            log.info(`Switching to profile: ${name}`);
            await profileManager.switchProfile(name);
            console.log(`Switched to profile '${name}' successfully.`);
            return true;
        } catch (error) {
            log.error('Error switching profile:', error);
            console.error(`Error switching profile: ${error.message}`);
            return false;
        }
    }
}

module.exports = ProfileCLI;
