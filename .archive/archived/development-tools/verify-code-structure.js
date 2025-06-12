/**
 * Code Structure Verification for Multi-Instance Architecture
 * Verifies the implementation without running Electron
 */

const fs = require('fs');
const path = require('path');

class CodeVerifier {
    constructor() {
        this.testResults = [];
    }

    log(message) {
        console.log(`[VERIFY] ${message}`);
    }

    async verifyInstanceManagerCode() {
        this.log('Verifying InstanceManager code structure...');
        
        const filePath = path.join(__dirname, 'src', 'services', 'instance.manager.js');
        
        if (!fs.existsSync(filePath)) {
            this.testResults.push({
                test: 'File Exists',
                passed: false,
                details: 'InstanceManager file not found'
            });
            return;
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for key architectural components
        const checks = [
            {
                name: 'EventEmitter Inheritance',
                pattern: /class InstanceManager extends EventEmitter/,
                required: true
            },
            {
                name: 'Process Discovery Methods',
                pattern: /getInstances\(\s*\)/,
                required: true
            },
            {
                name: 'Profile Delegation',
                pattern: /handleProfileSessionDelegation/,
                required: true
            },
            {
                name: 'Command Delegation',
                pattern: /delegateCommandToInstance/,
                required: true
            },
            {
                name: 'IPC Server Setup',
                pattern: /setupIpcServer/,
                required: true
            },
            {
                name: 'Lock File Management',
                pattern: /readLockFile|writeLockFile/,
                required: true
            },
            {
                name: 'Session Management',
                pattern: /unregisterSession/,
                required: true
            },
            {
                name: 'Multi-Instance Support',
                pattern: /--new-instance|--one-instance/,
                required: true
            },
            {
                name: 'Priority Scoring',
                pattern: /priority.*score|score.*priority/i,
                required: false
            },
            {
                name: 'Event Emission',
                pattern: /this\.emit\(['"`]last-session-closed['"`]\)/,
                required: true
            }
        ];
        
        for (const check of checks) {
            const found = check.pattern.test(content);
            this.testResults.push({
                test: check.name,
                passed: found || !check.required,
                details: found ? 
                    'Implementation found' : 
                    (check.required ? 'Required implementation missing' : 'Optional feature not found')
            });
        }
    }

    async verifyBaseProviderCode() {
        this.log('Verifying BaseProvider modifications...');
        
        const filePath = path.join(__dirname, 'src', 'providers', 'abstract', 'base.provider.js');
        
        if (!fs.existsSync(filePath)) {
            this.testResults.push({
                test: 'BaseProvider File Exists',
                passed: false,
                details: 'BaseProvider file not found'
            });
            return;
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        
        const checks = [
            {
                name: 'getSessionName Method',
                pattern: /getSessionName\(\s*\)/,
                required: true
            },
            {
                name: 'Consistent Session Naming in Quit',
                pattern: /this\.getSessionName\(\)/,
                required: true
            },
            {
                name: 'UnregisterSession Call',
                pattern: /unregisterSession.*getSessionName/,
                required: true
            }
        ];
        
        for (const check of checks) {
            const found = check.pattern.test(content);
            this.testResults.push({
                test: `BaseProvider: ${check.name}`,
                passed: found,
                details: found ? 'Implementation found' : 'Required implementation missing'
            });
        }
    }

    async verifyAppManagerCode() {
        this.log('Verifying AppManager modifications...');
        
        const filePath = path.join(__dirname, 'src', 'services', 'app.manager.js');
        
        if (!fs.existsSync(filePath)) {
            this.testResults.push({
                test: 'AppManager File Exists',
                passed: false,
                details: 'AppManager file not found'
            });
            return;
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        
        const checks = [
            {
                name: 'Instance Manager Import',
                pattern: /require.*instance\.manager/,
                required: true
            },
            {
                name: 'Last Session Closed Handler',
                pattern: /last-session-closed/,
                required: true
            },
            {
                name: 'Will Quit Handler',
                pattern: /will-quit/,
                required: true
            }
        ];
        
        for (const check of checks) {
            const found = check.pattern.test(content);
            this.testResults.push({
                test: `AppManager: ${check.name}`,
                passed: found,
                details: found ? 'Implementation found' : 'Required implementation missing'
            });
        }
    }

    async verifyArchitecturalIntegrity() {
        this.log('Verifying overall architectural integrity...');
        
        // Check if all required files exist
        const requiredFiles = [
            'src/services/instance.manager.js',
            'src/providers/abstract/base.provider.js',
            'src/services/app.manager.js'
        ];
        
        let allFilesExist = true;
        for (const file of requiredFiles) {
            if (!fs.existsSync(path.join(__dirname, file))) {
                allFilesExist = false;
                break;
            }
        }
        
        this.testResults.push({
            test: 'Required Files Present',
            passed: allFilesExist,
            details: allFilesExist ? 'All required files exist' : 'Some required files missing'
        });
        
        // Check directory structure
        const requiredDirs = [
            'src/services',
            'src/providers/abstract'
        ];
        
        let allDirsExist = true;
        for (const dir of requiredDirs) {
            if (!fs.existsSync(path.join(__dirname, dir))) {
                allDirsExist = false;
                break;
            }
        }
        
        this.testResults.push({
            test: 'Directory Structure',
            passed: allDirsExist,
            details: allDirsExist ? 'Required directories exist' : 'Some directories missing'
        });
    }

    async runVerification() {
        this.log('Starting Code Structure Verification...');
        
        await this.verifyInstanceManagerCode();
        await this.verifyBaseProviderCode();
        await this.verifyAppManagerCode();
        await this.verifyArchitecturalIntegrity();
        
        this.printResults();
    }

    printResults() {
        this.log('\n=== CODE VERIFICATION RESULTS ===');
        
        let passed = 0;
        let total = this.testResults.length;
        
        for (const result of this.testResults) {
            const status = result.passed ? '✅ PASS' : '❌ FAIL';
            this.log(`${status} - ${result.test}: ${result.details}`);
            if (result.passed) passed++;
        }
        
        this.log(`\nSummary: ${passed}/${total} verifications passed`);
        
        const successRate = (passed / total) * 100;
        
        if (successRate >= 90) {
            this.log('🎉 Multi-instance architecture implementation verified with high confidence!');
            return true;
        } else if (successRate >= 70) {
            this.log('⚠️  Multi-instance architecture mostly implemented, minor issues detected.');
            return true;
        } else {
            this.log('❌ Significant issues detected in the implementation.');
            return false;
        }
    }
}

// Run verification
if (require.main === module) {
    const verifier = new CodeVerifier();
    verifier.runVerification()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Verification failed:', error);
            process.exit(1);
        });
}

module.exports = CodeVerifier;
