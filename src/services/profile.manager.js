const Store = require('electron-store');
const { app } = require('electron');
const log = require('electron-log');

class ProfileManager {
    constructor() {
        // Ensure app name is set before getting userData path
        if (!app.name) {
            const packageJson = require('../../package.json');
            app.name = packageJson.name;
        }

        this.store = new Store({
            name: 'profiles',
            defaults: {
                profiles: {}
            }
        });
        log.info('Profile Manager initialized');
    }

    /**
     * Initialize the profile manager
     * @returns {Promise<boolean>} True if initialization successful
     */
    async init() {
        try {
            // Migrate any old profiles if needed
            await this.migrateOldProfiles();
            log.info('Profile Manager initialization complete');
            return true;
        } catch (error) {
            log.error('Failed to initialize Profile Manager:', error);
            return false;
        }
    }

    /**
     * Migrate old profile format to new format if needed
     */
    async migrateOldProfiles() {
        try {
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
        } catch (error) {
            log.error('Error migrating old profiles:', error);
            throw error;
        }
    }

    /**
     * Get partition name for a provider and profile
     * @param {string} providerName - Provider name
     * @param {string} profileName - Profile name
     * @returns {string} Partition name
     */
    getPartitionName(providerName, profileName = 'default') {
        return `${app.getName()}:${providerName}:${profileName}`;
    }

    /**
     * Create a new profile
     * @param {string} providerName - Provider name
     * @param {string} profileName - Profile name
     * @param {Object} options - Profile options
     * @returns {string} Partition name
     */
    createProfile(providerName, profileName = 'default', options = {}) {
        const profiles = this.store.get('profiles');
        const partitionName = this.getPartitionName(providerName, profileName);
        
        if (profiles[partitionName]) {
            throw new Error(`Profile ${profileName} already exists for provider ${providerName}`);
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
    }

    /**
     * Get a profile by provider and name
     * @param {string} providerName - Provider name
     * @param {string} profileName - Profile name
     * @returns {Object|null} Profile data
     */
    getProfile(providerName, profileName = 'default') {
        const partitionName = this.getPartitionName(providerName, profileName);
        const profiles = this.store.get('profiles');
        return profiles[partitionName] || null;
    }

    /**
     * Get all profiles
     * @returns {Object} All profiles
     */
    getAllProfiles() {
        return this.store.get('profiles');
    }

    /**
     * Get all profiles for a provider
     * @param {string} providerName - Provider name
     * @returns {Object} Provider profiles
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
     * @param {string} providerName - Provider name
     * @param {string} profileName - Profile name
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
     */
    deleteAllProfiles() {
        this.store.set('profiles', {});
        log.info('Deleted all profiles');
    }
}

module.exports = new ProfileManager();
