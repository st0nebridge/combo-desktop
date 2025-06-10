/**
 * @file Core application manager that handles lifecycle, initialization,
 * and coordination between various services and providers.
 */

const { app, BrowserWindow } = require('electron');
const log = require('electron-log');
const { ipcMain } = require('electron');
const windowService = require('./window.service');
const trayService = require('./tray.service');
const profileManager = require('./profile.manager');
// Use stub implementation instead of the corrupted instance manager
const instanceManager = require('./instance.manager');
const providerRegistry = require('../providers');
const path = require('path');
const fs = require('fs');
const { globalShortcut } = require('electron');

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
        } catch (error) {
            log.warn('Could not set up before-quit event handler:', error);
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
        try {
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
            // No sessions or providers defined
            else {
                log.info('No sessions or providers defined, initializing default providers');
                await this.initializeProviders([], { 
                    profile: context.profile || 'default',
                    profileIsolation
                });
            }

            log.info('App initialization complete');
        } catch (error) {
            log.error('Error initializing app:', error);
            throw error;
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
        try {
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
                try {
                    const { provider: providerName, profile = 'default' } = session;
                    
                    // Find the provider instance
                    const provider = providers.find(p => p.commandArg.replace(/^--/, '') === providerName);
                    if (!provider) {
                        log.error(`Provider not found: ${providerName}`);
                        continue;
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
                    const instance = await provider.spawn(profile);
                    
                    // Verify instance was created successfully
                    if (!instance) {
                        throw new Error(`Failed to spawn provider ${providerName} with profile ${profile}`);
                    }

                    // Register the session with the instance manager
                    await instanceManager.registerSession(providerName, profile);

                    output.push(instance);
                    log.info(`Initialized ${providerName} with profile: ${profile}`);
                } catch (error) {
                    log.error(`Error initializing session:`, error);
                    // Continue with other sessions even if one fails
                }
            }

            return output;
        } catch (error) {
            log.error('Error initializing sessions:', error);
            throw error;
        }
    }

    /**
     * Handle second instance arguments
     * @method handleSecondInstance
     * @param {Array<string>} args - Command line arguments from second instance
     * @returns {Promise<void>}
     */
    async handleSecondInstance(args) {
        try {
            log.info('Handling second instance with args:', args);
            
            // Process the arguments through CLI first
            const cli = require('../cli');
            const cliResult = await cli.execute(args);
            
            // If it's not a CLI command, focus the main window
            if (!cliResult.isCliCommand) {
                const mainWindow = windowService.getWindow('main');
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
            // Get active profile
            const activeProfile = await profileManager.getActiveProfile();
            
            if (activeProfile) {
                log.info(`Using active profile: ${activeProfile.name} (${activeProfile.provider})`);
                await this.initializeProviders([activeProfile.provider]);
            } else {
                log.info('No active profile found, using default providers');
                // Initialize default providers
                const defaultProviders = ['whatsapp'];
                await this.initializeProviders(defaultProviders);
            }
        } catch (error) {
            log.error('Error initializing default providers:', error);
            throw error;
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
            if (!providers || !Array.isArray(providers)) {
                log.warn('No providers to initialize');
                return;
            }

            log.info('Initializing providers:', providers, context);

            // Convert providers array to sessions array with proper profile handling
            const sessions = providers.map(provider => ({
                provider,
                profile: context.profile || 'default'
            }));

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
                await this.initializeSessions(cliResult.context.sessions);
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
     * Quit the application
     * @method quit
     */
    async quit() {
        if (this.isQuitting) {
            log.info('Quit already in progress');
            return;
        }

        log.info('Initiating application quit');

        try {
            // Set quit flags first to prevent window hiding
            this.isQuitting = true;
            windowService.isQuitting = true;

            // Clean up tray first to prevent user interaction
            const trayService = require('./tray.service');
            await trayService.cleanup();

            // Clean up instance manager
            const instanceManager = require('./instance.manager');
            await instanceManager.cleanup();

            // Force close any remaining windows
            const windows = windowService.getAllWindows();
            for (const window of windows) {
                if (!window.isDestroyed()) {
                    log.info(`Force closing window: ${window.windowName || 'unnamed'}`);
                    window.forceClose = true;
                    window.close();
                }
            }

            // Exit application
            log.info('Exiting application');
            app.exit(0);
        } catch (error) {
            log.error('Error during quit:', error);
            app.exit(1);
        }
    }
}

// Export singleton instance
module.exports = new AppManager();
