/**
 * Quick verification to check if the Close Instance fix is actually active
 */

const fs = require('fs');
const path = require('path');

function verifyCloseInstanceFix() {
    console.log('=== Verifying Close Instance Fix Implementation ===');
    
    try {
        // Check 1: Provider registry has session registration
        const providerRegistryPath = path.join(__dirname, 'src', 'providers', 'provider.registry.js');
        const providerRegistryContent = fs.readFileSync(providerRegistryPath, 'utf8');
        
        const hasInstanceManagerImport = providerRegistryContent.includes("require('../services/instance.manager')");
        const hasSessionRegistration = providerRegistryContent.includes('instanceManager.registerSession');
        const hasSuccessLogging = providerRegistryContent.includes('Successfully registered session');
        
        console.log('\\n--- Provider Registry Fix Status ---');
        console.log(`✅ InstanceManager imported: ${hasInstanceManagerImport ? 'Yes' : 'No'}`);
        console.log(`✅ Session registration call: ${hasSessionRegistration ? 'Yes' : 'No'}`);
        console.log(`✅ Success logging: ${hasSuccessLogging ? 'Yes' : 'No'}`);
        
        // Check 2: Base provider has Close Instance menu
        const baseProviderPath = path.join(__dirname, 'src', 'providers', 'abstract', 'base.provider.js');
        const baseProviderContent = fs.readFileSync(baseProviderPath, 'utf8');
        
        const hasCloseInstanceMethod = baseProviderContent.includes('getCloseInstanceMenuItem()');
        const hasUnregisterSessionCall = baseProviderContent.includes('instanceManager.unregisterSession');
        const hasCloseInstanceLabel = baseProviderContent.includes("label: 'Close Instance'");
        
        console.log('\\n--- Base Provider Fix Status ---');
        console.log(`✅ getCloseInstanceMenuItem method: ${hasCloseInstanceMethod ? 'Yes' : 'No'}`);
        console.log(`✅ unregisterSession call: ${hasUnregisterSessionCall ? 'Yes' : 'No'}`);
        console.log(`✅ Close Instance label: ${hasCloseInstanceLabel ? 'Yes' : 'No'}`);
        
        // Check 3: Look for any running processes
        console.log('\\n--- Process Check ---');
        console.log('Run this command to check for running processes:');
        console.log('Get-Process | Where-Object {$_.ProcessName -like "*node*" -or $_.MainWindowTitle -like "*combo-desktop*"}');
        
        // Check 4: Instance manager has session tracking
        const instanceManagerPath = path.join(__dirname, 'src', 'services', 'instance.manager.js');
        const instanceManagerContent = fs.readFileSync(instanceManagerPath, 'utf8');
        
        const hasRegisterSessionMethod = instanceManagerContent.includes('registerSession(name, profile)');
        const hasUnregisterSessionMethod = instanceManagerContent.includes('unregisterSession(name, profile)');
        const hasProviderSessionsMap = instanceManagerContent.includes('providerSessions');
        
        console.log('\\n--- Instance Manager Status ---');
        console.log(`✅ registerSession method: ${hasRegisterSessionMethod ? 'Yes' : 'No'}`);
        console.log(`✅ unregisterSession method: ${hasUnregisterSessionMethod ? 'Yes' : 'No'}`);
        console.log(`✅ providerSessions map: ${hasProviderSessionsMap ? 'Yes' : 'No'}`);
        
        // Overall assessment
        const allChecksPass = hasInstanceManagerImport && hasSessionRegistration && 
                             hasCloseInstanceMethod && hasUnregisterSessionCall &&
                             hasRegisterSessionMethod && hasUnregisterSessionMethod;
        
        console.log('\\n=== OVERALL ASSESSMENT ===');
        if (allChecksPass) {
            console.log('🎉 All Close Instance fixes are properly implemented!');
            console.log('\\n📝 Next Steps for Testing:');
            console.log('1. Kill any existing combo-desktop processes');
            console.log('2. Run: node src/main.js --whatsapp');
            console.log('3. In another terminal: node src/main.js --facebook');
            console.log('4. Look for both tray icons');
            console.log('5. Right-click each tray icon → "Close Instance"');
            console.log('6. Each should close independently');
            
            console.log('\\n🔍 What to look for in logs:');
            console.log('- "Successfully registered session for WhatsApp:default"');
            console.log('- "Successfully registered session for Facebook:default"');
            console.log('- "Closing instance for [Provider]:default"');
            console.log('- "Session [Provider]:default unregistered successfully"');
            
            return true;
        } else {
            console.log('❌ Some fixes are missing or incomplete!');
            console.log('\\n🔧 Missing components:');
            if (!hasInstanceManagerImport) console.log('- Provider registry missing instance manager import');
            if (!hasSessionRegistration) console.log('- Provider registry missing session registration');
            if (!hasCloseInstanceMethod) console.log('- Base provider missing Close Instance method');
            if (!hasUnregisterSessionCall) console.log('- Base provider missing unregister call');
            if (!hasRegisterSessionMethod) console.log('- Instance manager missing register method');
            if (!hasUnregisterSessionMethod) console.log('- Instance manager missing unregister method');
            
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error verifying fix:', error);
        return false;
    }
}

// Run the verification
if (require.main === module) {
    const success = verifyCloseInstanceFix();
    process.exit(success ? 0 : 1);
}

module.exports = verifyCloseInstanceFix;
