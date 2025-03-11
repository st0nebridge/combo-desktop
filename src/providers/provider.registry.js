const fs = require('fs');
const path = require('path');
const log = require('electron-log');

class ProviderRegistry {
    constructor() {
        this.providers = new Map();
        this.autoRegisterProviders();
    }

    register(ProviderClass) {
        try {
            const tempProvider = new ProviderClass();
            const commandArg = tempProvider.getCommandArg();
            if (!commandArg) {
                log.error('Provider missing command argument');
                return this;
            }
            this.providers.set(commandArg, ProviderClass);
            log.info(`Registered provider: ${tempProvider.getName()} (${commandArg})`);
        } catch (error) {
            log.error('Error registering provider:', error);
        }
        return this;
    }

    autoRegisterProviders() {
        const providersDir = __dirname;
        
        try {
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
                    if (tempProvider.getCommandArg && tempProvider.getName && tempProvider.getPartitionName) {
                        this.register(ProviderClass);
                    } else {
                        log.error(`Provider ${file} does not implement required methods`);
                    }
                } catch (error) {
                    log.error(`Error loading provider from ${file}:`, error);
                }
            });
        } catch (error) {
            log.error('Error reading providers directory:', error);
        }
    }

    createProvider(args) {
        try {
            if (!Array.isArray(args)) {
                log.error('Invalid arguments passed to createProvider');
                return null;
            }

            // Find the matching provider based on command line arguments
            for (const [arg, ProviderClass] of this.providers) {
                if (args.includes(arg)) {
                    const provider = new ProviderClass();
                    if (typeof provider.getPartitionName !== 'function') {
                        log.error(`Provider ${provider.getName()} does not implement getPartitionName`);
                        return null;
                    }
                    return provider;
                }
            }

            // Get available provider commands for error message
            const availableCommands = Array.from(this.providers.entries())
                .map(([arg, ProviderClass]) => {
                    const provider = new ProviderClass();
                    return `${arg} (${provider.getName()})`;
                })
                .join(', ');

            log.error(`No provider specified. Available providers: ${availableCommands}`);
            return null;
        } catch (error) {
            log.error('Error creating provider:', error);
            return null;
        }
    }

    getAvailableProviders() {
        try {
            return Array.from(this.providers.entries()).map(([arg, ProviderClass]) => {
                const tempProvider = new ProviderClass();
                return {
                    name: tempProvider.getName(),
                    commandArg: arg
                };
            });
        } catch (error) {
            log.error('Error getting available providers:', error);
            return [];
        }
    }
}

module.exports = new ProviderRegistry();
