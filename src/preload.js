// Preload script for WhatsApp compatibility
const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

// Import user agent configuration
const userAgentConfig = require(path.join(__dirname, 'config', 'user-agent.config'));

// Chrome version to spoof
const CHROME_VERSION = userAgentConfig.DEFAULT_CHROME_VERSION;
const CHROME_UA = userAgentConfig.DEFAULT_USER_AGENT;

// Log the user agent configuration
console.log('[Preload] Using Chrome version:', CHROME_VERSION);
console.log('[Preload] Using user agent:', CHROME_UA);

// Override navigator.userAgent to ensure WhatsApp compatibility
Object.defineProperty(navigator, 'userAgent', {
  value: CHROME_UA,
  configurable: false,
  writable: false
});
console.log('[Preload] Overrode navigator.userAgent:', navigator.userAgent);

// Override appVersion as well
const originalAppVersion = navigator.appVersion;
const newAppVersion = navigator.appVersion.replace(/Chrome\/[\d\.]+/, `Chrome/${CHROME_VERSION}`);
Object.defineProperty(navigator, 'appVersion', {
  value: newAppVersion,
  configurable: false,
  writable: false
});
console.log('[Preload] Overrode navigator.appVersion from:', originalAppVersion);
console.log('[Preload] Overrode navigator.appVersion to:', newAppVersion);

// Override platform
Object.defineProperty(navigator, 'platform', {
  value: 'Win32',
  configurable: false,
  writable: false
});
console.log('[Preload] Overrode navigator.platform to: Win32');

// Create a more complete browser spoofing
const originalGetUserAgent = navigator.userAgent;

// Override Chrome version in navigator
if (!navigator.chrome) {
  navigator.chrome = { runtime: {} };
  console.log('[Preload] Created navigator.chrome object');
}

// Set Chrome version
navigator.chrome.runtime.getManifest = () => {
  const manifest = {
    version: CHROME_VERSION,
    manifest_version: 3
  };
  console.log('[Preload] Created chrome.runtime.getManifest method returning:', manifest);
  return manifest;
};

// Create a bridge to communicate with the main process
contextBridge.exposeInMainWorld('electronAPI', {
  // Send notification state changes to main process
  setNotificationState: (isActive) => {
    console.log('[Preload] Sending notification state:', isActive);
    ipcRenderer.send('notification-state-changed', isActive);
  },
  
  // Add a method to log the current state of the page
  logPageState: () => {
    const hasCompatibilityScreen = !!document.querySelector('.browser-version-warning, .landing-wrapper');
    const hasWhatsAppScreen = !!document.querySelector('.app, #app, .web-app, .landing-main');
    
    console.log('[Preload] Page state check:');
    console.log('[Preload] - Has compatibility screen:', hasCompatibilityScreen);
    console.log('[Preload] - Has WhatsApp screen:', hasWhatsAppScreen);
    
    return {
      hasCompatibilityScreen,
      hasWhatsAppScreen
    };
  },
  
  // Add a method to log which bypass method was effective
  logBypassMethod: (method) => {
    console.log('[Preload] Effective bypass method:', method);
    ipcRenderer.send('bypass-method-effective', method);
  },
  
  // Get user agent information from the main process
  getUserAgent: () => {
    return ipcRenderer.invoke('get-user-agent');
  }
});

// Log the user agent for debugging
console.log('[Preload] User Agent:', navigator.userAgent);

// Inject script to bypass compatibility check
const script = document.createElement('script');
script.textContent = `
  // Override browser detection methods
  window.chrome = window.chrome || { runtime: {} };
  window.chrome.runtime.getManifest = () => {
    const manifest = { version: "${CHROME_VERSION}", manifest_version: 3 };
    console.log('[Injected] Created chrome.runtime.getManifest returning:', manifest);
    return manifest;
  };
  
  // Function to handle compatibility screen
  function bypassCompatibilityScreen() {
    const buttons = document.querySelectorAll('button, a.button, div[role="button"]');
    let buttonFound = false;
    
    for (const button of buttons) {
      if (button.innerText && 
          (button.innerText.includes('UPDATE') || 
           button.innerText.includes('Chrome') ||
           button.innerText.includes('Continue'))) {
        console.log('[Injected] Found compatibility button:', button.innerText);
        button.click();
        console.log('[Injected] Clicked compatibility button');
        buttonFound = true;
        return true;
      }
    }
    
    if (!buttonFound) {
      console.log('[Injected] No compatibility button found');
    }
    
    return false;
  }
  
  // Function to check if we're on the WhatsApp screen
  function checkWhatsAppScreen() {
    const hasCompatibilityScreen = !!document.querySelector('.browser-version-warning, .landing-wrapper');
    const hasWhatsAppScreen = !!document.querySelector('.app, #app, .web-app, .landing-main');
    
    console.log('[Injected] Screen check:');
    console.log('[Injected] - Has compatibility screen:', hasCompatibilityScreen);
    console.log('[Injected] - Has WhatsApp screen:', hasWhatsAppScreen);
    
    return {
      hasCompatibilityScreen,
      hasWhatsAppScreen
    };
  }
  
  // Set interval to keep trying and check screen state
  const bypassInterval = setInterval(() => {
    const screenState = checkWhatsAppScreen();
    
    if (screenState.hasWhatsAppScreen && !screenState.hasCompatibilityScreen) {
      console.log('[Injected] Successfully loaded WhatsApp screen');
      clearInterval(bypassInterval);
    } else if (screenState.hasCompatibilityScreen) {
      console.log('[Injected] Still on compatibility screen, attempting bypass');
      bypassCompatibilityScreen();
    }
  }, 1000);
`;

// Add the script to the document when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Preload] DOM content loaded, injecting bypass script');
  document.head.appendChild(script);
});

// Log that preload script has executed
console.log('[Preload] Enhanced preload script executed - Browser detection spoofed');
