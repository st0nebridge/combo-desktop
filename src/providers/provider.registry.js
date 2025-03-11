const fs = require('fs');
const path = require('path');

class ProviderRegistry {
    constructor() {
        this.providers = new Map();
        this.autoRegisterProviders();
    }

    register(ProviderClass) {
        const tempProvider = new ProviderClass(); // No longer need window for metadata
        const commandArg = tempProvider.getCommandArg();
        this.providers.set(commandArg, ProviderClass);
        return this;
    }

    autoRegisterProviders() {
        const providersDir = __dirname;
        const files = fs.readdirSync(providersDir);
        
        files.forEach(file => {
            // Skip non-provider files
            if (file === 'base.provider.js' || 
                file === 'provider.registry.js' || 
                !file.endsWith('.provider.js')) {
                return;
            }

            try {
                const ProviderClass = require(path.join(providersDir, file));
                // Only register if it extends BaseProvider
                const tempProvider = new ProviderClass();
                if (tempProvider.getCommandArg && tempProvider.getName) {
                    this.register(ProviderClass);
                }
            } catch (error) {
                console.error(`Error loading provider from ${file}:`, error);
            }
        });
    }

    createProvider(args) {
        // Find the matching provider based on command line arguments
        for (const [arg, ProviderClass] of this.providers) {
            if (args.includes(arg)) {
                return new ProviderClass();
            }
        }

        // Get available provider commands for error message
        const availableCommands = Array.from(this.providers.entries())
            .map(([arg, ProviderClass]) => {
                const provider = new ProviderClass();
                return `${arg} (${provider.getName()})`;
            })
            .join(', ');

        throw new Error(
            `No provider specified. Please use one of the following command arguments:\n${availableCommands}`
        );
    }

    getAvailableProviders() {
        return Array.from(this.providers.entries()).map(([arg, ProviderClass]) => {
            const tempProvider = new ProviderClass();
            return {
                name: tempProvider.getName(),
                commandArg: arg
            };
        });
    }
}

module.exports = new ProviderRegistry(); // Export a singleton instance
