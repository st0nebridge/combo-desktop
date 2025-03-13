/**
 * @file CLI Verbose Test Runner
 * @description Runs all CLI module tests with detailed verbose logging
 */

const fs = require('fs');
const path = require('path');

// Set up environment for tests
process.env.NODE_ENV = 'test';
process.env.CLI_TEST_VERBOSE = 'true'; // Enable verbose logging

// Ensure electron-mock is loaded first
require('../electron-mock');

console.log('Using mocked Electron app with name:', process.env.APP_NAME || 'desk-tray');
console.log('Verbose logging is enabled');
console.log('');

// Get all test files
const testDir = path.join(__dirname, 'modules');
const testFiles = fs.readdirSync(testDir).filter(file => file.endsWith('.test.js'));

/**
 * Run a single test file
 * @param {string} testFile - The test file to run
 * @returns {Promise<boolean>} - Whether the test passed
 */
async function runTestFile(testFile) {
    const testPath = path.join(testDir, testFile);
    const testName = path.basename(testFile, '.test.js');
    
    console.log(`\n🧪 Running test: ${testFile}`);
    
    try {
        // Import the test module
        const testModule = require(testPath);
        
        // Run the tests
        if (typeof testModule.runTests === 'function') {
            const result = await testModule.runTests();
            
            if (result) {
                console.log(`✅ Test passed: ${testFile}`);
                return true;
            } else {
                console.error(`❌ Test failed: ${testFile}`);
                return false;
            }
        } else {
            console.error(`❌ No runTests function found in ${testFile}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ Test failed: ${testFile}`);
        console.error(`   Error: ${error.message}`);
        return false;
    }
}

/**
 * Run all tests
 */
async function runAllTests() {
    const results = {};
    let allPassed = true;
    
    for (const testFile of testFiles) {
        const passed = await runTestFile(testFile);
        results[testFile] = passed;
        
        if (!passed) {
            allPassed = false;
        }
        
        // Add a separator between test files for better readability
        console.log('-'.repeat(80));
    }
    
    console.log('\n=== Test Summary ===');
    if (allPassed) {
        console.log('Status: ✅ All tests passed.');
    } else {
        console.log('Status: ❌ Some tests failed:');
        for (const [file, passed] of Object.entries(results)) {
            if (!passed) {
                console.log(`  - ${file}`);
            }
        }
    }
    
    // Exit with appropriate code
    process.exit(allPassed ? 0 : 1);
}

// Add handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit the process as we're handling it
});

// Run all tests
runAllTests().catch(error => {
    console.error('Error running tests:', error);
    process.exit(1);
});
