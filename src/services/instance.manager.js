const { app } = require('electron');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const profileManager = require('./profile.manager');

class InstanceManager {
    constructor() {
        this.instanceLockFile = path.join(app.getPath('userData'), 'instance.lock');
        this.activeSessions = new Map(); // Map<sessionKey, instanceId>
        this.instanceId = null;
        this.isFirstInstance = false;
    }

    async initialize() {
        try {
            this.instanceId = Date.now().toString();
            this.isFirstInstance = app.requestSingleInstanceLock();
            
            if (this.isFirstInstance) {
                // Handle second instance launch
                app.on('second-instance', (event, argv) => {
                    this.handleSecondInstance(argv);
                });

                // Initialize lock file for active sessions
                await this.initializeLockFile();
            }

            return this.isFirstInstance;
        } catch (error) {
            log.error('Error initializing instance manager:', error);
            throw error;
        }
    }

    async initializeLockFile() {
        try {
            if (!fs.existsSync(this.instanceLockFile)) {
                await fs.promises.writeFile(this.instanceLockFile, JSON.stringify({
                    instances: {},
                    sessions: {}
                }));
            }
        } catch (error) {
            log.error('Error initializing lock file:', error);
            throw error;
        }
    }

    async getLockFileData() {
        try {
            const data = await fs.promises.readFile(this.instanceLockFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            log.error('Error reading lock file:', error);
            return { instances: {}, sessions: {} };
        }
    }

    async updateLockFile(data) {
        try {
            await fs.promises.writeFile(this.instanceLockFile, JSON.stringify(data, null, 2));
        } catch (error) {
            log.error('Error updating lock file:', error);
        }
    }

    async registerSession(providerName, profileName) {
        if (!profileName || profileName.trim() === '') {
            profileName = 'default';
        }

        // Use profile manager's partition name for consistent session keys
        const sessionKey = profileManager.getPartitionName(providerName, profileName);
        const lockData = await this.getLockFileData();

        // Register instance if not exists
        if (!lockData.instances[this.instanceId]) {
            lockData.instances[this.instanceId] = {
                startTime: Date.now(),
                sessions: []
            };
        }

        // Check if session exists in another instance
        if (lockData.sessions[sessionKey] && 
            lockData.sessions[sessionKey] !== this.instanceId) {
            return false;
        }

        // Register session
        lockData.sessions[sessionKey] = this.instanceId;
        lockData.instances[this.instanceId].sessions.push(sessionKey);
        
        await this.updateLockFile(lockData);
        this.activeSessions.set(sessionKey, this.instanceId);
        return true;
    }

    async unregisterSession(providerName, profileName) {
        if (!profileName || profileName.trim() === '') {
            profileName = 'default';
        }

        const sessionKey = profileManager.getPartitionName(providerName, profileName);
        const lockData = await this.getLockFileData();

        // Remove session registration
        delete lockData.sessions[sessionKey];
        
        // Update instance sessions
        if (lockData.instances[this.instanceId]) {
            lockData.instances[this.instanceId].sessions = 
                lockData.instances[this.instanceId].sessions.filter(s => s !== sessionKey);
        }

        await this.updateLockFile(lockData);
        this.activeSessions.delete(sessionKey);
    }

    async handleSecondInstance(argv) {
        // Parse arguments from second instance
        const providerCLI = require('../cli/provider-cli');
        providerCLI.args = argv.slice(1);
        
        const providers = providerCLI.parseProviderArgs();
        const forceNewInstance = providerCLI.shouldForceNewInstance();
        const useOneInstance = providerCLI.shouldUseOneInstance();

        if (forceNewInstance) {
            return false; // Allow new instance
        }

        // Check if any provider+profile combination exists in current instance
        const lockData = await this.getLockFileData();
        const sessionExists = providers.some(({ provider, profile }) => {
            const sessionKey = profileManager.getPartitionName(provider, profile || 'default');
            return lockData.sessions[sessionKey] === this.instanceId;
        });

        return !sessionExists && !useOneInstance;
    }

    async cleanup() {
        if (!this.instanceId) return;

        const lockData = await this.getLockFileData();
        
        // Remove all sessions for this instance
        Object.entries(lockData.sessions).forEach(([sessionKey, instanceId]) => {
            if (instanceId === this.instanceId) {
                delete lockData.sessions[sessionKey];
            }
        });

        // Remove instance data
        delete lockData.instances[this.instanceId];
        
        await this.updateLockFile(lockData);
    }
}

module.exports = new InstanceManager();
