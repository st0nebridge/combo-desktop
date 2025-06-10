/**
 * Temporary stub for instance manager to allow application to run
 * while the main instance.manager.js file is being fixed
 */
const log = require('../services/logging.service');
const path = require('path');
const os = require('os');

// Create a minimal stub for the instance manager
class InstanceManagerStub {
    constructor() {
        log.warn('Using InstanceManagerStub - limited functionality available');
        this.ipcPipeName = `\\\\.\\pipe\\desk-tray-${process.pid}`;
    }

    async init({ profile, profileIsolation }) {
        log.info(`InstanceManagerStub: init called with profile: ${profile}, profileIsolation: ${profileIsolation}`);
        return true;
    }

    async processSessions(sessions, forceNewInstance, oneInstance, profileIsolation) {
        log.info('InstanceManagerStub: processSessions called');
        // Return all sessions as local sessions
        return {
            localSessions: sessions || [],
            delegatedSessions: []
        };
    }

    async delegateSessions(sessions, profileIsolation) {
        log.info('InstanceManagerStub: delegateSessions called');
        // Pretend delegation failed, so sessions are handled locally
        return false;
    }

    // Add other required methods with stub implementations
    async cleanup() {
        log.info('InstanceManagerStub: cleanup called');
        return true;
    }

    registerCleanupHandlers() {
        log.info('InstanceManagerStub: registerCleanupHandlers called');
    }
    
    /**
     * Register a provider session
     * @method registerSession
     * @param {string} name - Provider name
     * @param {string} profile - Provider profile
     * @returns {Promise<void>}
     */
    async registerSession(name, profile) {
        log.info(`InstanceManagerStub: registerSession called for ${name}:${profile}`);
        return true;
    }
    
    /**
     * Unregister a provider session
     * @method unregisterSession
     * @param {string} name - Provider name
     * @param {string} profile - Provider profile
     * @returns {Promise<void>}
     */
    async unregisterSession(name, profile) {
        log.info(`InstanceManagerStub: unregisterSession called for ${name}:${profile}`);
        return true;
    }

    async createInstanceTransaction(name, options = {}) {
        log.info(`InstanceManagerStub: createInstanceTransaction called with name: ${name}`);
        // Return a minimal transaction object
        return {
            id: `stub-tx-${Date.now()}`,
            name,
            step: async (stepName, fn) => {
                log.info(`InstanceManagerStub: step ${stepName} called`);
                try {
                    if (typeof fn === 'function') {
                        return await fn();
                    }
                } catch (error) {
                    log.error(`InstanceManagerStub: error in step ${stepName}`, error);
                }
            },
            commit: () => {
                log.info(`InstanceManagerStub: transaction committed`);
            },
            rollback: async () => {
                log.info(`InstanceManagerStub: transaction rolled back`);
            },
            addMetadata: (key, value) => {
                log.info(`InstanceManagerStub: addMetadata called with key: ${key}`);
            }
        };
    }
}

module.exports = new InstanceManagerStub();
