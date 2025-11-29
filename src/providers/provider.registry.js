/**
 * @module providers/registry
 * @description Provider registry that manages registration, validation, and creation
 * of service providers across the application.
 * 
 * @input {Class} ProviderClass - Provider class extending BaseProvider
 * @input {string} providerName - Provider command argument or name
 * @output {BaseProvider} provider - Instantiated provider instance
 * 
 * @dependencies
 * - providers/abstract/base.provider - Base provider interface
 * - services/instance.manager - Instance management
 * 
 * @example
 * const providerRegistry = require('./providers');
 * const provider = providerRegistry.getProvider('--whatsapp');
 * providerRegistry.register(MyCustomProvider);
 */

const fs = require('fs');
const path = require('path');
const log = require('electron-log');
const instanceManager = require('../services/instance.manager');

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
     * Get a provider instance by name
     * @method getProvider
     * @param {string} providerName - Name of the provider to get
     * @returns {BaseProvider|null} Provider instance or null if not found
     */
    getProvider(providerName) {
        if (!providerName) {
            log.error('Provider name is required');
            return null;
        }

        // Remove leading -- if present
        const cleanName = providerName.replace(/^--/, '');
        
        // Try to find existing provider
        for (const [key, Provider] of this.providers) {
            const instance = new Provider();
            if (instance.getCommandArg().replace(/^--/, '') === cleanName) {
                log.debug(`Found provider for command: ${cleanName}`);
                return instance;
            }
        }

        log.error(`No provider found for command: ${cleanName}`);
        return null;
    }

    /**
     * Create a new provider instance
     * @method createProvider
     * @param {string} providerName - Name of the provider to create
     * @returns {BaseProvider|null} New provider instance or null if invalid
     * @deprecated Use getProvider instead
     */
    createProvider(providerName) {
        return this.getProvider(providerName);
    }

    /**
     * Auto-register all provider modules
     * @method autoRegisterProviders
     * @private
     */
    autoRegisterProviders() {
        try {
            const providersDir = __dirname;
            const providerFiles = this.findProviderFiles(providersDir);

            for (const file of providerFiles) {
                try {
                    const Provider = require(file);
                    const instance = new Provider();

                    // Validate required methods
                    const requiredMethods = [
                        'getName',
                        'getCommandArg',
                        'getPartitionName',
                        'getUrl'
                    ];

                    const missingMethods = requiredMethods.filter(
                        method => !instance[method] || typeof instance[method] !== 'function'
                    );

                    if (missingMethods.length > 0) {
                        log.error(`Provider ${file} missing required methods: ${missingMethods.join(', ')}`);
                        continue;
                    }

                    // Register valid provider
                    const name = instance.getName();
                    this.providers.set(name, Provider);
                    log.info(`Auto-registered provider: ${name}`);
                } catch (error) {
                    log.error(`Error loading provider ${file}:`, error);
                }
            }

            log.info(`Registered ${this.providers.size} providers`);
        } catch (error) {
            log.error('Error auto-registering providers:', error);
            throw error;
        }
    }

    /**
     * Find all provider files recursively
     * @method findProviderFiles
     * @param {string} dir - Directory to search in
     * @returns {string[]} Array of provider file paths
     * @private
     */
    findProviderFiles(dir) {
        let results = [];
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            if (fs.statSync(fullPath).isDirectory()) {
                results = results.concat(this.findProviderFiles(fullPath));
            } else if (item.endsWith('.provider.js') && 
                      item !== 'base.provider.js') {
                results.push(fullPath);
            }
        }
        return results;
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
                    commandArg: provider.getCommandArg(),
                    spawn: async (profile = 'default', options = {}) => {
                        try {
                            let new_provider = new ProviderClass();
                            await new_provider.initializeProvider(profile, options);
                            if (!new_provider.window) {
                                throw new Error(`Failed to initialize window for ${provider.getName()} with profile ${profile}`);
                            }
                            
                            // Register the session with the instance manager
                            const sessionRegistered = instanceManager.registerSession(provider.getName(), profile);
                            if (!sessionRegistered) {
                                log.warn(`Failed to register session for ${provider.getName()}:${profile}`);
                            } else {
                                log.info(`Successfully registered session for ${provider.getName()}:${profile}`);
                            }
                            
                            return new_provider;
                        } catch (error) {
                            log.error(`Error spawning provider ${provider.getName()}:`, error);
                            throw error;
                        }
                    }
                };
            });
        } catch (error) {
            log.error('Error getting available providers:', error);
            throw error;
        }
    }
}

// Export a singleton instance
module.exports = new ProviderRegistry();
