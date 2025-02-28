const Store = require('electron-store');
const { app } = require('electron');
const log = require('electron-log');

class ProfileManager {
    constructor() {
        this.store = new Store({
            name: 'profiles',
            defaults: {
                profiles: {}
            }
        });
    }

    getPartitionName(providerName, profileName = 'default') {
        return `${app.getName()}:${providerName}:${profileName}`;
    }

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

    getProfile(providerName, profileName = 'default') {
        const partitionName = this.getPartitionName(providerName, profileName);
        const profiles = this.store.get('profiles');
        return profiles[partitionName];
    }

    getAllProfiles() {
        return this.store.get('profiles');
    }

    getProfilesByProvider(providerName) {
        const profiles = this.store.get('profiles');
        return Object.entries(profiles)
            .filter(([_, profile]) => profile.providerName === providerName)
            .reduce((acc, [key, value]) => {
                acc[key] = value;
                return acc;
            }, {});
    }

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

    deleteAllProfiles() {
        this.store.set('profiles', {});
        log.info('Deleted all profiles');
    }
}

module.exports = new ProfileManager();
