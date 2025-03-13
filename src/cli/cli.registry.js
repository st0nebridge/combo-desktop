/**
 * @file CLI Registry that manages CLI modules and command execution
 */

const log = require('../services/logging.service');
const instanceManager = require('../services/instance.manager');

/**
 * CLI Registry that manages CLI modules and command execution
 */
class CLIRegistry {
    /**
     * Creates a new CLIRegistry instance
     * @constructor
     */
    constructor() {
        /** @type {Map<string, Object>} */
        this.modules = new Map();
        this.initialized = false;
        this.lastParsedArgs = null;
        log.info('CLI Registry initialized');
    }

    /**
     * Clear all registered modules
     * @method clear
     */
    clear() {
        this.modules.clear();
        this.lastParsedArgs = null;
        log.info('CLI Registry cleared');
    }

    /**
     * Register a CLI module
     * @method register
     * @param {Object} module - CLI module to register
     * @returns {boolean} True if registration successful
     */
    register(module) {
        try {
            if (!module || typeof module !== 'object') {
                log.error('Invalid CLI module: module must be an object');
                return false;
            }

            const requiredMethods = ['execute', 'parseArgs', 'showUsage'];
            const missingMethods = requiredMethods.filter(
                method => !module[method] || typeof module[method] !== 'function'
            );

            if (missingMethods.length > 0) {
                log.error(`Invalid CLI module: missing required methods: ${missingMethods.join(', ')}`);
                return false;
            }

            const name = module.constructor.name;
            if (!name) {
                log.error('Invalid CLI module: missing constructor name');
                return false;
            }

            // Check if module is already registered
            if (this.modules.has(name)) {
                log.debug(`CLI module ${name} already registered, skipping duplicate registration`);
                return true;
            }

            this.modules.set(name, module);
            log.info(`Registered CLI module: ${name}`);
            return true;
        } catch (error) {
            log.error('Error registering CLI module:', error);
            return false;
        }
    }

    /**
     * Execute CLI command with given arguments
     * @method execute
     * @param {Array<string>} args - Command line arguments
     * @returns {Promise<{success: boolean, isCliCommand: boolean, processedProviders: Array<string>}>}
     */
    async execute(args) {
        if (!args || args.length === 0) {
            log.info('No arguments provided, showing help');
            this.showHelp();
            return { success: true, isCliCommand: true, processedProviders: [] };
        }

        try {
            // Remove electron and script path from args if present
            const cliArgs = args.slice(process.defaultApp ? 2 : 1);
            log.debug('CLI arguments:', cliArgs);

            // Check for help flag first
            if (cliArgs.includes('--help') || cliArgs.includes('--manual')) {
                this.showHelp();
                return { success: true, isCliCommand: true, processedProviders: [] };
            }

            // Initialize instance manager
            await instanceManager.ensureDirectories();

            // Handle special flags first
            const hasResetLock = cliArgs.includes('--reset-lock');
            const hasNewInstance = cliArgs.includes('--new-instance');
            const hasOneInstance = cliArgs.includes('--one-instance');

            // Handle reset-lock command first
            if (hasResetLock) {
                log.info('Resetting instance locks');
                await instanceManager.resetLock();
                return { success: true, isCliCommand: true, processedProviders: [] };
            }

            // Check if this is a CLI command that should be delegated
            const shouldDelegate = !hasNewInstance && !hasOneInstance && await this.shouldDelegateCommand(cliArgs);
            if (shouldDelegate) {
                log.info('Delegating command to existing instance');
                await instanceManager.delegateCommand(cliArgs);
                return { success: true, isCliCommand: true, processedProviders: [] };
            }

            // Track if any module successfully handled arguments
            let anySuccess = false;
            let isCliCommand = true;
            let processedProviders = [];
            
            // Try each module until one successfully handles the command
            for (const [name, module] of this.modules) {
                try {
                    const result = await module.parseArgs(cliArgs);
                    if (result) {
                        log.info(`CLI command detected in module: ${name}`);
                        
                        // Store parsed args for app initialization
                        this.lastParsedArgs = result;

                        // Execute command
                        const success = await module.execute(result);
                        if (success) {
                            anySuccess = true;
                            // If any module is not a CLI command, mark the overall result as not a CLI command
                            if (module.isCliCommand && typeof module.isCliCommand === 'function') {
                                isCliCommand = isCliCommand && module.isCliCommand();
                            }
                            
                            // If this is a provider module, track processed providers
                            if (name === 'ProviderCLI' && result.providers && result.providers.length > 0) {
                                processedProviders = processedProviders.concat(result.providers);
                            }
                            
                            // Stop processing other modules since this one handled the command
                            break;
                        } else {
                            log.error(`Command execution failed in module: ${name}`);
                            module.showUsage();
                        }
                    }
                } catch (error) {
                    log.error(`Error in module ${name}:`, error);
                    module.showUsage();
                }
            }

            if (!anySuccess) {
                log.warn('No module found to handle arguments:', cliArgs);
                this.showHelp();
                return { success: false, isCliCommand: true, processedProviders: [] };
            }

            return { success: true, isCliCommand, processedProviders };
        } catch (error) {
            log.error('Error executing CLI command:', error);
            this.showHelp();
            throw error;
        }
    }

    /**
     * Check if command should be delegated to existing instance
     * @method shouldDelegateCommand
     * @param {Array<string>} args - Command line arguments
     * @returns {Promise<boolean>} True if command should be delegated
     */
    async shouldDelegateCommand(args) {
        try {
            // Never delegate help or manual commands
            if (args.includes('--help') || args.includes('--manual')) {
                return false;
            }

            // Never delegate if --new-instance flag is present
            if (args.includes('--new-instance')) {
                return false;
            }

            // Never delegate if --one-instance flag is present
            if (args.includes('--one-instance')) {
                return false;
            }

            // Never delegate if --reset-lock flag is present
            if (args.includes('--reset-lock')) {
                return false;
            }

            // Never delegate instance management commands
            if (args.includes('--instances')) {
                return false;
            }

            // Check if this is a profile command
            if (args.includes('--profiles')) {
                // Only delegate if it's not a list/create/delete command
                const profileCommands = ['list', 'create', 'delete', 'delete-all'];
                const hasProfileCommand = profileCommands.some(cmd => args.includes(cmd));
                return !hasProfileCommand;
            }

            // Check if there's an existing instance that can handle this command
            const hasExistingInstance = await instanceManager.hasRunningInstance();
            if (!hasExistingInstance) {
                return false;
            }

            // Get profile from command line arguments
            const profileIndex = args.findIndex(arg => arg.startsWith('--') && arg !== '--profiles');
            const profile = profileIndex >= 0 && profileIndex + 1 < args.length ? args[profileIndex + 1] : 'default';

            // Check if existing instance can handle this profile
            const canHandleProfile = await instanceManager.canHandleProfile(profile);
            if (!canHandleProfile) {
                return false;
            }

            // By default, delegate to existing instance if one exists and can handle the profile
            return true;
        } catch (error) {
            log.error('Error checking command delegation:', error);
            return false;
        }
    }

    /**
     * Get last successfully parsed arguments
     * @method getLastParsedArgs
     * @returns {Object|null} Last parsed arguments or null if none
     */
    getLastParsedArgs() {
        return this.lastParsedArgs;
    }

    /**
     * Show help for all registered modules
     * @method showHelp
     */
    showHelp() {
        console.log(`
Combo Desktop - Multi-Provider Chat Client

Usage:
  yarn start [options] [command]

Standard Flags:
  --help                    Show this help information
  --version                 Show version information
  --manual [topic]         Show detailed help (topics: providers, profiles, flags)
  --tray                   Start application minimized to tray
  --new-instance           Force new instance creation
  --one-instance           Allow only one instance to run
  --reset-lock             Reset instance locks
  --config <path>          Specify config file path

For more information on specific commands, use:
  yarn start --help
  yarn start --manual [topic]
`);
    }
}

// Export singleton instance
module.exports = new CLIRegistry();
