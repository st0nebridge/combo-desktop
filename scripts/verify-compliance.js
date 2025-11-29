#!/usr/bin/env node
/**
 * @module scripts/verify-compliance
 * @description Verification script for MSP and TICP compliance
 * 
 * @input {void}
 * @output {number} Exit code (0 = compliant, 1 = non-compliant)
 * 
 * @example
 * node scripts/verify-compliance.js
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_MSP_HEADER_FIELDS = ['@module', '@description'];
const RECOMMENDED_MSP_HEADER_FIELDS = ['@input', '@output', '@dependencies', '@example'];

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(color, ...args) {
    console.log(color, ...args, colors.reset);
}

function checkMSPCompliance() {
    log(colors.cyan, '\n🔍 Checking MSP Compliance...\n');
    
    const issues = [];
    const successes = [];
    
    // Check manifest.json exists
    const manifestPath = path.join(__dirname, '..', 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        issues.push('manifest.json not found');
    } else {
        successes.push('manifest.json exists');
        const manifest = require(manifestPath);
        
        // Validate manifest structure
        if (!manifest.modules) {
            issues.push('manifest.json missing modules definition');
        } else {
            successes.push(`manifest.json defines ${Object.keys(manifest.modules).length} modules`);
        }
        
        if (!manifest.compliance?.msp) {
            issues.push('manifest.json missing MSP compliance declaration');
        } else {
            successes.push(`MSP compliance declared: ${manifest.compliance.msp.status}`);
        }
    }
    
    // Check key module files have MSP headers
    const modulesToCheck = [
        'src/main.js',
        'src/cli/index.js',
        'src/cli/cli.registry.js',
        'src/providers/provider.registry.js',
        'src/providers/abstract/base.provider.js',
        'src/services/app.manager.js',
        'src/services/instance.manager.js',
        'src/services/window.service.js',
        'src/utils/error-recovery.js',
        'src/utils/transaction.js'
    ];
    
    for (const modulePath of modulesToCheck) {
        const fullPath = path.join(__dirname, '..', modulePath);
        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const hasModuleHeader = content.includes('@module');
            const hasDescription = content.includes('@description');
            
            if (hasModuleHeader && hasDescription) {
                successes.push(`${modulePath}: MSP header present`);
            } else {
                issues.push(`${modulePath}: Missing @module or @description header`);
            }
        } else {
            issues.push(`${modulePath}: File not found`);
        }
    }
    
    return { issues, successes };
}

function checkTICPCompliance() {
    log(colors.cyan, '\n🔍 Checking TICP Compliance...\n');
    
    const issues = [];
    const successes = [];
    
    // Check package.json has Jest config
    const packagePath = path.join(__dirname, '..', 'package.json');
    const pkg = require(packagePath);
    
    // Check test scripts
    const requiredScripts = ['test', 'test:watch', 'test:ci', 'test:coverage'];
    for (const script of requiredScripts) {
        if (pkg.scripts[script]) {
            successes.push(`Script '${script}' defined`);
        } else {
            issues.push(`Missing TICP script: ${script}`);
        }
    }
    
    // Check coverage thresholds
    if (pkg.jest?.coverageThreshold?.global) {
        const thresholds = pkg.jest.coverageThreshold.global;
        
        if (thresholds.statements >= 85) {
            successes.push(`Statements threshold: ${thresholds.statements}% (≥85%)`);
        } else {
            issues.push(`Statements threshold ${thresholds.statements}% below required 85%`);
        }
        
        if (thresholds.branches >= 70) {
            successes.push(`Branches threshold: ${thresholds.branches}% (≥70%)`);
        } else {
            issues.push(`Branches threshold ${thresholds.branches}% below required 70%`);
        }
        
        if (thresholds.functions >= 85) {
            successes.push(`Functions threshold: ${thresholds.functions}% (≥85%)`);
        } else {
            issues.push(`Functions threshold ${thresholds.functions}% below required 85%`);
        }
        
        if (thresholds.lines >= 85) {
            successes.push(`Lines threshold: ${thresholds.lines}% (≥85%)`);
        } else {
            issues.push(`Lines threshold ${thresholds.lines}% below required 85%`);
        }
    } else {
        issues.push('No Jest coverage thresholds defined');
    }
    
    // Check test documentation exists
    const docFiles = [
        'docs/TEST_CHARTER.md',
        'docs/COVERAGE_MAP.md',
        'quality/waivers/README.md'
    ];
    
    for (const docFile of docFiles) {
        const fullPath = path.join(__dirname, '..', docFile);
        if (fs.existsSync(fullPath)) {
            successes.push(`${docFile} exists`);
        } else {
            issues.push(`Missing TICP documentation: ${docFile}`);
        }
    }
    
    // Check test files exist
    const testDirs = ['tests/cli', 'tests/services', 'tests/utils'];
    for (const testDir of testDirs) {
        const fullPath = path.join(__dirname, '..', testDir);
        if (fs.existsSync(fullPath)) {
            const testFiles = fs.readdirSync(fullPath).filter(f => f.endsWith('.test.js'));
            if (testFiles.length > 0) {
                successes.push(`${testDir}: ${testFiles.length} test file(s)`);
            } else {
                issues.push(`${testDir}: No test files found`);
            }
        }
    }
    
    return { issues, successes };
}

function printResults(title, results) {
    const { issues, successes } = results;
    
    for (const success of successes) {
        log(colors.green, `  ✓ ${success}`);
    }
    
    for (const issue of issues) {
        log(colors.red, `  ✗ ${issue}`);
    }
    
    return issues.length;
}

function main() {
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║     MSP & TICP Compliance Verification Report      ║');
    console.log('╚════════════════════════════════════════════════════╝');
    
    let totalIssues = 0;
    
    // MSP Check
    const mspResults = checkMSPCompliance();
    totalIssues += printResults('MSP', mspResults);
    
    // TICP Check
    const ticpResults = checkTICPCompliance();
    totalIssues += printResults('TICP', ticpResults);
    
    // Summary
    console.log('\n' + '─'.repeat(54));
    
    if (totalIssues === 0) {
        log(colors.green, '\n✅ All compliance checks passed!\n');
        process.exit(0);
    } else {
        log(colors.red, `\n❌ ${totalIssues} compliance issue(s) found.\n`);
        process.exit(1);
    }
}

main();
