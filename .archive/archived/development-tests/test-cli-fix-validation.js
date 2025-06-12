#!/usr/bin/env node

/**
 * Validation script to test the CLI fix for the tray "Close Instance" issue
 * This script validates that the CLI routing fix works correctly
 */

const path = require('path');

// Mock electron to avoid GUI
global.isTest = true;
const electronMock = {
    app: {
        getPath: (name) => {
            if (name === 'userData') return 'm:\\Dev\\Tools\\combo-desktop\\temp-userdata';
            return 'm:\\Dev\\Tools\\combo-desktop\\temp';
        },
        getName: () => 'combo-desktop',
        quit: () => console.log('[APP] Application quit called')
    }
};

// Mock the electron module
require.cache[require.resolve('electron')] = {
    exports: electronMock
};

class CLIFixValidator {
    constructor() {
        this.passed = 0;
        this.failed = 0;
    }

    log(message) {
        console.log(`[CLI-FIX-TEST] ${message}`);
    }

    test(name, assertion, expected) {
        try {
            const result = assertion();
            if (result === expected) {
                this.log(`✅ ${name}`);
                this.passed++;
            } else {
                this.log(`❌ ${name} - Expected: ${expected}, Got: ${result}`);
                this.failed++;
            }
        } catch (error) {
            this.log(`❌ ${name} - Error: ${error.message}`);
            this.failed++;
        }
    }

    async testAsync(name, assertion, expected) {
        try {
            const result = await assertion();
            if (result === expected) {
                this.log(`✅ ${name}`);
                this.passed++;
            } else {
                this.log(`❌ ${name} - Expected: ${expected}, Got: ${result}`);
                this.failed++;
            }
        } catch (error) {
            this.log(`❌ ${name} - Error: ${error.message}`);
            this.failed++;
        }
    }

    async validateCLIFix() {
        this.log('=== Validating CLI Fix for Tray Close Instance Issue ===\n');

        // Clear require cache to get fresh instances
        delete require.cache[require.resolve('./src/cli/modules/profile-cli.js')];
        delete require.cache[require.resolve('./src/cli/modules/provider-cli.js')];
        delete require.cache[require.resolve('./src/cli/cli.registry.js')];
        delete require.cache[require.resolve('./src/cli/index.js')];

        // Test 1: ProfileCLI should NOT handle provider delegation args
        this.log('Test 1: ProfileCLI should reject provider delegation arguments');
        const ProfileCLI = require('./src/cli/modules/profile-cli.js');
        const profileCli = new ProfileCLI();
        
        const delegationArgs = ['--facebook', '--profile', 'default'];
        this.test(
            'ProfileCLI.canHandle(delegation args)', 
            () => profileCli.canHandle(delegationArgs), 
            false
        );

        // Test 2: ProfileCLI should handle profile management commands
        this.log('\nTest 2: ProfileCLI should handle profile management commands');
        const profileListArgs = ['--profile', 'list'];
        this.test(
            'ProfileCLI.canHandle(profile management)', 
            () => profileCli.canHandle(profileListArgs), 
            true
        );

        // Test 3: ProviderCLI should handle provider delegation args
        this.log('\nTest 3: ProviderCLI should handle provider delegation arguments');
        const ProviderCLI = require('./src/cli/modules/provider-cli.js');
        const providerCli = new ProviderCLI();
        
        this.test(
            'ProviderCLI.canHandle(delegation args)', 
            () => providerCli.canHandle(delegationArgs), 
            true
        );

        // Test 4: CLI Registry should route delegation args to ProviderCLI
        this.log('\nTest 4: CLI Registry should route delegation args to ProviderCLI');
        const cli = require('./src/cli/index.js');
        
        await this.testAsync(
            'CLI execution creates Facebook session in context',
            async () => {
                const result = await cli.execute(delegationArgs);
                return result.context && 
                       result.context.sessions && 
                       result.context.sessions.some(s => s.provider === 'facebook' && s.profile === 'default');
            },
            true
        );

        // Test 5: Verify session registration happens with proper flow
        this.log('\nTest 5: Verify session registration works directly');
        const instanceManager = require('./src/services/instance.manager.js');
        
        await this.testAsync(
            'Direct session registration',
            async () => {
                // Initialize instance manager if needed
                if (!instanceManager.instanceId) {
                    await instanceManager.init({ profile: 'default', profileIsolation: true });
                }
                
                // Register a test session
                const success = instanceManager.registerSession('facebook', 'default');
                
                // Check if session exists
                const sessionExists = instanceManager.providerSessions.has('facebook:default');
                
                // Cleanup
                if (sessionExists) {
                    await instanceManager.unregisterSession('facebook', 'default');
                }
                
                return success && sessionExists;
            },
            true
        );
    }

    async run() {
        try {
            await this.validateCLIFix();
            
            this.log(`\n=== CLI Fix Validation Results ===`);
            this.log(`✅ Passed: ${this.passed}`);
            this.log(`❌ Failed: ${this.failed}`);
            
            if (this.failed === 0) {
                this.log('🎉 All tests passed! CLI fix is working correctly.');
                this.log('\n📋 Summary:');
                this.log('- ProfileCLI no longer incorrectly claims provider delegation arguments');
                this.log('- ProviderCLI correctly handles provider delegation arguments');
                this.log('- CLI system properly routes delegation to ProviderCLI');
                this.log('- Session registration/unregistration works correctly');
                this.log('\n✅ The "Close Instance" tray issue should now be fixed!');
                return true;
            } else {
                this.log('❌ Some tests failed. CLI fix needs more work.');
                return false;
            }
        } catch (error) {
            this.log(`❌ Validation failed: ${error.message}`);
            console.error(error);
            return false;
        }
    }
}

// Run the validator
if (require.main === module) {
    const validator = new CLIFixValidator();
    
    validator.run()
        .then(success => {
            console.log('\nCLI fix validation completed');
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('CLI fix validation failed:', error);
            process.exit(1);
        });
}

module.exports = CLIFixValidator;
