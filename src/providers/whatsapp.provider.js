// WhatsApp provider functionality
const { BrowserWindow, app } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const BaseProvider = require('./base.provider');
const userAgentConfig = require('../config/user-agent.config');

/**
 * WhatsApp provider
 */
class WhatsAppProvider extends BaseProvider {
    /**
     * Initialize the WhatsApp provider
     * @param {Object} options Provider options
     */
    constructor(options = {}) {
        super(null);
        
        // Set default options
        this.options = Object.assign({
            userAgent: userAgentConfig.getUserAgentForProvider('WhatsApp'),
            clientHintHeaders: userAgentConfig.CLIENT_HINT_HEADERS,
            bypassScriptPath: path.join(__dirname, '../injected/whatsapp-bypass.js')
        }, options);

        // Log the user agent configuration
        console.log('WhatsApp provider initialized with user agent:', this.options.userAgent);
        console.log('WhatsApp provider initialized with client hint headers:', this.options.clientHintHeaders);
        
        // Set the bypass script path
        this.bypassScriptPath = this.options.bypassScriptPath;
        
        // Log the bypass script path
        console.log('WhatsApp provider initialized with bypass script path:', this.bypassScriptPath);
        log.info('WhatsApp provider initialized with bypass script path:', this.bypassScriptPath);
        
        // Initialize the window
        this.window = null;
        this.webContents = null;
        this.profile = null;
        this.eventsSetup = false;
        
        // Set up event handlers
        // this.setupEventHandlers();
    }
    
    /**
     * Initialize the provider with a profile
     * @param {string} profileName Profile name
     */
    initialize(profileName = 'default') {
        log.info('Initializing WhatsApp provider with profile', profileName + '...');
        console.log('Initializing WhatsApp provider with profile', profileName + '...', this.bypassScriptPath);
        
        // Store the profile name
        this.profile = profileName;
        
        // Setup event handlers if window is available
        if (this.window && this.window.webContents && !this.eventsSetup) {
            this.setupEventHandlers();
            this.eventsSetup = true;
        }
        
        // Load the WhatsApp URL if window is available
        if (this.window && this.window.webContents) {
            this.loadWhatsApp();
        } else {
            console.error('Window or webContents not available for initialization');
        }
    }
    
    /**
     * Load WhatsApp URL
     */
    loadWhatsApp() {
        const url = this.getUrl();
        log.info('Loading WhatsApp URL:', url);
        
        // Load the URL
        if (this.window && this.window.webContents) {
            this.window.webContents.loadURL(url, {
                userAgent: this.options.userAgent,
                extraHeaders: Object.entries(this.options.clientHintHeaders)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('\n')
            });
        } else {
            console.error('Window or webContents not available');
        }
    }

    getName() {
        return 'WhatsApp';
    }

    getCommandArg() {
        return '--whatsapp';
    }

    getBaseIconPath() {
        return 'whatsapp';
    }

    // Optional: Override default notification interval
    getNotificationInterval() {
        return 3000; // 3 seconds, using default
    }

    getUrl() {
        return 'https://web.whatsapp.com/';
    }

    setupEventHandlers() {
        if (!this.window || !this.window.webContents) {
            console.error('Window or webContents not available for setting up event handlers');
            return;
        }
        
        console.log('Setting up WhatsApp event handlers');
        
        try {
            // Set up event handlers for the window
            this.window.webContents.on('did-finish-load', () => {
                console.log('WhatsApp page finished loading');
                this.injectBypassScript();
                
                // Check for bypass method after a delay
                setTimeout(() => {
                    this.checkBypassMethod();
                }, 5000);
            });
            
            // Check for bypass method periodically
            const checkInterval = setInterval(() => {
                if (!this.window || !this.window.webContents) {
                    console.log('Window closed, clearing check interval');
                    clearInterval(checkInterval);
                    return;
                }
                this.checkBypassMethod();
            }, 10000);
            
            // Clear interval when window is closed
            this.window.on('closed', () => {
                clearInterval(checkInterval);
            });
        } catch (error) {
            console.error('Error setting up event handlers:', error);
        }
    }
    
    checkPageStatus() {
        this.window.webContents.executeJavaScript(`
            (function() {
                const hasCompatibilityScreen = !!document.querySelector('.browser-version-warning, .landing-wrapper');
                const hasWhatsAppScreen = !!document.querySelector('.app, #app, .web-app, .landing-main');
                
                return {
                    hasCompatibilityScreen,
                    hasWhatsAppScreen,
                    url: window.location.href,
                    title: document.title
                };
            })()
        `).then(status => {
            log.info('WhatsApp page status check:', status);
        }).catch(err => {
            log.error('Error checking WhatsApp page status:', err);
        });
    }

    injectCustomJS() {
        log.info('Injecting custom JavaScript for WhatsApp compatibility');
        this.window.webContents.executeJavaScript(`
            // Clear service worker registrations to avoid caching issues
            window.navigator.serviceWorker.getRegistrations().then(registrations => {
                console.log('[WhatsApp Provider] Unregistering service workers:', registrations.length);
                for (let registration of registrations) {
                    registration.unregister();
                }
            });

            // Function to handle browser compatibility check
            const handleBrowserCheck = () => {
                // Check for various browser compatibility messages
                const titleEl = document.querySelector('.window-title');
                const compatMsgEl = document.querySelector('h1, .landing-title');
                const browserWarning = document.querySelector('.browser-version-warning');
                
                console.log('[WhatsApp Provider] Checking for compatibility elements:');
                console.log('[WhatsApp Provider] - Title element:', titleEl ? titleEl.innerHTML : 'not found');
                console.log('[WhatsApp Provider] - Compatibility message:', compatMsgEl ? compatMsgEl.textContent : 'not found');
                console.log('[WhatsApp Provider] - Browser warning:', browserWarning ? 'found' : 'not found');
                
                // If we find any compatibility warning elements
                if ((titleEl && (titleEl.innerHTML.includes('Chrome') || titleEl.innerHTML.includes('browser'))) || 
                    (compatMsgEl && compatMsgEl.textContent.includes('Google Chrome')) ||
                    browserWarning) {
                    console.log('[WhatsApp Provider] Detected browser compatibility warning, reloading...');
                    // Force reload the page to apply our user agent
                    setTimeout(() => window.location.reload(), 1000);
                    return true;
                }
                return false;
            };

            // Run check immediately
            const initialCheckResult = handleBrowserCheck();
            console.log('[WhatsApp Provider] Initial compatibility check result:', initialCheckResult);
            
            if (!initialCheckResult) {
                // Set up an observer to watch for compatibility messages that might appear later
                console.log('[WhatsApp Provider] Setting up MutationObserver for compatibility detection');
                const observer = new MutationObserver((mutations) => {
                    if (handleBrowserCheck()) {
                        console.log('[WhatsApp Provider] MutationObserver detected compatibility issue, disconnecting');
                        observer.disconnect();
                    }
                });
                
                // Start observing the document body for changes
                observer.observe(document.body || document.documentElement, {
                    childList: true,
                    subtree: true
                });
                console.log('[WhatsApp Provider] MutationObserver started');
            }
        `).then(() => {
            log.info('Custom JavaScript injection completed');
        }).catch(err => {
            log.error('Error injecting custom JavaScript:', err);
        });
    }

    /**
     * Checks for the bypass method element in the DOM
     */
    checkBypassMethod() {
        if (!this.window || !this.window.webContents) {
            console.error('Window or webContents not available');
            return;
        }
        
        try {
            console.log('Checking for bypass method element...');
            this.window.webContents.executeJavaScript(`
                (function() {
                    const bypassMethodElement = document.getElementById('whatsapp-bypass-method');
                    if (bypassMethodElement) {
                        return bypassMethodElement.getAttribute('data-method');
                    }
                    
                    // Check localStorage as a fallback
                    try {
                        const storedMethod = localStorage.getItem('whatsapp-bypass-method');
                        if (storedMethod) {
                            return storedMethod;
                        }
                    } catch (e) {
                        console.error('Error checking localStorage:', e);
                    }
                    
                    return null;
                })();
            `)
            .then(method => {
                if (method) {
                    console.log('*************************************');
                    console.log(`DETECTED BYPASS METHOD: ${method}`);
                    console.log('*************************************');
                    
                    try {
                        // Create a bypass-method.log file using fs directly
                        const electron = require('electron');
                        const logPath = path.join(electron.app.getPath('userData'), 'bypass-method.log');
                        const logEntry = `Effective bypass method: ${method}\nTimestamp: ${new Date().toISOString()}\n`;
                        
                        fs.writeFile(logPath, logEntry, (err) => {
                            if (err) {
                                console.error('Error writing bypass method log:', err);
                            } else {
                                console.log(`Bypass method logged to: ${logPath}`);
                            }
                        });
                    } catch (error) {
                        console.error('Error writing bypass method log:', error);
                    }
                }
            })
            .catch(error => {
                console.error('Error checking bypass method:', error);
            });
        } catch (error) {
            console.error('Error in checkBypassMethod:', error);
        }
    }

    /**
     * Injects the WhatsApp bypass script into the webview
     */
    injectBypassScript() {
        if (!this.bypassScriptPath) {
            console.error('WhatsApp bypass script path not set');
            return;
        }

        console.log('Injecting WhatsApp bypass script:', this.bypassScriptPath);
        
        try {
            const scriptContent = fs.readFileSync(this.bypassScriptPath, 'utf8');
            
            // Get the Chrome version from the user agent
            const chromeVersionMatch = this.options.userAgent.match(/Chrome\/([0-9.]+)/);
            const chromeVersion = chromeVersionMatch ? chromeVersionMatch[1] : userAgentConfig.DEFAULT_CHROME_VERSION;
            
            // Set user agent information in the window object before executing the bypass script
            const userAgentSetupScript = `
                window.whatsAppUserAgent = {
                    userAgent: "${this.options.userAgent}",
                    chromeVersion: "${chromeVersion}",
                    clientHintHeaders: ${JSON.stringify(this.options.clientHintHeaders)}
                };
                console.log('[WhatsApp Provider] Set user agent information:', window.whatsAppUserAgent);
            `;
            
            // Wrap the script content in a self-executing function and add debugging
            const wrappedScript = `
                console.log('[WhatsApp Provider] Starting bypass script injection');
                ${userAgentSetupScript}
                (function() {
                    try {
                        ${scriptContent}
                        console.log('[WhatsApp Provider] Bypass script executed successfully');
                    } catch (error) {
                        console.error('[WhatsApp Provider] Error in bypass script:', error);
                    }
                })();
            `;
            
            this.window.webContents.executeJavaScript(wrappedScript)
                .then(() => {
                    console.log('[WhatsApp Provider] Bypass script injected successfully');
                })
                .catch(error => {
                    console.error('[WhatsApp Provider] Failed to inject bypass script:', error);
                });
        } catch (error) {
            console.error('[WhatsApp Provider] Error reading bypass script:', error);
        }
    }

    bypassCompatibilityCheck() {
        // Execute script to bypass the compatibility check
        log.info('Attempting to bypass WhatsApp compatibility check');
        this.injectBypassScript();
    }

    // Check if the window title indicates notifications
    hasNotifications() {
        const title = this.window.getTitle();
        return title.includes('(') && title.includes(')');
    }

    clearSessionData() {
        if (this.window && this.window.webContents) {
            this.window.webContents.session.clearStorageData({
                storages: ['cookies', 'localstorage', 'sessionstorage', 'websql', 'indexdb']
            }, () => {
                log.info('Session data cleared');
            });
        } else {
            console.error('Window or webContents not available');
        }
    }
}

module.exports = WhatsAppProvider;
