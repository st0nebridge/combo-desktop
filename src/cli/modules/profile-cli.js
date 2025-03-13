/**
 * @module ProfileCLI
 * @description CLI module for managing application profiles and their data.
 * Handles profile creation, deletion, listing, and configuration.
 */

const BaseCLI = require('../abstract/base-cli');
const log = require('electron-log');
const profileManager = require('../../services/profile.manager');

/**
 * CLI module for managing application profiles.
 * Extends BaseCLI to provide profile management functionality:
 * - Profile creation and deletion
 * - Profile listing and status
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
        
        /** @property {Array<string>} moduleFlags - Supported command flags */
        this.moduleFlags = ['--profiles'];

        // Bind command functions using .bind() pattern for command mapping
        /** @property {Object} commands - Map of command names to handler functions */
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
     * @override
     * @returns {Object|null} Parsed arguments or null if no profile flags found
     */
    parseArgs() {
        const result = this.getBaseResultObject();
        result.command = null;
        result.provider = null;
        result.name = null;
        result.options = null;

        let i = 0;
        while (i < this.args.length) {
            const arg = this.args[i];

            // Parse common flags first
            const { handled, skipNext } = this.parseCommonFlags(result, i);
            if (handled) {
                if (skipNext) {
                    i++;
                }
                i++;
                continue;
            }

            if (arg === '--profiles') {
                i++;
                if (i < this.args.length) {
                    const subcommand = this.args[i];
                    if (this.commands[subcommand]) {
                        result.command = subcommand;
                        i++;
                        
                        // Parse additional arguments for commands
                        while (i < this.args.length) {
                            const flag = this.args[i];
                            if (flag === '--provider' && i + 1 < this.args.length) {
                                result.provider = this.args[i + 1];
                                i += 2;
                            } else if (flag === '--name' && i + 1 < this.args.length) {
                                result.name = this.args[i + 1];
                                i += 2;
                            } else if (flag === '--options' && i + 1 < this.args.length) {
                                try {
                                    result.options = JSON.parse(this.args[i + 1]);
                                    i += 2;
                                } catch (error) {
                                    log.error('Invalid JSON options:', error);
                                    i++;
                                }
                            } else {
                                break;
                            }
                        }
                    }
                }
                continue;
            }
            i++;
        }

        // Return null if no profile-specific command found
        if (!result.command && !result.help && !result.version) {
            return null;
        }

        return result;
    }

    /**
     * Execute profile-specific commands based on parsed arguments
     * @method execute
     * @override
     * @param {Object} args - Parsed arguments from parseArgs()
     * @returns {Promise<boolean>} True if execution successful
     * @throws {Error} If command execution fails or required args missing
     */
    async execute(args) {
        try {
            if (!args) {
                return false;
            }

            if (args.help) {
                this.showUsage();
                return true;
            }

            if (args.version) {
                return super.execute(args);
            }

            if (args.command && this.commands[args.command]) {
                // Validate required arguments for create/delete/switch commands
                if ((args.command === 'create' || args.command === 'delete' || args.command === 'switch') && (!args.provider || !args.name)) {
                    log.error('Error: --provider and --name are required');
                    this.showUsage();
                    return false;
                }

                const success = await this.commands[args.command](args);
                
                // Exit process after list command completes
                if (args.command === 'list' && success) {
                    process.exit(0);
                }
                
                return success;
            }

            this.showUsage();
            return false;
        } catch (error) {
            log.error('Error executing profile command:', error);
            return false;
        }
    }

    /**
     * Show usage information for the profile module
     * @method showUsage
     * @override
     */
    showUsage() {
        console.log(`
Profile Management Commands:
  --profiles list                                List available profiles
  --profiles create --provider <n> --name <n> [--options <json>]
                                                Create a new profile
  --profiles delete --provider <n> --name <n>
                                                Delete a profile
  --profiles switch --provider <n> --name <n>
                                                Switch to a different profile

Options:
  --provider <n>               Provider to associate with profile
  --name <n>                   Profile name
  --options <json>             Additional profile options as JSON string
  --help                       Show this help information
  --version                    Show version information

Examples:
  yarn start --profiles list
  yarn start --profiles create --provider whatsapp --name work
  yarn start --profiles delete --provider whatsapp --name old
  yarn start --profiles switch --provider whatsapp --name personal
`);
    }

    /**
     * List available profiles
     * @method listProfiles
     * @param {Object} args - Command arguments
     */
    async listProfiles(args) {
        try {
            const profiles = profileManager.getAllProfiles();
            if (!profiles || Object.keys(profiles).length === 0) {
                console.log('\nNo profiles found.\n');
                process.exit(0);
                return;
            }

            console.log('\nAvailable Profiles:\n');
            
            // Group profiles by provider
            const groupedProfiles = {};
            Object.entries(profiles).forEach(([key, profile]) => {
                const { providerName } = profile;
                if (!groupedProfiles[providerName]) {
                    groupedProfiles[providerName] = [];
                }
                groupedProfiles[providerName].push({ key, ...profile });
            });

            // Display profiles grouped by provider
            Object.entries(groupedProfiles).forEach(([provider, providerProfiles]) => {
                console.log(`${provider}:`);
                providerProfiles.forEach(profile => {
                    const createdAt = new Date(profile.createdAt).toLocaleString();
                    console.log(`  - ${profile.profileName}`);
                    if (profile.options && Object.keys(profile.options).length > 0) {
                        console.log('    Options:', JSON.stringify(profile.options, null, 2));
                    }
                    console.log(`    Created: ${createdAt}\n`);
                });
            });

            // Return true to indicate success and prevent showing usage
            return true;
        } catch (error) {
            log.error('Error listing profiles:', error);
            return false;
        }
    }

    /**
     * Create a new profile
     * @method createProfile
     * @param {Object} args - Command line arguments
     * @returns {Promise<boolean>} True if successful
     */
    async createProfile(args) {
        try {
            if (!args.provider || !args.name) {
                log.error('Error: --provider and --name are required');
                this.showUsage();
                return false;
            }

            const success = await profileManager.createProfile(args.provider, args.name, args.options);
            if (success) {
                console.log(`\nCreated profile '${args.name}' for provider '${args.provider}'`);
                return true;
            }

            return false;
        } catch (error) {
            log.error('Error creating profile:', error);
            return false;
        }
    }

    /**
     * Delete an existing profile
     * @method deleteProfile
     * @param {Object} args - Command line arguments
     * @returns {Promise<boolean>} True if successful
     */
    async deleteProfile(args) {
        try {
            if (!args.provider || !args.name) {
                log.error('Error: --provider and --name are required');
                this.showUsage();
                return false;
            }

            const success = await profileManager.deleteProfile(args.provider, args.name);
            if (success) {
                console.log(`\nDeleted profile '${args.name}' for provider '${args.provider}'`);
                return true;
            }

            return false;
        } catch (error) {
            log.error('Error deleting profile:', error);
            return false;
        }
    }

    /**
     * Switch to a different profile
     * @method switchProfile
     * @param {Object} args - Command line arguments
     * @returns {Promise<boolean>} True if successful
     */
    async switchProfile(args) {
        try {
            if (!args.provider || !args.name) {
                log.error('Error: --provider and --name are required');
                this.showUsage();
                return false;
            }

            const success = await profileManager.switchProfile(args.provider, args.name);
            if (success) {
                console.log(`\nSwitched to profile '${args.name}' for provider '${args.provider}'`);
                return true;
            }

            return false;
        } catch (error) {
            log.error('Error switching profile:', error);
            return false;
        }
    }

    /**
     * Check if this is a CLI command
     * @method isCliCommand
     * @returns {boolean} True if this is a CLI command
     */
    isCliCommand() {
        return true;
    }
}

module.exports = ProfileCLI;
