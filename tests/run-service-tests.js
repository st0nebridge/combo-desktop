#!/usr/bin/env node

/**
 * Service Test Runner
 * Runs all the newly created service and utility tests
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Test file configurations
const testFiles = [
    'tests/services/app.manager.test.js',
    'tests/services/profile.manager.test.js', 
    'tests/services/window.service.test.js',
    'tests/services/tray.service.test.js',
    'tests/utils/error-recovery.test.js',
    'tests/utils/transaction.test.js'
];

let passedTests = 0;
let failedTests = 0;
const results = [];

console.log('🧪 Running Service Test Suite');
console.log('=====================================');

async function runTest(testFile) {
    return new Promise((resolve) => {
        const fullPath = path.resolve(testFile);
        
        if (!fs.existsSync(fullPath)) {
            console.log(`❌ Test file not found: ${testFile}`);
            failedTests++;
            results.push({ file: testFile, status: 'NOT_FOUND', output: 'File not found' });
            resolve();
            return;
        }

        console.log(`🔍 Running: ${testFile}`);
        
        const child = spawn('node', [fullPath], {
            stdio: ['inherit', 'pipe', 'pipe'],
            cwd: process.cwd()
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ Passed: ${testFile}`);
                passedTests++;
                results.push({ file: testFile, status: 'PASSED', output: stdout });
            } else {
                console.log(`❌ Failed: ${testFile} (exit code: ${code})`);
                if (stderr) {
                    console.log(`   Error: ${stderr.substring(0, 200)}...`);
                }
                failedTests++;
                results.push({ file: testFile, status: 'FAILED', output: stderr || stdout, exitCode: code });
            }
            console.log('');
            resolve();
        });

        // Timeout after 30 seconds
        setTimeout(() => {
            child.kill('SIGTERM');
            console.log(`⏰ Timeout: ${testFile}`);
            failedTests++;
            results.push({ file: testFile, status: 'TIMEOUT', output: 'Test timed out after 30 seconds' });
            resolve();
        }, 30000);
    });
}

async function runAllTests() {
    for (const testFile of testFiles) {
        await runTest(testFile);
    }

    console.log('=====================================');
    console.log('📊 Test Summary:');
    console.log(`   ✅ Passed: ${passedTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   📈 Total: ${passedTests + failedTests}`);
    
    if (failedTests > 0) {
        console.log('\n❌ Failed Tests:');
        results.filter(r => r.status !== 'PASSED').forEach(result => {
            console.log(`   - ${result.file}: ${result.status}`);
        });
    }

    // Calculate coverage estimate
    const coverageEstimate = Math.round((passedTests / (passedTests + failedTests)) * 100);
    console.log(`\n📋 Test Coverage Estimate: ${coverageEstimate}%`);
    
    console.log('=====================================');
    process.exit(failedTests > 0 ? 1 : 0);
}

runAllTests().catch(console.error);
