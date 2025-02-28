// WhatsApp compatibility bypass script
// This script is injected into the WhatsApp page to bypass browser compatibility checks

(function() {
    console.log('WhatsApp bypass script injected');
    
    // Function to directly click the "UPDATE GOOGLE CHROME" button
    function clickUpdateButton() {
        const updateButtons = document.querySelectorAll('button, a, div[role="button"]');
        for (const button of updateButtons) {
            // Look for the update button by text content
            if (button.innerText && 
                (button.innerText.includes('UPDATE GOOGLE CHROME') || 
                 button.innerText.toUpperCase().includes('UPDATE') || 
                 button.innerText.includes('Chrome'))) {
                console.log('Found update button:', button.innerText);
                button.click();
                return true;
            }
        }
        return false;
    }
    
    // Function to remove the compatibility screen entirely
    function removeCompatibilityScreen() {
        // Try to find the compatibility screen container
        const compatScreens = document.querySelectorAll('.browser-version-warning, .landing-wrapper');
        for (const screen of compatScreens) {
            if (screen.innerHTML.includes('Chrome') || 
                screen.innerHTML.includes('browser') || 
                screen.innerHTML.includes('60+')) {
                console.log('Found compatibility screen, removing');
                screen.style.display = 'none';
                // Try to find the main app container and show it
                const appContainer = document.querySelector('.app, #app, .web-app');
                if (appContainer) {
                    appContainer.style.display = 'block';
                }
                return true;
            }
        }
        return false;
    }
    
    // Function to simulate Chrome browser environment
    function simulateChromeEnvironment() {
        // Create a fake Chrome object if it doesn't exist
        if (!window.chrome) {
            window.chrome = {
                runtime: {
                    getManifest: function() {
                        return { version: '121.0.6167.184', manifest_version: 3 };
                    }
                },
                webstore: { onInstallStageChanged: {}, onDownloadProgress: {} },
                app: { InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' } }
            };
        }
        
        // Override browser detection methods
        const originalNavigator = navigator;
        Object.defineProperty(window, 'navigator', {
            get: function() {
                const nav = Object.create(originalNavigator);
                nav.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.184 Safari/537.36';
                nav.vendor = 'Google Inc.';
                nav.appVersion = '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.184 Safari/537.36';
                return nav;
            },
            configurable: true
        });
    }
    
    // Execute all bypass methods
    function executeBypass() {
        simulateChromeEnvironment();
        if (clickUpdateButton() || removeCompatibilityScreen()) {
            console.log('Bypass successful');
        }
    }
    
    // Execute immediately and set interval to keep trying
    executeBypass();
    const bypassInterval = setInterval(executeBypass, 1000);
    
    // After 30 seconds, clear the interval to avoid unnecessary processing
    setTimeout(() => {
        clearInterval(bypassInterval);
        console.log('WhatsApp bypass interval cleared');
    }, 30000);
})();
