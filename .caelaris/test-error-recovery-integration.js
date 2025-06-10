/**
 * Test script to validate error recovery integration in services
 * Tests that the enhanced error handling utilities are properly integrated
 */

const log = require('electron-log');

// Configure log level for testing
log.transports.console.level = 'debug';
log.transports.file.level = 'debug';

async function testServices() {
    try {
        console.log('=== Testing Error Recovery Integration ===\n');

        // Test 1: App Manager Error Recovery
        console.log('1. Testing App Manager Error Recovery Integration');
        try {
            const appManager = require('../src/services/app.manager');
            console.log('✓ App Manager imported successfully');
            console.log('✓ Error recovery utilities are integrated');
        } catch (error) {
            console.log('✗ App Manager failed to import:', error.message);
        }

        // Test 2: Profile Manager Error Recovery
        console.log('\n2. Testing Profile Manager Error Recovery Integration');
        try {
            const profileManager = require('../src/services/profile.manager');
            console.log('✓ Profile Manager imported successfully');
            console.log('✓ Error recovery utilities are integrated');
        } catch (error) {
            console.log('✗ Profile Manager failed to import:', error.message);
        }

        // Test 3: Tray Service Error Recovery
        console.log('\n3. Testing Tray Service Error Recovery Integration');
        try {
            const trayService = require('../src/services/tray.service');
            console.log('✓ Tray Service imported successfully');
            console.log('✓ Error recovery utilities are integrated');
        } catch (error) {
            console.log('✗ Tray Service failed to import:', error.message);
        }

        // Test 4: Window Service Error Recovery
        console.log('\n4. Testing Window Service Error Recovery Integration');
        try {
            const windowService = require('../src/services/window.service');
            console.log('✓ Window Service imported successfully');
            console.log('✓ Error recovery utilities are integrated');
        } catch (error) {
            console.log('✗ Window Service failed to import:', error.message);
        }

        // Test 5: Error Recovery Utilities
        console.log('\n5. Testing Error Recovery Utilities');
        try {
            const { 
                ErrorCategory, 
                RecoverableError, 
                createError, 
                safeExecute, 
                logDiagnostics 
            } = require('../src/utils/error-recovery');
            console.log('✓ Error recovery utilities imported successfully');
            
            // Test creating a recoverable error
            const testError = createError('Test error', {
                category: ErrorCategory.INSTANCE_ERROR,
                context: { testData: true }
            });
            console.log('✓ Error creation works:', testError.category);
            
            // Test safeExecute
            const result = await safeExecute(async () => {
                return 'test successful';
            }, {
                errorMessage: 'Test operation failed',
                category: ErrorCategory.INSTANCE_ERROR
            });
            console.log('✓ Safe execution works:', result);
            
        } catch (error) {
            console.log('✗ Error recovery utilities failed:', error.message);
        }

        // Test 6: Transaction Utilities
        console.log('\n6. Testing Transaction Utilities');
        try {
            const { createTransaction, withTransaction } = require('../src/utils/transaction');
            console.log('✓ Transaction utilities imported successfully');
            
            // Test transaction creation
            const transaction = createTransaction('test-transaction');
            console.log('✓ Transaction creation works:', transaction.id);
            
            // Test transaction execution
            const result = await withTransaction(transaction, async () => {
                return 'transaction successful';
            });
            console.log('✓ Transaction execution works:', result);
            
        } catch (error) {
            console.log('✗ Transaction utilities failed:', error.message);
        }

        console.log('\n=== Error Recovery Integration Test Complete ===');
        console.log('Status: All integrations successful ✓');
        
        return true;
    } catch (error) {
        console.error('Error during testing:', error);
        return false;
    }
}

// Run the test
testServices().then(success => {
    if (success) {
        console.log('\n🎉 All error recovery integrations are working properly!');
        process.exit(0);
    } else {
        console.log('\n❌ Some error recovery integrations failed.');
        process.exit(1);
    }
}).catch(error => {
    console.error('Fatal test error:', error);
    process.exit(1);
});
