/**
 * @file CLI Test Runner
 * @description Main entry point for running all CLI tests
 */

const path = require('path');
const fs = require('fs');
const { runTestsInDirectory } = require('./cli/test-runner');
const { mockService } = require('./cli/test-utils');
const electronMock = require('./electron-mock');

// Mock electron module before running tests
const restoreElectron = mockService('electron', electronMock);
console.log('Using mocked Electron app with name:', electronMock.app.name);

/**
 * Run all CLI tests
 */
async function runAllTests() {
    console.log('🧪 Running all CLI tests...');
    
    try {
        const startTime = Date.now();

        // Create fixtures directory for userData
        fs.mkdirSync(path.join(__dirname, 'fixtures/userData'), { recursive: true });
        
        // Run all tests in the CLI directory
        const cliDir = path.join(__dirname, 'cli');
        await runTestsInDirectory(cliDir);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n⏱️ All tests completed in ${duration}s`);
        
        // Restore original electron module
        restoreElectron();
        
        // Exit with success
        process.exit(0);
    } catch (error) {
        console.error('Error running tests:', error);
        process.exit(1);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().catch(error => {
        console.error('Unhandled error in test runner:', error);
        process.exit(1);
    });
}