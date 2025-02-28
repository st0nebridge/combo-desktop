const { app, dialog } = require('electron');
const log = require('electron-log');
const profileManager = require('../services/profile.manager');

class ProfileCLI {
    constructor() {
        this.commands = new Map([
            ['list', this.listProfiles.bind(this)],
            ['create', this.createProfile.bind(this)],
            ['delete', this.deleteProfile.bind(this)],
            ['delete-all', this.deleteAllProfiles.bind(this)]
        ]);
    }

    async handleCommand(args) {
        const command = args[0];
        const handler = this.commands.get(command);
        
        if (!handler) {
            console.log('Available commands:');
            console.log('  list [--provider <n>]');
            console.log('  create --provider <n> --name <n>');
            console.log('  delete --provider <n> --name <n>');
            console.log('  delete-all');
            app.exit(0);
        }

        try {
            await handler(args.slice(1));
            app.exit(0);
        } catch (error) {
            dialog.showErrorBox('Profile Manager Error', error.message);
            log.error('Profile CLI error:', error);
            app.exit(1);
        }
    }

    // Format data as a table with proper spacing
    formatAsTable(data) {
        if (!data || data.length === 0) {
            return '';
        }
        
        // Get all column names
        const columns = Object.keys(data[0]);
        
        // Calculate column widths (minimum width is the header length)
        const columnWidths = {};
        columns.forEach(col => {
            columnWidths[col] = col.length;
            data.forEach(row => {
                const cellValue = String(row[col] || '');
                columnWidths[col] = Math.max(columnWidths[col], cellValue.length);
            });
        });
        
        // Create header row
        let output = '\n';
        let headerRow = '';
        let separatorRow = '';
        
        columns.forEach(col => {
            const width = columnWidths[col];
            headerRow += col.padEnd(width + 2);
            separatorRow += '-'.repeat(width) + '  ';
        });
        
        output += headerRow + '\n';
        output += separatorRow + '\n';
        
        // Create data rows
        data.forEach(row => {
            let dataRow = '';
            columns.forEach(col => {
                const cellValue = String(row[col] || '');
                dataRow += cellValue.padEnd(columnWidths[col] + 2);
            });
            output += dataRow + '\n';
        });
        
        return output;
    }

    async listProfiles(args) {
        const providerArg = args.indexOf('--provider');
        const provider = providerArg !== -1 ? args[providerArg + 1] : null;
        
        const profiles = provider 
            ? profileManager.getProfilesByProvider(provider)
            : profileManager.getAllProfiles();

        // Ensure default profiles are listed
        const providers = provider ? [provider] : ['WhatsApp', 'Facebook'];
        for (const p of providers) {
            const defaultPartition = profileManager.getPartitionName(p, 'default');
            if (!profiles[defaultPartition]) {
                profiles[defaultPartition] = {
                    providerName: p,
                    profileName: 'default',
                    options: {},
                    createdAt: 'Not yet created - will be created automatically'
                };
            }
        }

        // Format the output for better display
        const formattedProfiles = Object.entries(profiles).map(([partition, profile]) => ({
            Provider: profile.providerName,
            Profile: profile.profileName,
            'Created At': profile.createdAt,
            Partition: partition,
            Status: profile.createdAt.includes('Not yet created') ? 'Pending' : 'Active'
        }));

        if (formattedProfiles.length === 0) {
            console.log('No profiles found.');
            return;
        }

        // Sort by provider and profile name
        formattedProfiles.sort((a, b) => {
            const providerCompare = a.Provider.localeCompare(b.Provider);
            if (providerCompare !== 0) return providerCompare;
            
            // Always put default profiles first
            if (a.Profile === 'default') {
                return -1;
            }
            if (b.Profile === 'default') {
                return 1;
            }
            
            return a.Profile.localeCompare(b.Profile);
        });

        console.log('\nProfile List:');
        console.log(this.formatAsTable(formattedProfiles));
    }

    async createProfile(args) {
        const providerArg = args.indexOf('--provider');
        const nameArg = args.indexOf('--name');
        const optionsArg = args.indexOf('--options');

        if (providerArg === -1 || nameArg === -1) {
            throw new Error('Required arguments: --provider <n> --name <n>');
        }

        const provider = args[providerArg + 1];
        const name = args[nameArg + 1];
        const options = optionsArg !== -1 ? JSON.parse(args[optionsArg + 1]) : {};

        const partition = profileManager.createProfile(provider, name, options);
        console.log(`Created profile with partition: ${partition}`);
    }

    async deleteProfile(args) {
        const providerArg = args.indexOf('--provider');
        const nameArg = args.indexOf('--name');

        if (providerArg === -1 || nameArg === -1) {
            throw new Error('Required arguments: --provider <n> --name <n>');
        }

        const provider = args[providerArg + 1];
        const name = args[nameArg + 1];

        if (name === 'default') {
            throw new Error('Cannot delete default profile');
        }

        profileManager.deleteProfile(provider, name);
        console.log(`Deleted profile: ${name} for provider ${provider}`);
    }

    async deleteAllProfiles(args) {
        const response = await dialog.showMessageBox({
            type: 'warning',
            buttons: ['Cancel', 'Delete All'],
            defaultId: 0,
            title: 'Delete All Profiles',
            message: 'Are you sure you want to delete all profiles? Default profiles will be preserved.',
            detail: 'This action cannot be undone.'
        });

        if (response.response === 1) {
            const profiles = profileManager.getAllProfiles();
            for (const [partition, profile] of Object.entries(profiles)) {
                if (profile.profileName !== 'default') {
                    profileManager.deleteProfile(profile.providerName, profile.profileName);
                }
            }
            console.log('All non-default profiles deleted');
        }
    }
}

module.exports = new ProfileCLI();
