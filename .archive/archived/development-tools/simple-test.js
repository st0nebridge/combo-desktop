// Simple test to verify our changes
const fs = require('fs');
const path = require('path');

console.log('Testing Unload Instance functionality...\n');

// Read and check BaseProvider changes
const baseProviderPath = path.join(__dirname, 'src', 'providers', 'abstract', 'base.provider.js');
console.log('1. Checking BaseProvider changes...');

if (fs.existsSync(baseProviderPath)) {
    const content = fs.readFileSync(baseProviderPath, 'utf8');
    
    // Check for "Unload Instance" label
    if (content.includes('"Unload Instance"')) {
        console.log('   ✓ Menu label changed to "Unload Instance"');
    } else {
        console.log('   ✗ Menu label not found');
    }
    
    // Check for forceClose logic
    if (content.includes('window.forceClose = true')) {
        console.log('   ✓ forceClose logic added');
    } else {
        console.log('   ✗ forceClose logic not found');
    }
    
    // Check for dialog import
    if (content.includes('const { dialog } = require(\'electron\')')) {
        console.log('   ✓ Electron dialog imported');
    } else {
        console.log('   ✗ Electron dialog import not found');
    }
} else {
    console.log('   ✗ BaseProvider file not found');
}

// Read and check InstanceManager changes
const instanceManagerPath = path.join(__dirname, 'src', 'services', 'instance.manager.js');
console.log('\n2. Checking InstanceManager changes...');

if (fs.existsSync(instanceManagerPath)) {
    const content = fs.readFileSync(instanceManagerPath, 'utf8');
    
    // Check for forceClose in unregisterSession
    const forceCloseMatches = (content.match(/window\.forceClose\s*=\s*true/g) || []).length;
    if (forceCloseMatches >= 2) {
        console.log(`   ✓ forceClose logic added in unregisterSession (${forceCloseMatches} instances)`);
    } else {
        console.log(`   ✗ Insufficient forceClose logic found (${forceCloseMatches} instances)`);
    }
} else {
    console.log('   ✗ InstanceManager file not found');
}

console.log('\nTest completed!');
