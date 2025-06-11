/**
 * Theme Integration Test
 * Verifies that the theme detection is working properly
 */

// Mock electron nativeTheme for testing
const mockNativeTheme = {
    shouldUseDarkColors: false, // Start with light mode
    themeSource: 'system'
};

require.cache[require.resolve('electron')] = {
    exports: {
        nativeTheme: mockNativeTheme,
        nativeImage: {
            createFromPath: () => ({ toPNG: () => Buffer.alloc(0) })
        }
    }
};

// Import after mocking
const BaseProvider = require('../../src/providers/abstract/base.provider');

class TestProvider extends BaseProvider {
    constructor() {
        super();
        this.serviceName = 'test';
    }
    
    getName() {
        return 'test';
    }
    
    getServiceUrl() {
        return 'https://example.com';
    }
    
    hasNotifications() {
        return false;
    }
}

async function testThemeIntegration() {
    console.log('🧪 Testing Theme Integration...');
    console.log('================================');

    const provider = new TestProvider();
    
    // Test 1: Light mode detection
    console.log('1. Testing light mode detection...');
    mockNativeTheme.shouldUseDarkColors = false;
    const lightIcon = provider.getTrayIcon();
    if (lightIcon && lightIcon.isDarkMode === false) {
        console.log('   ✅ Light mode correctly detected');
    } else {
        console.log('   ❌ Light mode detection failed');
        console.log('   Expected isDarkMode: false, Got:', lightIcon?.isDarkMode);
    }
    
    // Test 2: Dark mode detection
    console.log('2. Testing dark mode detection...');
    mockNativeTheme.shouldUseDarkColors = true;
    const darkIcon = provider.getTrayIcon();
    if (darkIcon && darkIcon.isDarkMode === true) {
        console.log('   ✅ Dark mode correctly detected');
    } else {
        console.log('   ❌ Dark mode detection failed');
        console.log('   Expected isDarkMode: true, Got:', darkIcon?.isDarkMode);
    }
    
    // Test 3: Theme switching
    console.log('3. Testing theme switching...');
    mockNativeTheme.shouldUseDarkColors = false;
    const icon1 = provider.getTrayIcon();
    mockNativeTheme.shouldUseDarkColors = true;
    const icon2 = provider.getTrayIcon();
    
    if (icon1?.isDarkMode !== icon2?.isDarkMode) {
        console.log('   ✅ Theme switching works correctly');
    } else {
        console.log('   ❌ Theme switching failed');
        console.log('   Icon1 isDarkMode:', icon1?.isDarkMode);
        console.log('   Icon2 isDarkMode:', icon2?.isDarkMode);
    }
    
    // Test 4: Notification state with theme
    console.log('4. Testing notification state with theme...');
    mockNativeTheme.shouldUseDarkColors = true;
    const notifIcon = provider.getTrayIcon(true, false);
    if (notifIcon && notifIcon.hasNotification === true && notifIcon.isDarkMode === true) {
        console.log('   ✅ Notification state with theme works correctly');
    } else {
        console.log('   ❌ Notification state with theme failed');
        console.log('   Expected: hasNotification=true, isDarkMode=true');
        console.log('   Got:', { 
            hasNotification: notifIcon?.hasNotification, 
            isDarkMode: notifIcon?.isDarkMode 
        });
    }
    
    console.log('================================');
    console.log('🎉 Theme integration tests completed!');
}

// Run the test
if (require.main === module) {
    testThemeIntegration().catch(error => {
        console.error('Theme integration test failed:', error);
        process.exit(1);
    });
}
