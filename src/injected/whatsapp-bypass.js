// WhatsApp compatibility bypass script
// This script is injected into the WhatsApp page to bypass browser compatibility checks

(function() {
    console.log('[WhatsApp Bypass] Script injected');
    
    // Track which method was successful
    let bypassMethod = null;
    
    // Function to directly click the "UPDATE GOOGLE CHROME" button
    function clickUpdateButton() {
        console.log('[WhatsApp Bypass] Attempting to click update button');
        const updateButtons = document.querySelectorAll('button, a, div[role="button"]');
        for (const button of updateButtons) {
            // Look for the update button by text content
            if (button.innerText && 
                (button.innerText.includes('UPDATE GOOGLE CHROME') || 
                 button.innerText.toUpperCase().includes('UPDATE') || 
                 button.innerText.includes('Chrome'))) {
                console.log('[WhatsApp Bypass] Found update button:', button.innerText);
                button.click();
                console.log('[WhatsApp Bypass] Clicked update button');
                bypassMethod = 'clickUpdateButton';
                return true;
            }
        }
        console.log('[WhatsApp Bypass] No update button found');
        return false;
    }
    
    // Function to remove the compatibility screen entirely
    function removeCompatibilityScreen() {
        console.log('[WhatsApp Bypass] Attempting to remove compatibility screen');
        // Try to find the compatibility screen container
        const compatScreens = document.querySelectorAll('.browser-version-warning, .landing-wrapper');
        for (const screen of compatScreens) {
            if (screen.innerHTML.includes('Chrome') || 
                screen.innerHTML.includes('browser') || 
                screen.innerHTML.includes('60+')) {
                console.log('[WhatsApp Bypass] Found compatibility screen, removing');
                screen.style.display = 'none';
                // Try to find the main app container and show it
                const appContainer = document.querySelector('.app, #app, .web-app');
                if (appContainer) {
                    console.log('[WhatsApp Bypass] Found app container, showing it');
                    appContainer.style.display = 'block';
                }
                bypassMethod = 'removeCompatibilityScreen';
                return true;
            }
        }
        console.log('[WhatsApp Bypass] No compatibility screen found to remove');
        return false;
    }
    
    // Function to simulate Chrome browser environment
    function simulateChromeEnvironment() {
        console.log('[WhatsApp Bypass] Simulating Chrome environment');
        
        // Get user agent information from window if available
        const userAgentInfo = window.whatsAppUserAgent || {};
        const chromeVersion = userAgentInfo.chromeVersion || '121.0.6167.184';
        const userAgent = userAgentInfo.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.184 Safari/537.36';
        
        console.log('[WhatsApp Bypass] Using Chrome version:', chromeVersion);
        console.log('[WhatsApp Bypass] Using user agent:', userAgent);
        
        // Create a fake Chrome object if it doesn't exist
        if (!window.chrome) {
            window.chrome = {
                runtime: {
                    getManifest: function() {
                        return { version: chromeVersion, manifest_version: 3 };
                    }
                },
                webstore: { onInstallStageChanged: {}, onDownloadProgress: {} },
                app: { InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' } }
            };
            console.log('[WhatsApp Bypass] Created chrome object');
        }
        
        // Override browser detection methods
        const originalNavigator = navigator;
        Object.defineProperty(window, 'navigator', {
            get: function() {
                const nav = Object.create(originalNavigator);
                nav.userAgent = userAgent;
                nav.vendor = 'Google Inc.';
                nav.appVersion = userAgent;
                return nav;
            },
            configurable: true
        });
        console.log('[WhatsApp Bypass] Overrode navigator object');
        bypassMethod = 'simulateChromeEnvironment';
        return true;
    }
    
    // Function to check if we're on the WhatsApp screen
    function checkWhatsAppScreen() {
        const hasCompatibilityScreen = !!document.querySelector('.browser-version-warning, .landing-wrapper');
        const hasWhatsAppScreen = !!document.querySelector('.app, #app, .web-app, .landing-main');
        
        console.log('[WhatsApp Bypass] Screen check:');
        console.log('[WhatsApp Bypass] - Has compatibility screen:', hasCompatibilityScreen);
        console.log('[WhatsApp Bypass] - Has WhatsApp screen:', hasWhatsAppScreen);
        
        return {
            hasCompatibilityScreen,
            hasWhatsAppScreen
        };
    }
    
    // Function to report the bypass method to the main process
    function reportBypassMethod(method) {
        if (bypassMethod) {
            console.log('[WhatsApp Bypass] Reporting bypass method:', method);
            
            try {
                // Create a custom element to store the bypass method
                const bypassMethodElement = document.createElement('div');
                bypassMethodElement.id = 'whatsapp-bypass-method';
                bypassMethodElement.style.display = 'none';
                bypassMethodElement.setAttribute('data-method', method);
                document.body.appendChild(bypassMethodElement);
                
                console.log('[WhatsApp Bypass] Added bypass method element to DOM with method:', method);
                
                // Try to use IPC if available
                if (window.electronAPI && typeof window.electronAPI.logBypassMethod === 'function') {
                    window.electronAPI.logBypassMethod(method);
                    console.log('[WhatsApp Bypass] Sent bypass method to main process:', method);
                } else {
                    console.log('[WhatsApp Bypass] electronAPI not available for reporting bypass method');
                }
                
                // Also log to localStorage for backup
                try {
                    localStorage.setItem('whatsapp-bypass-method', method);
                    localStorage.setItem('whatsapp-bypass-timestamp', new Date().toISOString());
                    console.log('[WhatsApp Bypass] Stored bypass method in localStorage');
                } catch (e) {
                    console.log('[WhatsApp Bypass] Failed to store in localStorage:', e);
                }
            } catch (error) {
                console.error('[WhatsApp Bypass] Error reporting bypass method:', error);
            }
        }
    }
    
    // Execute all bypass methods
    function executeBypass() {
        simulateChromeEnvironment();
        
        const screenState = checkWhatsAppScreen();
        
        if (screenState.hasWhatsAppScreen && !screenState.hasCompatibilityScreen) {
            console.log('[WhatsApp Bypass] Already on WhatsApp screen, no bypass needed');
            if (!bypassMethod) {
                bypassMethod = 'noBypassNeeded';
                reportBypassMethod(bypassMethod);
            }
            return true;
        }
        
        if (clickUpdateButton() || removeCompatibilityScreen()) {
            console.log('[WhatsApp Bypass] Bypass successful using method:', bypassMethod);
            reportBypassMethod(bypassMethod);
            return true;
        }
        
        return false;
    }
    
    // Execute immediately
    executeBypass();
    
    // Set interval to keep trying
    const bypassInterval = setInterval(() => {
        const screenState = checkWhatsAppScreen();
        
        if (screenState.hasWhatsAppScreen && !screenState.hasCompatibilityScreen) {
            clearInterval(bypassInterval);
            console.log('[WhatsApp Bypass] Successfully loaded WhatsApp screen using method:', bypassMethod || 'unknown');
            
            // Add a more visible log message for the effective method
            console.log('');
            console.log('*************************************************************');
            console.log('* EFFECTIVE BYPASS METHOD: ' + (bypassMethod || 'unknown'));
            console.log('*************************************************************');
            console.log('');
            
            reportBypassMethod(bypassMethod || 'unknown');
        } else {
            console.log('[WhatsApp Bypass] Still attempting bypass...');
            executeBypass();
        }
    }, 1000);
    
    // After 30 seconds, clear the interval to avoid unnecessary processing
    setTimeout(() => {
        clearInterval(bypassInterval);
        console.log('[WhatsApp Bypass] Bypass interval cleared. Final method used:', bypassMethod || 'none');
        
        // Final check of screen state
        const finalState = checkWhatsAppScreen();
        console.log('[WhatsApp Bypass] Final screen state:', finalState);
    }, 30000);
})();
