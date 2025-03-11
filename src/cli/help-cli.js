const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const providerRegistry = require('../providers/provider.registry');

class HelpCLI {
    constructor() {
        this.program = new Command();
        this.setupCommands();
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
                            console.log(`Unknown topic: ${options.manual}`);
                            this.showGeneralHelp();
                            break;
                        }
                    }
                }
            });
    }

    showGeneralHelp() {
        console.log('\nCombo Desktop Help\n');
        console.log('Available Commands:');
        console.log('  yarn start          Start the application');
        console.log('  yarn whatsapp       Start WhatsApp directly');
        console.log('  yarn facebook       Start Facebook Messenger directly');
        console.log('  yarn profiles       Manage application profiles');
        console.log('  yarn manual         Show this help information');
        console.log('\nFor more specific help, try:');
        console.log('  yarn manual providers   Information about messaging providers');
        console.log('  yarn manual profiles    Profile management help');
        console.log('  yarn manual flags       Available CLI flags\n');
    }

    showProvidersHelp() {
        console.log('\nAvailable Providers:\n');
        const providers = providerRegistry.getAvailableProviders();
        
        for (const provider of providers) {
            console.log(`${provider.name}:`);
            console.log(`  Command: ${provider.commandArg}`);
            console.log(`  Usage: yarn start ${provider.commandArg} [profile-name]`);
            console.log('');
        }
    }

    showProfilesHelp() {
        console.log('\nProfile Management:\n');
        console.log('Commands:');
        console.log('  yarn profiles list              List all available profiles');
        console.log('  yarn start --whatsapp profile1  Start WhatsApp with specific profile');
        console.log('  yarn start --facebook profile2  Start Facebook with specific profile\n');
        console.log('Notes:');
        console.log('- Profiles allow running multiple instances with different configurations');
        console.log('- Each profile maintains its own cache and settings');
        console.log('- Use --new-instance flag to force a new profile instance\n');
    }

    showFlagsHelp() {
        console.log('\nAvailable CLI Flags:\n');
        console.log('  --tray            Start application minimized to tray');
        console.log('  --new-instance    Force new instance regardless of existing ones');
        console.log('  --one-instance    Allow only one instance to run');
        console.log('  --reset-lock      Reset the instance lock file');
        console.log('  --config <path>   Use specific configuration file');
        console.log('  --version         Show version information');
        console.log('  --help            Show help information\n');
    }

    run(args) {
        this.program.parse(args);
    }
}

module.exports = new HelpCLI();
