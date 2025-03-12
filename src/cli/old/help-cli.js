const { Command } = require('commander');
const log = require('electron-log');
const providerRegistry = require('../providers/provider.registry');

class HelpCLI {
    constructor() {
        this.program = new Command();
        this.setupCommands();
        this.execMode = this.detectExecutionMode();
        log.info('Help CLI initialized with mode:', this.execMode);
    }

    detectExecutionMode() {
        try {
            // Check if running through package manager
            if (process.env.npm_execpath) {
                if (process.env.npm_execpath.includes('yarn')) {
                    return { type: 'package_manager', manager: 'yarn' };
                }
                return { type: 'package_manager', manager: 'npm' };
            }

            // Check if this is a development environment (running through electron)
            const exeName = process.execPath.toLowerCase().split(/[\\/]/).pop();
            if (exeName === 'electron.exe') {
                return { type: 'development', executable: 'electron .' };
            }

            // This is a compiled executable
            return { type: 'compiled', executable: exeName };
        } catch (error) {
            log.error('Error detecting execution mode:', error);
            return { type: 'development', executable: 'electron .' }; // Safe fallback
        }
    }

    formatCommand(command, includeFlag = true) {
        if (this.execMode.type === 'package_manager') {
            // For yarn/npm, show the script name without flags
            return `${this.execMode.manager} ${command}`;
        }

        // For development or compiled exe, show with flags
        const exe = this.execMode.executable;
        return `${exe}${includeFlag ? ` ${command}` : ''}`;
    }

    formatManualCommand(topic) {
        if (this.execMode.type === 'package_manager') {
            return `${this.execMode.manager} manual${topic ? ` ${topic}` : ''}`;
        }
        return `${this.execMode.executable} --manual${topic ? ` ${topic}` : ''}`;
    }

    formatProviderCommand(commandArg, profile) {
        if (this.execMode.type === 'package_manager') {
            // For yarn/npm, strip the -- prefix and use script name
            const providerCommand = commandArg.replace(/^--/, '');
            return `${this.execMode.manager} ${providerCommand}${profile ? ` ${profile}` : ''}`;
        }
        // For development or compiled exe, use full flag format
        return `${this.execMode.executable} ${commandArg}${profile ? ` ${profile}` : ''}`;
    }

    setupCommands() {
        this.program
            .name('combo-desktop')
            .description('Combo Desktop Help System');

        // Handle help topics directly without subcommands
        this.program
            .option('--manual [topic]', 'Show help for specific topic')
            .action((options) => {
                if (!options.manual || options.manual === true) {
                    this.showGeneralHelp();
                } else {
                    switch (options.manual.toLowerCase()) {
                        case 'providers': {
                            this.showProvidersHelp();
                            break;
                        }
                        case 'profiles': {
                            this.showProfilesHelp();
                            break;
                        }
                        case 'flags': {
                            this.showFlagsHelp();
                            break;
                        }
                        default: {
                            log.warn('Unknown help topic requested:', options.manual);
                            console.log(`Unknown topic: ${options.manual}`);
                            this.showGeneralHelp();
                            break;
                        }
                    }
                }
            });
    }

    showGeneralHelp() {
        log.debug('Showing general help');
        console.log('\nCombo Desktop Help\n');

        // Show package manager specific commands if in yarn/npm mode
        if (this.execMode.type === 'package_manager') {
            console.log('Package Manager Commands:');
            console.log(`  ${this.formatCommand('start')}          Start the application`);
            console.log(`  ${this.formatCommand('whatsapp')}       Start WhatsApp directly`);
            console.log(`  ${this.formatCommand('facebook')}       Start Facebook Messenger directly`);
            console.log(`  ${this.formatCommand('manual')}         Show this help information`);
            console.log('');
        }

        // Show CLI flags for all modes
        console.log('Available Flags:');
        console.log('  --tray            Start application minimized to tray');
        console.log('  --new-instance    Force new instance regardless of existing ones');
        console.log('  --one-instance    Allow only one instance to run');
        console.log('  --reset-lock      Reset the instance lock file');
        console.log('  --config <path>   Use specific configuration file');
        console.log('  --manual          Show this help information');
        console.log('  --help            Show help information');
        console.log('  --version         Show version information');

        // Show provider flags
        const providers = providerRegistry.getAvailableProviders();
        if (providers && providers.length > 0) {
            console.log('\nProvider Flags:');
            for (const provider of providers) {
                console.log(`  ${provider.commandArg}         Start ${provider.name}`);
            }
        }

        console.log('\nFor more specific help, try:');
        console.log(`  ${this.formatManualCommand('providers')}   Information about messaging providers`);
        console.log(`  ${this.formatManualCommand('profiles')}    Profile management help`);
        console.log(`  ${this.formatManualCommand('flags')}       Available CLI flags\n`);
    }

    showProvidersHelp() {
        log.debug('Showing providers help');
        console.log('\nAvailable Providers:\n');
        const providers = providerRegistry.getAvailableProviders();
        
        if (!providers || providers.length === 0) {
            log.warn('No providers available');
            console.log('No providers are currently available.\n');
            return;
        }
        
        for (const provider of providers) {
            console.log(`${provider.name}:`);
            console.log(`  Command: ${provider.commandArg}`);
            console.log(`  Usage: ${this.formatProviderCommand(provider.commandArg, '[profile-name]')}`);
            console.log('');
        }

        if (this.execMode.type === 'package_manager') {
            console.log('Package Manager Usage:');
            console.log(`  ${this.formatCommand('whatsapp')} [profile]     Start WhatsApp`);
            console.log(`  ${this.formatCommand('facebook')} [profile]    Start Facebook\n`);
        }
    }

    showProfilesHelp() {
        log.debug('Showing profiles help');
        console.log('\nProfile Management:\n');

        console.log('Usage:');
        console.log(`  ${this.formatProviderCommand('--whatsapp', 'profile1')}  Start WhatsApp with specific profile`);
        console.log(`  ${this.formatProviderCommand('--facebook', 'profile2')}  Start Facebook with specific profile`);

        if (this.execMode.type === 'package_manager') {
            console.log('\nPackage Manager Commands:');
            console.log(`  ${this.formatCommand('profiles')} list              List all available profiles`);
        }

        console.log('\nProfile Flags:');
        console.log('  --new-instance    Force new profile instance');
        console.log('  --config <path>   Use specific configuration file');

        console.log('\nNotes:');
        console.log('- Profiles allow running multiple instances with different configurations');
        console.log('- Each profile maintains its own cache and settings');
        console.log('- Use --new-instance flag to force a new profile instance\n');
    }

    showFlagsHelp() {
        log.debug('Showing flags help');
        console.log('\nAvailable CLI Flags:\n');
        console.log('  --tray            Start application minimized to tray');
        console.log('  --new-instance    Force new instance regardless of existing ones');
        console.log('  --one-instance    Allow only one instance to run');
        console.log('  --reset-lock      Reset the instance lock file');
        console.log('  --config <path>   Use specific configuration file');
        console.log('  --version         Show version information');
        console.log('  --help            Show help information');
        console.log('  --manual          Show help information\n');

        const providers = providerRegistry.getAvailableProviders();
        if (providers && providers.length > 0) {
            console.log('Provider Flags:');
            for (const provider of providers) {
                console.log(`  ${provider.commandArg}         Start ${provider.name}`);
            }
            console.log('');
        }

        if (this.execMode.type === 'package_manager') {
            console.log('Package Manager Commands:');
            console.log(`  ${this.formatCommand('start')}          Start the application`);
            console.log(`  ${this.formatCommand('whatsapp')}       Start WhatsApp directly`);
            console.log(`  ${this.formatCommand('facebook')}       Start Facebook Messenger directly`);
            console.log(`  ${this.formatCommand('manual')}         Show this help information\n`);
        }
    }

    run(args) {
        try {
            this.program.parse(args);
        } catch (error) {
            log.error('Error parsing command line arguments:', error);
            this.showGeneralHelp();
        }
    }
}

module.exports = new HelpCLI();
