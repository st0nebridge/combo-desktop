/**
 * @file Provider registry that manages registration, validation, and creation
 * of service providers across the application.
 */

const fs = require('fs');
const path = require('path');
const log = require('electron-log');

/**
 * Service for managing provider registration and lifecycle.
 * Handles provider operations and validation:
 * - Auto-registration of providers from modules directory
 * - Provider validation and creation
 * - Provider lookup and enumeration
 * - Required method enforcement
 * @class ProviderRegistry
 */
class ProviderRegistry {
    /**
     * Creates a new ProviderRegistry instance
     * @constructor
     */
    constructor() {
        /** @property {Map<string, Class>} providers - Map of provider command args to provider classes */
        this.providers = new Map();
        this.autoRegisterProviders();
    }

    /**
     * Register a provider class
     * @method register
     * @param {Class} ProviderClass - Provider class to register
     * @returns {ProviderRegistry} this for chaining
     * @throws {Error} If provider validation fails
     */
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

    /**
     * Auto-register all providers in the modules directory
     * @method autoRegisterProviders
     * @throws {Error} If provider registration fails
     */
    autoRegisterProviders() {
        const providersDir = path.join(__dirname, 'modules');
        
        try {
            const files = fs.readdirSync(providersDir);
            
            files.forEach(file => {
                // Skip non-provider files
                if (file === 'base.provider.js' || 
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

    /**
     * Create a provider instance by command arg
     * @method createProvider
     * @param {string} providerArg - Command line argument for the provider
     * @returns {Object|null} Provider instance or null if not found
     * @throws {Error} If provider creation fails
     */
    createProvider(providerArg) {
        try {
            // Convert arg to lowercase for case-insensitive lookup
            const normalizedArg = providerArg.toLowerCase();
            
            // Add -- prefix if not present
            const arg = normalizedArg.startsWith('--') ? normalizedArg : `--${normalizedArg}`;

            // Get provider class
            const ProviderClass = this.providers.get(arg);
            if (!ProviderClass) {
                const available = Array.from(this.providers.keys())
                    .map(key => `${key} (${new this.providers.get(key)().getName()})`)
                    .join(', ');
                log.error(`Provider ${arg} not found. Available: ${available}`);
                return null;
            }

            // Create and validate provider instance
            const provider = new ProviderClass();
            if (!this.validateProvider(provider)) {
                log.error(`Provider ${arg} failed validation`);
                return null;
            }

            // Initialize provider
            provider.initialize();
            return provider;
        } catch (error) {
            log.error('Error creating provider:', error);
            return null;
        }
    }

    /**
     * Validate a provider instance implements all required methods
     * @method validateProvider
     * @param {Object} provider - Provider instance to validate
     * @returns {boolean} True if provider is valid
     * @throws {Error} If provider validation fails
     */
    validateProvider(provider) {
        const required = ['getName', 'getCommandArg', 'getPartitionName', 'getUrl'];
        for (const method of required) {
            if (typeof provider[method] !== 'function') {
                log.error(`Provider ${provider.constructor.name} missing required method: ${method}`);
                return false;
            }
        }
        return true;
    }

    /**
     * Get list of available providers
     * @method getAvailableProviders
     * @returns {Array<Object>} List of provider info objects with name and commandArg
     * @throws {Error} If provider enumeration fails
     */
    getAvailableProviders() {
        try {
            return Array.from(this.providers.entries()).map(([arg, ProviderClass]) => {
                const provider = new ProviderClass();
                return {
                    name: provider.getName(),
                    commandArg: arg
                };
            });
        } catch (error) {
            log.error('Error getting available providers:', error);
            return [];
        }
    }
}

// Export a singleton instance
module.exports = new ProviderRegistry();
