/**
 * @file CLI Verbose Test Runner
 * @description Runs CLI tests with proper verbose logging
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Set up environment for tests
process.env.NODE_ENV = 'test';
process.env.CLI_TEST_VERBOSE = 'true';

// Get all test files
const testDir = path.join(__dirname, 'modules');
const testFiles = fs.readdirSync(testDir).filter(file => file.endsWith('.test.js'));

console.log('Running CLI tests with verbose logging enabled...\n');

let allPassed = true;
const results = {};

// Run each test file in a separate process
for (const testFile of testFiles) {
    const testPath = path.join(testDir, testFile);
    const testName = path.basename(testFile, '.test.js');
    
    console.log(`\n🧪 Running test: ${testFile}`);
    console.log('-'.repeat(80));
    
    try {
        // Run the test in a separate process with proper environment variables
        execSync(`node "${testPath}"`, {
            env: {
                ...process.env,
                NODE_ENV: 'test',
                CLI_TEST_VERBOSE: 'true'
            },
            stdio: 'inherit' // Show output directly
        });
        
        console.log(`\n✅ Test passed: ${testFile}`);
        results[testFile] = true;
    } catch (error) {
        console.error(`\n❌ Test failed: ${testFile}`);
        console.error(`   Error: ${error.message}`);
        results[testFile] = false;
        allPassed = false;
    }
    
    console.log('-'.repeat(80));
}

// Print summary
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
