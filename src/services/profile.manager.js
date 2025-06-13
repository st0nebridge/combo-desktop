/**
 * @file Profile management service that handles user profile storage,
 * retrieval, and migration across different application providers.
 */

const Store = require('electron-store');
const { app } = require('electron');
const log = require('electron-log');

// Import error recovery utilities
const { 
    ErrorCategory, 
    createError, 
    safeExecute, 
    logDiagnostics,
} = require('../utils/error-recovery');
const { createTransaction, withTransaction } = require('../utils/transaction');

/**
 * Service for managing user profiles.
 * Handles profile lifecycle and storage operations:
 * - Profile creation and deletion
 * - Profile data storage and retrieval
 * - Profile migration and updates
 * - Provider-specific profile management
 * @class ProfileManager
 */
class ProfileManager {
    /**
     * Creates a new ProfileManager instance
     * @constructor
     */
    constructor() {
        // Ensure app name is set before getting userData path
        if (!app || !app.name) {
            try {
                const packageJson = require('../../package.json');
                if (app) app.name = packageJson.name || 'desk-tray';
            } catch (error) {
                log.warn('Could not load package.json:', error);
                if (app) app.name = 'desk-tray';
            }
        }

        /** @property {Store} store - Electron store for profile data */
        this.store = new Store({
            name: 'profiles',
            defaults: {
                profiles: {}
            }
        });
        log.info('Profile Manager initialized');
    }

    /**
     * Initialize the profile manager and migrate old profiles
     * @method init
     * @returns {Promise<boolean>} True if initialization successful
     * @throws {Error} If initialization fails
     */
    async init() {
        const transaction = createTransaction('profile-manager-init');
        
        try {
            return await withTransaction(transaction, async () => {
                return await safeExecute(async () => {
                    // Migrate any old profiles if needed
                    await this.migrateOldProfiles();
                    log.info('Profile Manager initialization complete');
                    return true;
                }, {
                    errorMessage: 'Failed to initialize Profile Manager',
                    category: ErrorCategory.PROFILE_ERROR,
                    context: { storePath: this.store.path }
                });
            });
        } catch (error) {
            logDiagnostics('profile-manager-init-failed', { error });
            return false;
        }
    }

    /**
     * Migrate old profile format to new format if needed
     * @method migrateOldProfiles
     * @throws {Error} If migration fails
     */
    async migrateOldProfiles() {
        return await safeExecute(async () => {
            const profiles = this.store.get('profiles');
            let hasChanges = false;

            // Check each profile and update format if needed
            for (const [partitionName, profile] of Object.entries(profiles)) {
                if (!profile.createdAt) {
                    profile.createdAt = new Date().toISOString();
                    hasChanges = true;
                }

                if (!profile.options) {
                    profile.options = {};
                    hasChanges = true;
                }
            }

            // Save changes if any were made
            if (hasChanges) {
                this.store.set('profiles', profiles);
                log.info('Migrated old profiles to new format');
            }
        }, {
            errorMessage: 'Error migrating old profiles',
            category: ErrorCategory.PROFILE_ERROR,
            context: { storePath: this.store.path }
        });
    }

    /**
     * Get partition name for a provider and profile
     * @method getPartitionName
     * @param {string} providerName - Provider name
     * @param {string} [profileName='default'] - Profile name
     * @returns {string} Partition name in format appName:provider:profile
     */
    getPartitionName(providerName, profileName = 'default') {
        let appName = 'desk-tray';
        try {
            if (app && typeof app.getName === 'function') {
                appName = app.getName();
            }
        } catch (error) {
            log.warn('Error getting app name, using default', error);
        }
        return `${appName}:${providerName}:${profileName}`;
    }

    /**
     * Create a new profile for a provider
     * @method createProfile
     * @param {string} providerName - Provider name
     * @param {string} [profileName='default'] - Profile name
     * @param {Object} [options={}] - Profile options
     * @returns {string} Created partition name
     * @throws {Error} If profile already exists
     */
    createProfile(providerName, profileName = 'default', options = {}) {
        return safeExecute(() => {
            const profiles = this.store.get('profiles');
            const partitionName = this.getPartitionName(providerName, profileName);
            
            if (profiles[partitionName]) {
                throw createError(`Profile ${profileName} already exists for provider ${providerName}`, {
                    category: ErrorCategory.PROFILE_ERROR,
                    context: { providerName, profileName, partitionName }
                });
            }

            profiles[partitionName] = {
                providerName,
                profileName,
                options,
                createdAt: new Date().toISOString()
            };

            this.store.set('profiles', profiles);
            log.info(`Created profile: ${partitionName}`);
            return partitionName;
        }, {
            errorMessage: `Failed to create profile ${profileName} for provider ${providerName}`,
            category: ErrorCategory.PROFILE_ERROR,
            context: { providerName, profileName, options }
        });
    }

    /**
     * Get a profile by provider and name
     * @method getProfile
     * @param {string} providerName - Provider name
     * @param {string} [profileName='default'] - Profile name
     * @returns {Object|null} Profile data or null if not found
     */
    getProfile(providerName, profileName = 'default') {
        const partitionName = this.getPartitionName(providerName, profileName);
        const profiles = this.store.get('profiles');
        return profiles[partitionName] || null;
    }

    /**
     * Get all profiles
     * @method getAllProfiles
     * @returns {Object} Map of partition names to profile data
     */
    getAllProfiles() {
        return this.store.get('profiles');
    }

    /**
     * Get the currently active profile
     * @method getActiveProfile
     * @returns {Object|null} Active profile data or null if none found
     */
    getActiveProfile() {
        const profiles = this.store.get('profiles');
        for (const profile of Object.values(profiles)) {
            if (profile.active) {
                return {
                    name: profile.profileName,
                    provider: profile.providerName,
                    options: profile.options || {},
                    ...profile
                };
            }
        }
        return null; // No active profile found
    }

    /**
     * Get all profiles for a specific provider
     * @method getProfilesByProvider
     * @param {string} providerName - Provider name
     * @returns {Object} Map of partition names to profile data for provider
     */
    getProfilesByProvider(providerName) {
        const profiles = this.store.get('profiles');
        return Object.entries(profiles)
            .filter(([_, profile]) => profile.providerName === providerName)
            .reduce((acc, [key, value]) => {
                acc[key] = value;
                return acc;
            }, {});
    }

    /**
     * Delete a profile
     * @method deleteProfile
     * @param {string} providerName - Provider name
     * @param {string} [profileName='default'] - Profile name
     * @throws {Error} If profile does not exist
     */
    deleteProfile(providerName, profileName = 'default') {
        const partitionName = this.getPartitionName(providerName, profileName);
        const profiles = this.store.get('profiles');
        
        if (!profiles[partitionName]) {
            throw new Error(`Profile ${profileName} does not exist for provider ${providerName}`);
        }

        delete profiles[partitionName];
        this.store.set('profiles', profiles);
        log.info(`Deleted profile: ${partitionName}`);
    }

    /**
     * Delete all profiles
     * @method deleteAllProfiles
     */
    deleteAllProfiles() {
        this.store.set('profiles', {});
        log.info('Deleted all profiles');
    }
}

// Export a singleton instance
module.exports = new ProfileManager();
