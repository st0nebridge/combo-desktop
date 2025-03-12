const log = require('electron-log');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class InstanceCLI {
    constructor() {
        this.args = process.argv.slice(2);
        this.instanceLockFile = path.join(app.getPath('userData'), 'instance.lock');
        this.pidFile = path.join(app.getPath('userData'), 'pids.json');
        log.info('Instance CLI initialized');
    }

    /**
     * Parse instance-specific arguments
     * @returns {Object} Parsed arguments { command, subcommand, instanceId }
     */
    parseArgs() {
        const result = {
            command: null,
            subcommand: null,
            instanceId: null
        };

        let i = 0;
        while (i < this.args.length) {
            const arg = this.args[i];

            // Skip non-instance flags
            if (this.isCliFlag(arg)) {
                i++;
                continue;
            }

            // Handle instance commands
            if (arg === '--instances') {
                if (i + 1 < this.args.length) {
                    result.command = 'instances';
                    result.subcommand = this.args[i + 1];
                    
                    // Check for instance ID
                    if (i + 2 < this.args.length && !this.args[i + 2].startsWith('--')) {
                        result.instanceId = this.args[i + 2];
                        i += 3;
                    } else {
                        i += 2;
                    }
                } else {
                    i++;
                }
                continue;
            }

            i++;
        }

        return result;
    }

    /**
     * Check if an argument is a CLI flag
     * @param {string} arg - The argument to check
     * @returns {boolean} True if the argument is a CLI flag
     */
    isCliFlag(arg) {
        const instanceFlags = [
            '--instances',
            '--reset-lock'
        ];
        return instanceFlags.includes(arg);
    }

    /**
     * Check if this is a CLI command that shouldn't register a PID
     * @returns {boolean} True if this is a CLI command
     */
    isCliCommand() {
        const args = this.parseArgs();
        return args.command === 'instances' || this.args.includes('--reset-lock');
    }

    /**
     * Check if instance lock should be reset
     * @returns {boolean} True if --reset-lock argument is present
     */
    shouldResetLock() {
        return this.args.includes('--reset-lock');
    }

    /**
     * Get lock file data
     * @returns {Promise<Object>} Lock file data
     */
    async getLockFileData() {
        try {
            if (!fs.existsSync(this.instanceLockFile)) {
                return { instances: {}, sessions: {} };
            }

            const data = await fs.promises.readFile(this.instanceLockFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            log.error('Error reading lock file:', error);
            return { instances: {}, sessions: {} };
        }
    }

    /**
     * Get PIDs from PID file
     * @returns {Promise<Array<number>>} Array of PIDs
     */
    async getPids() {
        try {
            if (!fs.existsSync(this.pidFile)) {
                return [];
            }

            const data = await fs.promises.readFile(this.pidFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            log.error('Error reading PID file:', error);
            return [];
        }
    }

    /**
     * List all running instances
     */
    async listInstances() {
        try {
            const lockData = await this.getLockFileData();
            const pids = await this.getPids();

            console.log('\nRunning Instances:\n');

            if (Object.keys(lockData.instances).length === 0) {
                console.log('No instances running.\n');
                return;
            }

            for (const [instanceId, instance] of Object.entries(lockData.instances)) {
                console.log(`Instance ${instanceId}:`);
                console.log(`  Profile: ${instance.profile || 'default'}`);
                console.log('  Providers:');
                
                const providerSessions = instance.sessions || [];
                if (providerSessions.length === 0) {
                    console.log('    No providers');
                } else {
                    for (const session of providerSessions) {
                        const providerName = session.split(':')[0];
                        console.log(`    - ${providerName}`);
                    }
                }
                console.log('');
            }
        } catch (error) {
            log.error('Error listing instances:', error);
            console.error('Failed to list instances:', error.message);
        }
    }

    /**
     * Show detailed instance status
     */
    async showInstanceStatus() {
        try {
            const lockData = await this.getLockFileData();
            const pids = await this.getPids();

            console.log('\nInstance Status:\n');

            if (Object.keys(lockData.instances).length === 0) {
                console.log('No instances running.\n');
                return;
            }

            console.log('Active Sessions:');
            for (const [sessionKey, instanceId] of Object.entries(lockData.sessions)) {
                console.log(`  ${sessionKey} -> Instance ${instanceId}`);
            }

            console.log('\nInstance Details:');
            for (const [instanceId, instance] of Object.entries(lockData.instances)) {
                console.log(`\nInstance ${instanceId}:`);
                console.log(`  Profile: ${instance.profile || 'default'}`);
                console.log(`  Start Time: ${new Date(instance.startTime).toLocaleString()}`);
                console.log('  Sessions:');
                for (const session of instance.sessions || []) {
                    console.log(`    - ${session}`);
                }
            }

            if (pids.length > 0) {
                console.log('\nProcess IDs:');
                for (const pid of pids) {
                    console.log(`  - ${pid}`);
                }
            }
            console.log('');
        } catch (error) {
            log.error('Error showing instance status:', error);
            console.error('Failed to show instance status:', error.message);
        }
    }

    /**
     * Kill a specific instance or all instances
     * @param {string} [instanceId] - Optional instance ID to kill
     */
    async killInstance(instanceId) {
        try {
            const instanceManager = require('../services/instance.manager');
            
            if (!instanceId) {
                await instanceManager.killAllInstances();
                console.log('All instances have been terminated.\n');
                return;
            }

            const lockData = await this.getLockFileData();
            if (!lockData.instances[instanceId]) {
                console.error(`Instance ${instanceId} not found.\n`);
                return;
            }

            await instanceManager.killInstance(instanceId);
            console.log(`Instance ${instanceId} has been terminated.\n`);
        } catch (error) {
            log.error('Error killing instance:', error);
            console.error('Failed to kill instance:', error.message);
        }
    }

    /**
     * Execute instance CLI command
     */
    async execute() {
        const args = this.parseArgs();
        
        if (args.command === 'instances') {
            switch (args.subcommand) {
                case 'list':
                    await this.listInstances();
                    break;
                case 'status':
                    await this.showInstanceStatus();
                    break;
                case 'kill':
                    await this.killInstance(args.instanceId);
                    break;
                default:
                    console.error('Unknown instances subcommand:', args.subcommand);
                    break;
            }
        } else if (this.shouldResetLock()) {
            const instanceManager = require('../services/instance.manager');
            await instanceManager.resetLock();
        }
    }
}

module.exports = new InstanceCLI();
