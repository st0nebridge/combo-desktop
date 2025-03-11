const { app } = require('electron');
const log = require('electron-log');
const fs = require('fs');
const providerRegistry = require('../providers/provider.registry');

class ProviderCLI {
    constructor() {
        this.args = process.argv.slice(1);
    }

    parseConfig(configPath) {
        try {
            const configContent = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(configContent);
        } catch (error) {
            log.error('Error reading config file:', error);
            return null;
        }
    }

    parseProviderArgs() {
        const providers = [];
        const availableProviders = providerRegistry.getAvailableProviders();
        let i = 0;

        while (i < this.args.length) {
            const arg = this.args[i];
            const provider = availableProviders.find(p => p.commandArg === arg);
            
            if (provider) {
                // Check next argument for profile name
                const profile = (i + 1 < this.args.length && !this.args[i + 1].startsWith('--')) 
                    ? this.args[++i] 
                    : 'default';
                
                providers.push({
                    provider: provider.commandArg,
                    profile
                });
            }
            i++;
        }

        return providers;
    }

    shouldStartMinimized() {
        return this.args.includes('--tray');
    }

    shouldForceNewInstance() {
        return this.args.includes('--new-instance');
    }

    shouldUseOneInstance() {
        return this.args.includes('--one-instance');
    }

    getConfigFile() {
        const configIndex = this.args.indexOf('--config');
        if (configIndex !== -1 && configIndex + 1 < this.args.length) {
            return this.args[configIndex + 1];
        }
        return null;
    }

    getChromeVersion() {
        const versionIndex = this.args.indexOf('--chrome-version');
        if (versionIndex !== -1 && versionIndex + 1 < this.args.length) {
            return this.args[versionIndex + 1];
        }
        return null;
    }
}

module.exports = new ProviderCLI();
