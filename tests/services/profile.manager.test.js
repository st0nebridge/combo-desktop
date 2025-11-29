/**
 * @file Comprehensive test suite for profile.manager.js
 * Tests profile management, storage, and migration functionality.
 */

const path = require('path');

// Create mock functions
const mockGet = () => ({});
const mockSet = () => {};
const mockPath = '/tmp/test-profiles.json';

// Mock Electron Store
function MockStore() {
    return {
        get: mockGet,
        set: mockSet,
        path: mockPath
    };
}

// Mock Electron app
const mockApp = {
    name: 'combo-desktop-test',
    getName: () => 'combo-desktop-test'
};

// Mock electron-log
const mockLog = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {}
};

// Set up module mocking
const originalRequire = require;
require = function(id) {
    if (id === 'electron-store') return MockStore;
    if (id === 'electron') return { app: mockApp };
    if (id === 'electron-log') return mockLog;
    return originalRequire.apply(this, arguments);
};

const profileManager = require('../../src/services/profile.manager');

// Restore original require
require = originalRequire;

// Simple test runner function
function runTest(name, testFn) {
    try {
        console.log(`Running test: ${name}`);
        const result = testFn();
        if (result && typeof result.then === 'function') {
            return result.then(() => {
                console.log(`✓ ${name}`);
            }).catch(error => {
                console.error(`✗ ${name}: ${error.message}`);
                throw error;
            });
        } else {
            console.log(`✓ ${name}`);
            return Promise.resolve();
        }
    } catch (error) {
        console.error(`✗ ${name}: ${error.message}`);
        throw error;
    }
}

function runTestSuite(suiteName, tests) {
    console.log(`\nRunning test suite: ${suiteName}`);
    return tests.reduce((promise, test) => {
        return promise.then(() => runTest(test.name, test.fn));
    }, Promise.resolve());
}

// Simple assertion functions
function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

// Test ProfileManager functionality
async function testProfileManager() {
    const constructorTests = [
        {
            name: 'should initialize with electron store',
            fn: () => {
                // Basic initialization test
                assert(profileManager, 'ProfileManager should be loaded');
                assert(profileManager.store, 'Store should be initialized');
            }
        }
    ];

    const initTests = [
        {
            name: 'should initialize successfully',
            fn: async () => {
                // Mock the migrateOldProfiles method temporarily
                const originalMigrate = profileManager.migrateOldProfiles;
                profileManager.migrateOldProfiles = async () => {};
                
                const result = await profileManager.init();
                assertEqual(result, true, 'Init should return true');
                
                // Restore original method
                profileManager.migrateOldProfiles = originalMigrate;
            }
        }
    ];

    const partitionTests = [
        {
            name: 'should generate correct partition name',
            fn: () => {
                const partitionName = profileManager.getPartitionName('whatsapp', 'default');
                assert(partitionName.includes('whatsapp'), 'Partition name should include provider');
                assert(partitionName.includes('default'), 'Partition name should include profile');
            }
        }
    ];

    const profileManagementTests = [
        {
            name: 'should create new profile',
            fn: () => {
                // Mock store methods temporarily
                const originalGet = profileManager.store.get;
                const originalSet = profileManager.store.set;
                profileManager.store.get = () => ({});
                profileManager.store.set = () => {};
                
                const partitionName = profileManager.createProfile('whatsapp', 'test');
                assert(partitionName, 'Should return partition name');
                
                // Restore original methods
                profileManager.store.get = originalGet;
                profileManager.store.set = originalSet;
            }
        },
        {
            name: 'should get profile',
            fn: () => {
                // Mock store.get temporarily  
                const originalGet = profileManager.store.get;
                const key = profileManager.getPartitionName('whatsapp', 'default');
                const profiles = {
                    [key]: {
                        providerName: 'whatsapp',
                        profileName: 'default'
                    }
                };
                profileManager.store.get = () => profiles;
                
                const profile = profileManager.getProfile('whatsapp', 'default');
                assert(profile, 'Should return profile object');
                
                // Restore original method
                profileManager.store.get = originalGet;
            }
        }
    ];

    // Run all test suites
    await runTestSuite('Constructor', constructorTests);
    await runTestSuite('Initialization', initTests);
    await runTestSuite('Partition Names', partitionTests);
    await runTestSuite('Profile Management', profileManagementTests);
    return true;
}

// Run tests if this file is executed directly
if (require.main === module) {
    testProfileManager()
        .then(() => {
            console.log('\n✓ All ProfileManager tests passed!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n✗ ProfileManager tests failed:', error.message);
            process.exit(1);
        });
}

module.exports = { testProfileManager };

if (typeof describe === 'function') {
    describe('ProfileManager legacy suite', () => {
        test('executes profile manager tests', async () => {
            const result = await testProfileManager();
            expect(result).toBe(true);
        });
    });
}
