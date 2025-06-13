/**
 * Test script to verify partition naming consistency
 */

const path = require('path');

// Mock electron app for testing
const mockApp = {
    getName: () => 'desk-tray',
    getPath: (type) => {
        if (type === 'userData') return 'C:\\Users\\Test\\AppData\\Roaming\\desk-tray';
        return 'C:\\temp';
    }
};

// Set up the environment
process.env.NODE_ENV = 'test';

// Mock electron before requiring modules
const electron = {
    app: mockApp,
    session: {
        fromPartition: (name) => {
            console.log(`📦 Creating/accessing session partition: ${name}`);
            return {
                setUserAgent: (ua) => console.log(`🌐 Set user agent: ${ua}`),
                clearStorageData: () => console.log(`🗑️ Clearing storage data for: ${name}`)
            };
        }
    }
};

// Mock the require calls
const originalRequire = require;
require = function(id) {
    if (id === 'electron') return electron;
    if (id === 'electron-log') return { info: console.log, warn: console.warn, error: console.error, debug: console.log };
    return originalRequire.apply(this, arguments);
};

try {
    console.log('🔍 Testing partition naming consistency...\n');
    
    // Test profile manager partition naming
    const profileManager = originalRequire('./src/services/profile.manager');
    const whatsappPartition = profileManager.getPartitionName('WhatsApp', 'default');
    console.log(`📋 Profile Manager - WhatsApp:default -> ${whatsappPartition}`);
    
    const facebookPartition = profileManager.getPartitionName('Facebook', 'test');
    console.log(`📋 Profile Manager - Facebook:test -> ${facebookPartition}`);
    
    // Test provider partition naming
    const WhatsAppProvider = originalRequire('./src/providers/modules/whatsapp.provider');
    const whatsappProvider = new WhatsAppProvider();
    const providerPartition = whatsappProvider.getPartitionName('default');
    console.log(`🏢 WhatsApp Provider - default -> ${providerPartition}`);
    
    console.log('\n✅ Partition naming test complete');
    console.log(`🔍 Consistency check: Profile Manager vs Provider`);
    console.log(`   Profile Manager: ${whatsappPartition}`);
    console.log(`   Provider:        ${providerPartition}`);
    console.log(`   Match: ${whatsappPartition === providerPartition ? '✅ YES' : '❌ NO'}`);
    
} catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
}

process.exit(0);
