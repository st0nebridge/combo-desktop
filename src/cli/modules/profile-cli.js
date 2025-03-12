/**
 * @module ProfileCLI
 * @description CLI module for managing application profiles and their data.
 * Handles profile creation, deletion, listing, and configuration.
 */

const BaseCLI = require('../abstract/base-cli');
const log = require('electron-log');
const fs = require('fs-extra');
const path = require('path');
const { app } = require('electron');

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

        // Initialize paths
        this.initializePaths();

        // Bind command functions using .bind() pattern for command mapping
        /** @property {Object} commands - Map of command names to handler functions */
        this.commands = {
            'list': this.listProfiles.bind(this),
            'create': this.createProfile.bind(this),
            'delete': this.deleteProfile.bind(this),
            'delete-all': this.deleteAllProfiles.bind(this)
        };
    }

    /**
     * Initialize profile paths and ensure directories exist
     * @method initializePaths
     * @throws {Error} If initialization fails
     */
    initializePaths() {
        try {
            const userData = app.getPath('userData');
            this.profilesDir = path.join(userData, 'profiles');
            
            // Ensure profiles directory exists
            fs.ensureDirSync(this.profilesDir);
        } catch (error) {
            log.error('Error initializing profile paths:', error);
            throw error;
        }
    }

    /**
     * Get profile-specific result object with additional fields
     * @method getProfileResultObject
     * @returns {Object} Result object with structure { help: false, manual: false, command: null, name: null, provider: null, options: null, cliCommand: false }
     */
    getProfileResultObject() {
        const result = this.getBaseResultObject();
        return {
            ...result,
            command: null,
            name: null,
            provider: null,
            options: null,
            cliCommand: false
        };
    }

    /**
     * Parse profile-specific command line arguments
     * @method parseArgs
     * @override
     * @returns {Object|null} Parsed arguments or null if no profile flags found
     */
    parseArgs() {
        const result = this.getProfileResultObject();

        let i = 0;
        while (i < this.args.length) {
            const arg = this.args[i];

            if (arg === '--profiles') {
                result.cliCommand = true;
                i++;
                
                if (i < this.args.length) {
                    const subcommand = this.args[i];
                    if (this.commands[subcommand]) {
                        result.command = subcommand;
                        i++;
                        
                        // Parse additional arguments for create/delete commands
                        if (subcommand === 'create' || subcommand === 'delete') {
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
                }
                continue;
            }

            i = this.parseCommonFlags(result, i);
        }

        // Return null if no profile-specific command found
        if (!result.command && !result.help && !result.manual) {
            return null;
        }

        return result;
    }

    /**
     * Check if the current command is a CLI command
     * @method isCliCommand
     * @override
     * @returns {boolean} True if this is a CLI command
     */
    isCliCommand() {
        try {
            const args = this.parseArgs();
            return args && args.cliCommand;
        } catch (error) {
            log.error('Error checking CLI command:', error);
            return false;
        }
    }

    /**
     * Execute profile-specific commands based on parsed arguments
     * @method execute
     * @override
     * @param {Object} args - Parsed arguments from parseArgs()
     * @throws {Error} If command execution fails or required args missing
     */
    execute(args) {
        try {
            if (!args) {
                return;
            }

            if (args.help) {
                this.showUsage();
                return;
            }

            if (args.manual) {
                this.showManual();
                return;
            }

            if (args.command && this.commands[args.command]) {
                if ((args.command === 'create' || args.command === 'delete') && (!args.provider || !args.name)) {
                    console.error('Error: --provider and --name are required for create/delete commands');
                    this.showUsage();
                    return;
                }
                this.commands[args.command](args.provider, args.name, args.options);
            } else {
                this.showUsage();
            }
        } catch (error) {
            log.error('Error executing profile command:', error);
            throw error;
        }
    }

    /**
     * Show basic usage information and available commands
     * @method showUsage
     * @override
     */
    showUsage() {
        console.log('\nProfile Management Commands:');
        console.log('  --profiles list                     List all profiles');
        console.log('  --profiles create --provider <n> --name <n> [--options <json>]');
        console.log('                                      Create a new profile');
        console.log('  --profiles delete --provider <n> --name <n>');
        console.log('                                      Delete a profile');
        console.log('  --profiles delete-all               Delete all profiles');
        console.log('\nHelp Options:');
        console.log('  --help                             Show help information');
        console.log('  --manual                           Show detailed manual\n');
    }

    /**
     * Show detailed manual with profile management information
     * @method showManual
     * @override
     */
    showManual() {
        console.log('\nProfile Management Manual:');
        console.log('\n1. Profile Management');
        console.log('   Profiles store provider-specific settings and data.');
        console.log('   Each profile is isolated from others.');
        console.log('\n2. Commands');
        console.log('   --profiles list: Show all available profiles');
        console.log('   --profiles create: Create a new empty profile');
        console.log('   --profiles delete: Remove a profile and its data');
        console.log('   --profiles delete-all: Remove all profiles and their data');
        console.log('\n3. Help');
        console.log('   Use --help for quick reference');
        console.log('   Use --manual for detailed documentation\n');
    }

    /**
     * List all available profiles
     * @method listProfiles
     * @throws {Error} If unable to read profiles directory
     */
    async listProfiles() {
        try {
            const profiles = await fs.readdir(this.profilesDir);
            
            if (profiles.length === 0) {
                console.log('\nNo profiles found.\n');
                return;
            }

            console.log('\nAvailable profiles:');
            for (const profile of profiles) {
                console.log(`  - ${profile}`);
            }
            console.log();
        } catch (error) {
            log.error('Error listing profiles:', error);
            throw error;
        }
    }

    /**
     * Create a new profile
     * @method createProfile
     * @param {string} provider - Provider name
     * @param {string} name - Profile name
     * @param {Object} [options] - Optional profile configuration
     * @throws {Error} If profile creation fails
     */
    async createProfile(provider, name, options = {}) {
        try {
            const profilePath = path.join(this.profilesDir, name);
            
            if (await fs.pathExists(profilePath)) {
                console.error(`Error: Profile '${name}' already exists`);
                return;
            }

            await fs.ensureDir(profilePath);
            await fs.writeJson(path.join(profilePath, 'config.json'), {
                provider,
                name,
                options,
                created: new Date().toISOString()
            }, { spaces: 2 });

            console.log(`\nCreated profile '${name}' for provider '${provider}'\n`);
        } catch (error) {
            log.error('Error creating profile:', error);
            throw error;
        }
    }

    /**
     * Delete an existing profile
     * @method deleteProfile
     * @param {string} provider - Provider name
     * @param {string} name - Profile name
     * @throws {Error} If profile deletion fails
     */
    async deleteProfile(provider, name) {
        try {
            const profilePath = path.join(this.profilesDir, name);
            
            if (!await fs.pathExists(profilePath)) {
                console.error(`Error: Profile '${name}' not found`);
                return;
            }

            await fs.remove(profilePath);
            console.log(`\nDeleted profile '${name}'\n`);
        } catch (error) {
            log.error('Error deleting profile:', error);
            throw error;
        }
    }

    /**
     * Delete all profiles
     * @method deleteAllProfiles
     * @throws {Error} If profile deletion fails
     */
    async deleteAllProfiles() {
        try {
            await fs.emptyDir(this.profilesDir);
            console.log('\nDeleted all profiles\n');
        } catch (error) {
            log.error('Error deleting all profiles:', error);
            throw error;
        }
    }
}

module.exports = ProfileCLI;
