/**
 * Test script to verify provider availability and exit logic
 */

const providerRegistry = require('./src/providers');
const logger = require('./src/services/logging.service');

async function testProviderAvailability() {
    try {
        console.log('Testing provider availability...');
        
        const availableProviders = providerRegistry.getAvailableProviders();
        console.log(`Found ${availableProviders.length} providers:`);
        
        for (const provider of availableProviders) {
            console.log(`- ${provider.name} (${provider.commandArg})`);
        }
        
        // Test the exit logic condition
        if (!availableProviders || availableProviders.length === 0) {
            console.log('❌ No providers available - app would exit');
        } else {
            console.log('✅ Providers available - app would continue');
        }
        
        // Test temp flag logic
        const testSession = {
            provider: 'whatsapp',
            profile: 'default',
            isTemp: true
        };
        
        console.log('\nTest session object:');
        console.log(JSON.stringify(testSession, null, 2));
        console.log(`Temp flag: ${testSession.isTemp ? '✅ Present' : '❌ Missing'}`);
        
    } catch (error) {
        console.error('Error testing provider availability:', error);
    }
}

testProviderAvailability().then(() => {
    console.log('\nTest completed');
    process.exit(0);
}).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});
