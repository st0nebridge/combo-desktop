/**
 * @module services/app.manager
 * @description Core application manager that handles lifecycle, initialization,
 * and coordination between various services and providers.
 * 
 * @input {Object} context - CLI execution context with sessions and options
 * @output {void} - Manages application lifecycle
 * 
 * @dependencies
 * - services/window.service - Window lifecycle management
 * - services/tray.service - System tray management
 * - services/profile.manager - Profile management
 * - services/instance.manager - Instance and session management
 * - providers/provider.registry - Provider registration
 * - utils/error-recovery - Error handling utilities
 * - utils/transaction - Transaction management
 * 
 * @example
 * const appManager = require('./services/app.manager');
 * await appManager.initializeApp(context);
 */

const { app } = require('electron');
const log = require('electron-log');
const { ipcMain } = require('electron');
const windowService = require('./window.service');
const trayService = require('./tray.service');
const profileManager = require('./profile.manager');
const instanceManager = require('./instance.manager');
const providerRegistry = require('../providers');

// Import error recovery utilities
const { 
    ErrorCategory, 
    createError, 
    safeExecute, 
    logDiagnostics, 
} = require('../utils/error-recovery');
const { createTransaction, withTransaction } = require('../utils/transaction');

/**
 * Core application manager that handles lifecycle and coordination.
 * Responsible for:
 * - Application initialization and shutdown
 * - Window management
 * - Provider initialization
 * - Instance management
 * - IPC communication
 * @class AppManager
 */
class AppManager {
    /**
     * Creates a new AppManager instance
     * @constructor
     */
    constructor() {
        /** @property {boolean} isQuitting - Whether the app is in the process of quitting */
        this.isQuitting = false;
        this.initialized = false;
        
        this.setupEventHandlers();
        // Don't log initialization here as it's misleading
        // The actual initialization happens in initializeApp
    }

    /**
     * Set up core application event handlers for lifecycle management
     * @method setupEventHandlers
     */
    setupEventHandlers() {
        // Skip setting up event handlers if app object is not available
        if (!app || typeof app.on !== 'function') {
            log.warn('Electron app object not available, skipping event handler setup');
            return;
        }

        // Listen for last-session-closed event from instance manager
        try {
            instanceManager.on('last-session-closed', () => {
                log.info('Last session closed event received from instance manager');
                if (!this.isQuitting) {
                    this.quit();
                }
            });
        } catch (error) {
            log.warn('Could not set up last-session-closed event handler:', error);
        }

        // Handle window-all-closed event
        app.on('window-all-closed', () => {
            log.info('All windows closed, initiating application quit');
            // When the last window is closed, this is triggered automatically
            // and will call quit to clean up and exit the application
            if (!this.isQuitting) {
                this.quit();
            }
        });

        // Handle activate event (macOS)
        try {
            app.on('activate', () => {
                if (windowService && typeof windowService.getAllWindows === 'function' && 
                    windowService.getAllWindows().length === 0) {
                    this.createMainWindow();
                }
            });
        } catch (error) {
            log.warn('Could not set up activate event handler:', error);
        }

        // Handle second-instance event
        try {
            app.on('second-instance', (event, argv) => {
                this.handleSecondInstance(argv);
            });
        } catch (error) {
            log.warn('Could not set up second-instance event handler:', error);
        }

        // Handle quit events
        try {
            app.on('before-quit', async (event) => {
                log.info('Before-quit event triggered');
                
                if (!this.isQuitting) {
                    // Prevent quit until cleanup is done
                    event.preventDefault();
                    await this.quit();
                }
            });

            app.on('will-quit', async (event) => {
                log.info('Will-quit event triggered');
                
                if (!this.isQuitting) {
                    // Prevent quit until cleanup is done
                    event.preventDefault();
                    await this.quit();
                }
            });
        } catch (error) {
            log.warn('Could not set up quit event handlers:', error);
        }

        // Handle IPC messages
        this.setupIpcHandlers();
    }

    /**
     * Set up IPC event handlers for renderer communication
     * @method setupIpcHandlers
     */
    setupIpcHandlers() {
        // Skip IPC setup if ipcMain is not available
        if (!ipcMain || typeof ipcMain.handle !== 'function') {
            log.warn('Electron ipcMain not available, skipping IPC handler setup');
            return;
        }

        try {
            ipcMain.handle('get-app-info', () => {
                return {
                    version: app && typeof app.getVersion === 'function' ? app.getVersion() : '0.0.0',
                    name: app && typeof app.getName === 'function' ? app.getName() : 'desk-tray',
                    platform: process.platform
                };
            });
        } catch (error) {
            log.warn('Could not set up get-app-info IPC handler:', error);
        }

        try {
            ipcMain.handle('get-user-data-path', () => {
                if (app && typeof app.getPath === 'function') {
                    return app.getPath('userData');
                } else {
                    const os = require('os');
                    const path = require('path');
                    return path.join(os.tmpdir(), 'desk-tray');
                }
            });
        } catch (error) {
            log.warn('Could not set up get-user-data-path IPC handler:', error);
        }
    }

    /**
     * Create the main application window with default configuration
     * @method createMainWindow
     * @returns {Electron.BrowserWindow} The created window instance
     */
    createMainWindow() {
        const config = {
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: true
            }
        };

        return windowService.createWindow(config, 'main');
    }

    /**
     * Initialize the application
     * @method initializeApp
     * @param {Object} context - Initialization context from CLI
     * @returns {Promise<void>}
     */
    async initializeApp(context = {}) {
        const transaction = createTransaction('app-initialization');
        
        try {
            return await withTransaction(transaction, async () => {
                return await safeExecute(async () => {
                    log.info('Initializing app with context:', context);

                    // Get instance management settings from context
                    const instanceManagement = context.instanceManagement || {};
                    const profileIsolation = instanceManagement.profileIsolation !== false;
                    
                    log.info(`Profile isolation setting: ${profileIsolation}`);

                    // Initialize profile manager first
                    await profileManager.init();

                    // Initialize sessions if defined
                    if (context.sessions && Array.isArray(context.sessions) && context.sessions.length > 0) {
                        await this.initializeSessions(context.sessions, { profileIsolation });
                    }
                    // Initialize providers if defined and no sessions
                    else if (context.providers && Array.isArray(context.providers) && context.providers.length > 0) {
                        await this.initializeProviders(context.providers, { 
                            profile: context.profile || 'default',
                            profileIsolation
                        });
                    }
                    // No sessions or providers defined - check if defaults are available
                    else {
                        log.info('No sessions or providers defined, checking for available defaults');
                        const availableProviders = providerRegistry.getAvailableProviders();
                        
                        if (!availableProviders || availableProviders.length === 0) {
                            log.error('No providers are available and none were specified');
                            log.info('Application will exit as no services can be provided');
                            
                            // Exit gracefully
                            const { app } = require('electron');
                            if (app && typeof app.quit === 'function') {
                                app.quit();
                            } else {
                                process.exit(0);
                            }
                            return;
                        }
                        
                        log.info(`Found ${availableProviders.length} available providers, initializing defaults`);
                        await this.initializeDefaultProviders();
                    }

                    this.initialized = true;
                    log.info('Application initialization complete');
                }, {
                    errorMessage: 'Failed to initialize application',
                    category: ErrorCategory.INSTANCE_ERROR,
                    context: { initContext: context },
                    throwOnError: true
                });
            });
        } catch (error) {
            logDiagnostics('app-initialization-failed', { error, context });
            throw createError('Application initialization failed', {
                category: ErrorCategory.INSTANCE_ERROR,
                cause: error,
                context: { initContext: context }
            });
        }
    }

    /**
     * Initialize sessions with specified profiles
     * @method initializeSessions
     * @param {Array<Object>} sessions - Array of session objects with provider and profile
     * @param {Object} context - Execution context
     * @returns {Promise<Array>} Array of initialized provider instances
     */
    async initializeSessions(sessions, context = {}) {
        return await safeExecute(async () => {
            if (!sessions || !Array.isArray(sessions)) {
                log.warn('No sessions to initialize');
                return [];
            }

            log.info('Initializing sessions:', sessions);
            log.info('Session context:', context);

            // Default to profile isolation as per app_instances.md rules
            const profileIsolation = context.profileIsolation !== false;
            
            // Get all available providers
            const providers = providerRegistry.getAvailableProviders();
            const output = [];

            // Group sessions by profile if profile isolation is enabled
            const sessionsByProfile = {};
            
            for (const session of sessions) {
                const sessionTransaction = createTransaction(`session-init-${session.provider}-${session.profile || 'default'}`);
                
                try {
                    await withTransaction(sessionTransaction, async () => {
                        const { provider: providerName, profile = 'default' } = session;
                        
                        // Find the provider instance - match by command arg or provider name (case-insensitive)
                        const normalizedName = providerName.toLowerCase();
                        const provider = providers.find(p => 
                            p.commandArg.replace(/^--/, '').toLowerCase() === normalizedName ||
                            p.name.toLowerCase() === normalizedName
                        );
                        if (!provider) {
                            throw createError(`Provider not found: ${providerName}`, {
                                category: ErrorCategory.INSTANCE_ERROR,
                                context: { providerName, availableProviders: providers.map(p => `${p.name} (${p.commandArg})`) }
                            });
                        }

                        // Get partition name following the required format: ${app.getName()}:${providerName}:${profileName}
                        const partitionName = profileManager.getPartitionName(providerName, profile);
                        log.info(`Using partition: ${partitionName}`);

                        // Ensure profile exists, create if it doesn't
                        if (!profileManager.getProfile(providerName, profile)) {
                            log.info(`Creating new profile for ${providerName}: ${profile}`);
                            await profileManager.createProfile(providerName, profile);
                        }

                        // Initialize the provider with the specified profile
                        log.info(`Spawning ${providerName} with profile: ${profile}`);
                        
                        // Build spawn options with window show behavior if available
                        const spawnOptions = {};
                        if (context.windowShowBehavior) {
                            spawnOptions.windowShowBehavior = context.windowShowBehavior;
                            log.info(`Using window show behavior: ${context.windowShowBehavior} for ${providerName}`);
                        }
                        
                        // Pass temp flag from session to spawn options
                        if (session.isTemp) {
                            spawnOptions.isTemp = true;
                            log.info(`Setting temp mode for ${providerName}:${profile}`);
                        }
                        
                        const spawnArgs = Object.keys(spawnOptions).length > 0
                            ? [profile, spawnOptions]
                            : [profile];
                        const instance = await provider.spawn(...spawnArgs);
                        
                        // Verify instance was created successfully
                        if (!instance) {
                            throw createError(`Failed to spawn provider ${providerName} with profile ${profile}`, {
                                category: ErrorCategory.INSTANCE_ERROR,
                                context: { providerName, profile }
                            });
                        }

                        // Register the session with the instance manager using provider name, not command arg
                        await instanceManager.registerSession(provider.name, profile);

                        output.push(instance);
                        log.info(`Initialized ${providerName} with profile: ${profile}`);
                    });
                } catch (error) {
                    logDiagnostics('session-initialization-failed', { 
                        error, 
                        session, 
                        context 
                    });
                    log.error(`Error initializing session:`, error);
                    // Continue with other sessions even if one fails
                }
            }

            return output;
        }, {
            errorMessage: 'Failed to initialize sessions',
            category: ErrorCategory.INSTANCE_ERROR,
            context: { sessions, context }
        });
    }

    /**
     * Handle second instance arguments
     * @method handleSecondInstance
     * @param {Array<string>} args - Command line arguments from second instance
     * @param {Object} cliInstance - Optional CLI module for testing
     * @returns {Promise<void>}
     */
    async handleSecondInstance(args, cliInstance = null) {
        try {
            log.info('Handling second instance with args:', args);
            
            // Process the arguments through CLI first
            const cli = cliInstance || require('../cli');
            const cliResult = await cli.execute(args);
            
            // If it's not a CLI command, focus the main window
            if (!cliResult.isCliCommand) {
                const mainWindow = typeof windowService.getWindow === 'function'
                    ? windowService.getWindow('main')
                    : null;
                if (mainWindow) {
                    if (mainWindow.isMinimized()) {
                        mainWindow.restore();
                    }
                    mainWindow.focus();
                }
            }
        } catch (error) {
            log.error('Error handling second instance:', error);
        }
    }

    /**
     * Initialize default providers
     * @method initializeDefaultProviders
     * @returns {Promise<void>}
     */
    async initializeDefaultProviders() {
        try {
            log.info('Initializing default providers');
            
            // Check if any providers are available
            const availableProviders = providerRegistry.getAvailableProviders();
            if (!availableProviders || availableProviders.length === 0) {
                log.error('No providers are available - cannot initialize any services');
                log.info('Application will exit as no services can be provided');
                
                // Exit gracefully
                const { app } = require('electron');
                if (app && typeof app.quit === 'function') {
                    app.quit();
                } else {
                    process.exit(0);
                }
                return;
            }
            
            log.info(`Found ${availableProviders.length} available providers:`, 
                availableProviders.map(p => p.name));
            
            // Get active profile
            const activeProfile = typeof profileManager.getActiveProfile === 'function'
                ? await profileManager.getActiveProfile()
                : null;
            
            if (activeProfile) {
                // Verify the active profile's provider is available
                const providerExists = availableProviders.some(p => 
                    p.commandArg.replace(/^--/, '') === activeProfile.provider);
                
                if (providerExists) {
                    log.info(`Using active profile: ${activeProfile.name} (${activeProfile.provider})`);
                    await this.initializeProviders([activeProfile.provider]);
                } else {
                    log.warn(`Active profile provider '${activeProfile.provider}' not available, falling back to defaults`);
                    await this.initializeDefaultProviderFallback(availableProviders);
                }
            } else {
                log.info('No active profile found, using default providers');
                await this.initializeDefaultProviderFallback(availableProviders);
            }
        } catch (error) {
            log.error('Error initializing default providers:', error);
            throw error;
        }
    }

    /**
     * Initialize fallback default providers when no active profile or provider unavailable
     * @method initializeDefaultProviderFallback
     * @param {Array} availableProviders - List of available providers
     * @returns {Promise<void>}
     * @private
     */
    async initializeDefaultProviderFallback(availableProviders) {
        // Try to use WhatsApp as default if available
        const whatsappProvider = availableProviders.find(p => 
            p.commandArg.replace(/^--/, '') === 'whatsapp');
        
        if (whatsappProvider) {
            log.info('Using WhatsApp as default provider');
            await this.initializeProviders(['whatsapp']);
        } else {
            // Use the first available provider
            const firstProvider = availableProviders[0];
            const providerName = firstProvider.commandArg.replace(/^--/, '');
            log.info(`WhatsApp not available, using first available provider: ${providerName}`);
            await this.initializeProviders([providerName]);
        }
    }

    /**
     * Initialize specified providers
     * @method initializeProviders
     * @param {Array<string>} providers - List of provider names to initialize
     * @param {Object} context - Execution context
     * @returns {Promise<void>}
     */
    async initializeProviders(providers, context = {}) {
        try {
            if (!providers || !Array.isArray(providers) || providers.length === 0) {
                log.warn('No providers specified to initialize');
                return;
            }

            log.info('Initializing providers:', providers, context);

            // Convert providers array to sessions array with proper profile handling
            const sessions = providers.map(provider => {
                const session = {
                    provider,
                    profile: context.profile || 'default'
                };
                if (context.isTemp) {
                    session.isTemp = true;
                }
                return session;
            });

            // Initialize sessions
            await this.initializeSessions(sessions, context);
        } catch (error) {
            log.error('Error initializing providers:', error);
            throw error;
        }
    }

    /**
     * Initialize services required for application functionality
     * @method initializeServices
     * @returns {Promise<void>}
     */
    async initializeServices() {
        try {
            log.info('Initializing core services');
            await trayService.init();
            await windowService.init();
            log.info('Core services initialized');
        } catch (error) {
            log.error('Error initializing services:', error);
            throw error;
        }
    }

    /**
     * Start the application
     * @method start
     * @param {Object} cliResult - Result from CLI execution
     * @returns {Promise<boolean>}
     */
    async start(cliResult = null) {
        try {
            // Initialize core services
            await this.initializeServices();
            
            // Ensure instance directories exist
            await instanceManager.ensureDirectories();

            // Process any sessions that were handled by CLI modules
            if (cliResult && cliResult.context.sessions && cliResult.context.sessions.length > 0) {
                log.info('Processing sessions from CLI context:', cliResult.context.sessions);
                await this.initializeSessions(cliResult.context.sessions, cliResult.context);
            } else {
                // Initialize default providers if no specific ones were processed
                await this.initializeDefaultProviders();
            }

            // Set up global shortcuts
            this.setupGlobalShortcuts();

            return true;
        } catch (error) {
            log.error('Error starting application:', error);
            return false;
        }
    }

    /**
     * Register global keyboard shortcuts. In tests this safely no-ops.
     */
    setupGlobalShortcuts() {
        try {
            const { globalShortcut } = require('electron');
            if (!globalShortcut || typeof globalShortcut.register !== 'function') {
                log.warn('Global shortcuts not available');
                return;
            }

            globalShortcut.register('CommandOrControl+R', () => {
                const mainWindow = typeof windowService.getWindow === 'function'
                    ? windowService.getWindow('main')
                    : null;
                if (mainWindow && typeof mainWindow.reload === 'function') {
                    mainWindow.reload();
                }
            });
        } catch (error) {
            log.warn('Failed to register global shortcuts:', error);
        }
    }

    /**
     * Quit the application
     * @method quit
     */
    async quit() {
        if (this.isQuitting) {
            log.info('Quit already in progress');
            return;
        }

        log.info('Initiating application quit');

        const transaction = createTransaction('app-shutdown');
        
        try {
            await withTransaction(transaction, async () => {
                await safeExecute(async () => {
                    // Set quit flags first to prevent window hiding
                    this.isQuitting = true;
                    windowService.isQuitting = true;

                    // Clean up tray first to prevent user interaction
                    const trayService = require('./tray.service');
                    await trayService.cleanup();

                    // Clean up instance manager
                    const instanceManager = require('./instance.manager');
                    await instanceManager.cleanup();

                    // Clean up logging to prevent EPIPE errors during exit
                    const loggingService = require('./logging.service');
                    await loggingService.cleanup();

                    // Force close any remaining windows
                    const windows = windowService.getAllWindows();
                    for (const window of windows) {
                        if (!window.isDestroyed()) {
                            log.info(`Force closing window: ${window.windowName || 'unnamed'}`);
                            window.forceClose = true;
                            window.close();
                        }
                    }

                    // Exit application after cleanup completes
                    log.info('Exiting application');
                    if (app && typeof app.exit === 'function') {
                        app.exit(0);
                    } else if (app && typeof app.quit === 'function') {
                        app.quit();
                    } else {
                        process.exit(0);
                    }
                }, {
                    errorMessage: 'Failed during application shutdown',
                    category: ErrorCategory.INSTANCE_ERROR,
                    context: { shutdownPhase: 'cleanup' }
                });
            });
        } catch (error) {
            logDiagnostics('app-shutdown-failed', { error });
            log.error('Error during quit:', error);
            if (app && typeof app.exit === 'function') {
                app.exit(1);
            } else {
                process.exit(1);
            }
        }
    }
}

// Export singleton instance
module.exports = new AppManager();
