// Simple test to verify our changes
const fs = require('fs');
const path = require('path');

console.log('Testing Unload Instance functionality...');

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
    if (content.includes('dialog') && content.includes('electron')) {
        console.log('   ✓ Electron dialog imported');
    } else {
        console.log('   ✗ Electron dialog import not found');
    }
} else {
    console.log('   ✗ BaseProvider file not found');
}

console.log('Test completed!');
