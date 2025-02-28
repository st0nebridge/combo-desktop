// Preload script for WhatsApp compatibility
const { contextBridge, ipcRenderer } = require('electron');

// Chrome version to spoof
const CHROME_VERSION = '121.0.6167.184';
const CHROME_UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`;

// Override navigator.userAgent to ensure WhatsApp compatibility
Object.defineProperty(navigator, 'userAgent', {
  value: CHROME_UA,
  configurable: false,
  writable: false
});

// Override appVersion as well
Object.defineProperty(navigator, 'appVersion', {
  value: navigator.appVersion.replace(/Chrome\/[\d\.]+/, `Chrome/${CHROME_VERSION}`),
  configurable: false,
  writable: false
});

// Override platform
Object.defineProperty(navigator, 'platform', {
  value: 'Win32',
  configurable: false,
  writable: false
});

// Create a more complete browser spoofing
const originalGetUserAgent = navigator.userAgent;
const originalAppVersion = navigator.appVersion;

// Override Chrome version in navigator
if (!navigator.chrome) {
  navigator.chrome = { runtime: {} };
}

// Set Chrome version
navigator.chrome.runtime.getManifest = () => ({
  version: CHROME_VERSION,
  manifest_version: 3
});

// Create a bridge to communicate with the main process
contextBridge.exposeInMainWorld('electronAPI', {
  // Send notification state changes to main process
  setNotificationState: (isActive) => {
    ipcRenderer.send('notification-state-changed', isActive);
  }
});

// Inject script to bypass compatibility check
const script = document.createElement('script');
script.textContent = `
  // Override browser detection methods
  window.chrome = window.chrome || { runtime: {} };
  window.chrome.runtime.getManifest = () => ({ version: "${CHROME_VERSION}", manifest_version: 3 });
  
  // Function to handle compatibility screen
  function bypassCompatibilityScreen() {
    const buttons = document.querySelectorAll('button, a.button, div[role="button"]');
    for (const button of buttons) {
      if (button.innerText && 
          (button.innerText.includes('UPDATE') || 
           button.innerText.includes('Chrome') ||
           button.innerText.includes('Continue'))) {
        console.log('Clicking compatibility button:', button.innerText);
        button.click();
        return true;
      }
    }
    return false;
  }
  
  // Set interval to keep trying
  setInterval(bypassCompatibilityScreen, 1000);
`;

// Add the script to the document when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  document.head.appendChild(script);
});

// Log that preload script has executed
console.log('Enhanced preload script executed - Browser detection spoofed');
