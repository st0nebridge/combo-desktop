/**
 * @file Comprehensive test suite for app.manager.js
 * Tests application lifecycle, initialization, and coordination between services.
 */

const path = require('path');

// Mock Electron before requiring any modules that use it
const mockElectron = {
    app: {
        name: 'combo-desktop-test',
        on: jest.fn(),
        exit: jest.fn(),
        quit: jest.fn(),
        getVersion: () => '1.0.0',
        getName: () => 'combo-desktop-test',
        getPath: (type) => {
            if (type === 'userData') return '/tmp/test-userdata';
            return '/tmp/test';
        }
    },
    BrowserWindow: function() { return {}; },
    ipcMain: {
        handle: jest.fn(),
        on: jest.fn()
    },
    globalShortcut: {
        register: jest.fn(),
        unregister: jest.fn()
    }
};

jest.mock('electron', () => mockElectron);

// Mock file system operations
jest.mock('fs', () => ({
    existsSync: jest.fn(() => true),
    readFileSync: jest.fn(() => '{}'),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    statSync: jest.fn(() => ({ isDirectory: () => true }))
}));

// Mock the services
jest.mock('../../src/services/window.service', () => ({
    init: jest.fn(),
    createWindow: jest.fn(),
    getAllWindows: jest.fn(() => []),
    getWindow: jest.fn(),
    isQuitting: false
}));

jest.mock('../../src/services/tray.service', () => ({
    init: jest.fn(),
    cleanup: jest.fn()
}));

jest.mock('../../src/services/profile.manager', () => ({
    init: jest.fn(),
    getPartitionName: jest.fn((provider, profile) => `test:${provider}:${profile}`),
    getProfile: jest.fn(() => null),
    createProfile: jest.fn(),
    getActiveProfile: jest.fn(() => null)
}));

jest.mock('../../src/services/instance.manager', () => ({
    ensureDirectories: jest.fn(),
    registerSession: jest.fn(),
    cleanup: jest.fn(),
    on: jest.fn()
}));

jest.mock('../../src/providers', () => ({
    getAvailableProviders: jest.fn(() => [
        {
            commandArg: '--whatsapp',
            name: 'whatsapp',
            getName: () => 'WhatsApp',
            spawn: jest.fn(() => Promise.resolve({ id: 'test-instance' }))
        }
    ])
}));

// Mock electron-log
jest.mock('electron-log', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

const AppManager = require('../../src/services/app.manager');
const windowService = require('../../src/services/window.service');
const trayService = require('../../src/services/tray.service');
const profileManager = require('../../src/services/profile.manager');
const instanceManager = require('../../src/services/instance.manager');
const providerRegistry = require('../../src/providers');

describe('AppManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset app manager state
        AppManager.isQuitting = false;
        AppManager.initialized = false;

        // Ensure mocked services return defaults after clearing mocks
        windowService.getAllWindows.mockReturnValue([]);
        const electron = require('electron');
        if (electron && electron.app) {
            electron.app.on.mockClear();
            electron.app.exit.mockClear();
            electron.app.quit.mockClear();
        }
        if (electron && electron.ipcMain) {
            electron.ipcMain.handle.mockClear();
            electron.ipcMain.on.mockClear();
        }
    });

    describe('Constructor', () => {
        test('should initialize with default properties', () => {
            expect(AppManager.isQuitting).toBe(false);
            expect(AppManager.initialized).toBe(false);
        });
    });

    describe('setupEventHandlers', () => {
        test('should setup electron app event handlers', () => {
            const { app } = require('electron');
            AppManager.setupEventHandlers();
            
            expect(app.on).toHaveBeenCalledWith('window-all-closed', expect.any(Function));
            expect(app.on).toHaveBeenCalledWith('activate', expect.any(Function));
            expect(app.on).toHaveBeenCalledWith('second-instance', expect.any(Function));
            expect(app.on).toHaveBeenCalledWith('before-quit', expect.any(Function));
        });

        test('should handle missing electron app gracefully', () => {
            const electron = require('electron');
            const originalApp = electron.app;
            electron.app = null;

            expect(() => {
                AppManager.setupEventHandlers();
            }).not.toThrow();

            electron.app = originalApp;
        });
    });

    describe('setupIpcHandlers', () => {
        test('should setup IPC handlers', () => {
            const { ipcMain } = require('electron');
            AppManager.setupIpcHandlers();
            
            expect(ipcMain.handle).toHaveBeenCalledWith('get-app-info', expect.any(Function));
            expect(ipcMain.handle).toHaveBeenCalledWith('get-user-data-path', expect.any(Function));
        });
    });

    describe('createMainWindow', () => {
        test('should create main window with default config', () => {
            const mockWindow = { id: 'main-window' };
            windowService.createWindow.mockReturnValue(mockWindow);
            
            const result = AppManager.createMainWindow();
            
            expect(windowService.createWindow).toHaveBeenCalledWith(
                expect.objectContaining({
                    width: 1200,
                    height: 800,
                    webPreferences: expect.objectContaining({
                        nodeIntegration: false,
                        contextIsolation: true,
                        webSecurity: true
                    })
                }),
                'main'
            );
            expect(result).toBe(mockWindow);
        });
    });

    describe('initializeApp', () => {
        test('should initialize app with empty context', async () => {
            profileManager.init.mockResolvedValue(true);
            
            await AppManager.initializeApp();
            
            expect(profileManager.init).toHaveBeenCalled();
            expect(AppManager.initialized).toBe(true);
        });

        test('should initialize app with sessions', async () => {
            const context = {
                sessions: [
                    { provider: 'whatsapp', profile: 'default' }
                ],
                instanceManagement: { profileIsolation: true }
            };
            
            profileManager.init.mockResolvedValue(true);
            profileManager.getProfile.mockReturnValue(null);
            
            await AppManager.initializeApp(context);
            
            expect(profileManager.init).toHaveBeenCalled();
            expect(AppManager.initialized).toBe(true);
        });

        test('should initialize app with providers', async () => {
            const context = {
                providers: ['whatsapp'],
                profile: 'test-profile',
                instanceManagement: { profileIsolation: true }
            };
            
            profileManager.init.mockResolvedValue(true);
            
            await AppManager.initializeApp(context);
            
            expect(profileManager.init).toHaveBeenCalled();
            expect(AppManager.initialized).toBe(true);
        });

        test('should handle initialization errors', async () => {
            profileManager.init.mockRejectedValue(new Error('Init failed'));
            
            await expect(AppManager.initializeApp()).rejects.toThrow();
            expect(AppManager.initialized).toBe(false);
        });
    });

    describe('initializeSessions', () => {
        test('should initialize empty sessions array', async () => {
            const result = await AppManager.initializeSessions([]);
            expect(result).toEqual([]);
        });

        test('should initialize valid sessions', async () => {
            const sessions = [
                { provider: 'whatsapp', profile: 'default' }
            ];
            
            profileManager.getProfile.mockReturnValue(null);
            profileManager.createProfile.mockReturnValue('test:whatsapp:default');
            
            const providers = [
                {
                    commandArg: '--whatsapp',
                    name: 'whatsapp',
                    spawn: jest.fn().mockResolvedValue({ id: 'test-instance' })
                }
            ];
            providerRegistry.getAvailableProviders.mockReturnValue(providers);
            
            const result = await AppManager.initializeSessions(sessions);
            
            expect(profileManager.createProfile).toHaveBeenCalledWith('whatsapp', 'default');
            expect(providers[0].spawn).toHaveBeenCalledWith('default');
            expect(instanceManager.registerSession).toHaveBeenCalledWith('whatsapp', 'default');
            expect(result).toHaveLength(1);
        });

        test('should handle provider not found', async () => {
            const sessions = [
                { provider: 'nonexistent', profile: 'default' }
            ];
            
            providerRegistry.getAvailableProviders.mockReturnValue([]);
            
            const result = await AppManager.initializeSessions(sessions);
            expect(result).toEqual([]);
        });

        test('should handle session initialization failure', async () => {
            const sessions = [
                { provider: 'whatsapp', profile: 'default' }
            ];
            
            const providers = [
                {
                    commandArg: '--whatsapp',
                    spawn: jest.fn().mockRejectedValue(new Error('Spawn failed'))
                }
            ];
            providerRegistry.getAvailableProviders.mockReturnValue(providers);
            
            const result = await AppManager.initializeSessions(sessions);
            expect(result).toEqual([]);
        });
    });

    describe('initializeProviders', () => {
        test('should initialize providers array', async () => {
            const providers = ['whatsapp'];
            const context = { profile: 'test' };
            
            jest.spyOn(AppManager, 'initializeSessions').mockResolvedValue([]);
            
            await AppManager.initializeProviders(providers, context);
            
            expect(AppManager.initializeSessions).toHaveBeenCalledWith(
                [{ provider: 'whatsapp', profile: 'test' }],
                context
            );
        });

        test('should handle empty providers array', async () => {
            await expect(AppManager.initializeProviders([])).resolves.not.toThrow();
        });

        test('should handle null providers', async () => {
            await expect(AppManager.initializeProviders(null)).resolves.not.toThrow();
        });
    });

    describe('initializeServices', () => {
        test('should initialize core services', async () => {
            trayService.init.mockResolvedValue();
            windowService.init.mockResolvedValue();
            
            await AppManager.initializeServices();
            
            expect(trayService.init).toHaveBeenCalled();
            expect(windowService.init).toHaveBeenCalled();
        });

        test('should handle service initialization errors', async () => {
            trayService.init.mockRejectedValue(new Error('Tray init failed'));
            
            await expect(AppManager.initializeServices()).rejects.toThrow('Tray init failed');
        });
    });

    describe('start', () => {
        test('should start application successfully', async () => {
            trayService.init.mockResolvedValue();
            windowService.init.mockResolvedValue();
            instanceManager.ensureDirectories.mockResolvedValue();
            jest.spyOn(AppManager, 'initializeDefaultProviders').mockResolvedValue();
            jest.spyOn(AppManager, 'setupGlobalShortcuts').mockImplementation(() => {});
            
            const result = await AppManager.start();
            
            expect(result).toBe(true);
            expect(instanceManager.ensureDirectories).toHaveBeenCalled();
        });

        test('should handle start errors', async () => {
            trayService.init.mockRejectedValue(new Error('Start failed'));
            
            const result = await AppManager.start();
            expect(result).toBe(false);
        });

        test('should process CLI sessions', async () => {
            const cliResult = {
                context: {
                    sessions: [{ provider: 'whatsapp', profile: 'default' }]
                }
            };
            
            trayService.init.mockResolvedValue();
            windowService.init.mockResolvedValue();
            instanceManager.ensureDirectories.mockResolvedValue();
            jest.spyOn(AppManager, 'initializeSessions').mockResolvedValue([]);
            jest.spyOn(AppManager, 'setupGlobalShortcuts').mockImplementation(() => {});
            
            const result = await AppManager.start(cliResult);
            
            expect(AppManager.initializeSessions).toHaveBeenCalledWith(
                cliResult.context.sessions,
                cliResult.context
            );
            expect(result).toBe(true);
        });
    });

    describe('handleSecondInstance', () => {
        test('should handle second instance with CLI args', async () => {
            const args = ['--whatsapp'];
            const mockCli = {
                execute: jest.fn().mockResolvedValue({ isCliCommand: true })
            };
            
            await AppManager.handleSecondInstance(args, mockCli);
            
            // Should not throw error
        });

        test('should focus main window for non-CLI commands', async () => {
            const args = ['regular-arg'];
            const mockWindow = {
                isMinimized: jest.fn(() => false),
                focus: jest.fn()
            };
            windowService.getWindow.mockReturnValue(mockWindow);
            
            const mockCli = {
                execute: jest.fn().mockResolvedValue({ isCliCommand: false })
            };
            
            await AppManager.handleSecondInstance(args, mockCli);
            
            expect(mockWindow.focus).toHaveBeenCalled();
        });
    });

    describe('quit', () => {
        test('should quit application cleanly', async () => {
            const { app } = require('electron');
            AppManager.isQuitting = false;
            
            trayService.cleanup.mockResolvedValue();
            instanceManager.cleanup.mockResolvedValue();
            windowService.getAllWindows.mockReturnValue([]);
            
            await AppManager.quit();
            
            expect(AppManager.isQuitting).toBe(true);
            expect(trayService.cleanup).toHaveBeenCalled();
            expect(instanceManager.cleanup).toHaveBeenCalled();
        });

        test('should handle quit already in progress', async () => {
            AppManager.isQuitting = true;
            
            await AppManager.quit();
            
            expect(trayService.cleanup).not.toHaveBeenCalled();
        });

        test('should force close remaining windows', async () => {
            const mockWindow = {
                isDestroyed: jest.fn(() => false),
                close: jest.fn()
            };
            windowService.getAllWindows.mockReturnValue([mockWindow]);
            
            trayService.cleanup.mockResolvedValue();
            instanceManager.cleanup.mockResolvedValue();
            
            await AppManager.quit();
            
            expect(AppManager.isQuitting).toBe(true);
        });

        test('should handle quit errors', async () => {
            const { app } = require('electron');
            trayService.cleanup.mockRejectedValue(new Error('Cleanup failed'));
            
            await AppManager.quit();
            
            expect(AppManager.isQuitting).toBe(true);
        });
    });

    describe('Error Recovery Integration', () => {
        test('should use error recovery utilities', async () => {
            const { safeExecute, createError } = require('../../src/utils/error-recovery');
            
            // Test that error recovery functions are available
            expect(typeof safeExecute).toBe('function');
            expect(typeof createError).toBe('function');
        });

        test('should handle errors with proper categorization', async () => {
            profileManager.init.mockRejectedValue(new Error('Profile init failed'));
            
            try {
                await AppManager.initializeApp();
            } catch (error) {
                expect(error.message).toContain('Application initialization failed');
            }
        });
    });
});
