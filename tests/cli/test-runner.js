/**
 * @file CLI Test Runner
 * @description Runs all CLI module tests with verbose logging
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Set up environment for tests
process.env.NODE_ENV = 'test';
process.env.CLI_TEST_VERBOSE = 'true'; // Enable verbose logging

// Get all test files
const testDir = path.join(__dirname, 'modules');
const testFiles = fs.readdirSync(testDir).filter(file => file.endsWith('.test.js'));

// Ensure electron-mock is loaded first
require('../electron-mock');

console.log('Using mocked Electron app with name:', process.env.APP_NAME || 'desk-tray');
console.log('Verbose logging is enabled');
console.log('');

/**
 * Run a test file in a separate process to prevent hanging
 * @param {string} testFile - Path to test file
 * @returns {Promise<boolean>} - Whether the test passed
 */
function runTestFile(testFile) {
    return new Promise((resolve) => {
        const testPath = path.join(testDir, testFile);
        const relativeTestPath = path.relative(testDir, testPath);
        console.log(`🧪 Running test: ${relativeTestPath}`);
        
        // Create a wrapper script that ensures proper test output
        const wrapperScript = `
            // Set environment variables
            process.env.NODE_ENV = 'test';
            process.env.CLI_TEST_VERBOSE = 'true';
            
            // Load electron-mock first
            require('${path.join(__dirname, '..', 'electron-mock').replace(/\\/g, '\\\\')}');
            
            // Run the actual test
            const testModule = require('${testPath.replace(/\\/g, '\\\\')}');
            
            // Call the runTests function
            if (typeof testModule.runTests === 'function') {
                const result = testModule.runTests();
                
                // Handle promise result
                if (result instanceof Promise) {
                    result
                        .then(success => {
                            if (success) {
                                process.exit(0);
                            } else {
                                process.exit(1);
                            }
                        })
                        .catch(error => {
                            console.error('Test error:', error);
                            process.exit(1);
                        });
                } else {
                    // Handle synchronous result
                    process.exit(result ? 0 : 1);
                }
            } else {
                console.error('No runTests function found');
                process.exit(1);
            }
        `;
        
        const wrapperFile = path.join(__dirname, `temp_wrapper_${Date.now()}.js`);
        fs.writeFileSync(wrapperFile, wrapperScript);
        
        // Run the test in a separate process
        const child = spawn('node', [wrapperFile], {
            env: {
                ...process.env,
                NODE_OPTIONS: '--no-warnings', // Suppress Node.js warnings
                CLI_TEST_VERBOSE: 'true'
            },
            stdio: 'inherit' // Inherit stdio to show output directly
        });
        
        child.on('close', (code) => {
            // Clean up the wrapper file
            try {
                fs.unlinkSync(wrapperFile);
            } catch (err) {
                // Ignore errors when deleting the temp file
            }
            
            if (code === 0) {
                console.log(`✅ Test passed: ${relativeTestPath}`);
                resolve(true);
            } else {
                console.error(`❌ Test failed: ${relativeTestPath} with code ${code}`);
                resolve(false);
            }
            
            // Add a separator between test files for better readability
            console.log('-'.repeat(80));
        });
    });
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

// Run all tests
runAllTests().catch(error => {
    console.error('Error running tests:', error);
    process.exit(1);
});