/**
 * Integration coverage for window show behavior and CLI interactions.
 */

const path = require('path');

jest.mock('electron-log', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    transports: {
        console: { level: 'info', format: '' },
        file: { level: 'info', format: '' }
    }
}));

jest.mock('../../src/services/logging.service', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    initializeLogging: jest.fn()
}));

jest.mock('../../src/providers/provider.registry', () => ({
    getAvailableProviders: jest.fn(() => [{
        name: 'WhatsApp',
        commandArg: '--whatsapp',
        spawn: jest.fn(async () => ({ id: 'mock', window: {} }))
    }]),
    getProvider: jest.fn()
}));

jest.mock('electron-localshortcut', () => ({
    register: jest.fn(),
    unregisterAll: jest.fn()
}));

jest.mock('../../src/services/instance.manager', () => ({
    registerSession: jest.fn(() => true),
    ensureDirectories: jest.fn(),
    cleanup: jest.fn(),
    on: jest.fn()
}));

const mockSharedWindow = {
    show: jest.fn(),
    hide: jest.fn(),
    focus: jest.fn(),
    minimize: jest.fn(),
    showInactive: jest.fn(),
    moveTop: jest.fn(),
    isDestroyed: jest.fn(() => false),
    isVisible: jest.fn(() => true),
    isMinimized: jest.fn(() => false),
    restore: jest.fn(),
    webContents: {
        loadURL: jest.fn().mockResolvedValue(),
        setUserAgent: jest.fn(),
        on: jest.fn(),
        session: {}
    }
};

jest.mock('../../src/services/window.service', () => ({
    createWindow: jest.fn(() => ({ ...mockSharedWindow })),
    getWindow: jest.fn(() => null),
    getAllWindows: jest.fn(() => []),
    init: jest.fn(),
    isQuitting: false
}));

jest.mock('../../src/services/tray.service', () => ({
    init: jest.fn(),
    createTray: jest.fn(),
    cleanup: jest.fn()
}));

jest.mock('../../src/services/profile.manager', () => ({
    init: jest.fn().mockResolvedValue(true),
    getPartitionName: jest.fn((provider, profile) => `app:${provider}:${profile}`),
    getProfile: jest.fn(() => null),
    createProfile: jest.fn(),
    getActiveProfile: jest.fn(() => null)
}));

const mockElectron = {
    app: {
        getName: () => 'combo-desktop',
        getVersion: () => '1.0.0',
        getPath: (type) => (type === 'userData' ? path.join(__dirname, 'test-data') : '/tmp/test'),
        on: jest.fn(),
        emit: jest.fn(),
        exit: jest.fn(),
        quit: jest.fn()
    },
    BrowserWindow: class MockBrowserWindow {
        constructor(options) {
            this.options = options;
            this.webContents = {
                on: jest.fn(),
                once: jest.fn(),
                loadURL: jest.fn().mockResolvedValue(),
                setUserAgent: jest.fn(),
                session: {}
            };
        }
        on = jest.fn();
        once = jest.fn();
        show = jest.fn();
        hide = jest.fn();
        focus = jest.fn();
        minimize = jest.fn();
        showInactive = jest.fn();
        moveTop = jest.fn();
        isDestroyed = jest.fn(() => false);
        isVisible = jest.fn(() => true);
        isFocused = jest.fn(() => false);
    },
    session: {
        fromPartition: () => ({
            setUserAgent: jest.fn(),
            clearStorageData: jest.fn(() => Promise.resolve())
        })
    },
    shell: { openExternal: jest.fn() },
    ipcMain: { on: jest.fn(), handle: jest.fn() },
    Tray: class MockTray { constructor() { this.destroy = jest.fn(); } },
    Menu: { buildFromTemplate: () => ({ popup: jest.fn() }) },
    globalShortcut: { register: jest.fn(), unregister: jest.fn() }
};

jest.mock('electron', () => mockElectron);

describe('Window Show Behavior Integration', () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    test('CLI parses window-show argument correctly', () => {
        const ProviderCLI = require('../../src/cli/modules/provider-cli');
        const cli = new ProviderCLI();

        const args = ['--whatsapp', '--window-show', 'hidden', '--profile', 'test'];
        const result = cli.parseArgs(args);

        expect(result.windowShowBehavior).toBe('hidden');
        expect(result.sessions[0]).toMatchObject({ provider: 'whatsapp', profile: 'test' });
    });

    test('CLI execution passes windowShowBehavior to context', async () => {
        const ProviderCLI = require('../../src/cli/modules/provider-cli');
        const cli = new ProviderCLI();

        const args = ['--facebook', '--window-show', 'minimize'];
        const result = await cli.execute(args, {});

        expect(result.context.windowShowBehavior).toBe('minimize');
        expect(result.success).toBeDefined();
    });

    test('BaseProvider stores and validates window show behavior', () => {
        const BaseProvider = require('../../src/providers/abstract/base.provider');
        class TestProvider extends BaseProvider {
            getName() { return 'Test'; }
            getCommandArg() { return '--test'; }
            getUrl() { return 'https://test.com'; }
            getBaseIconPath() { return '/test'; }
        }

        const provider = new TestProvider();
        expect(provider.getWindowShowBehavior()).toBe('auto');

        provider.setWindowShowBehavior('hidden');
        expect(provider.getWindowShowBehavior()).toBe('hidden');

        expect(() => provider.setWindowShowBehavior('invalid')).toThrow('Invalid window show behavior');
    });

    test('Provider Registry spawn method accepts options parameter', async () => {
        const providerRegistry = require('../../src/providers/provider.registry');
        const providers = providerRegistry.getAvailableProviders();

        expect(providers.length).toBeGreaterThan(0);
        const whatsappProvider = providers.find((p) => p.name === 'WhatsApp');
        expect(whatsappProvider).toBeDefined();

        await expect(
            whatsappProvider.spawn('test', { windowShowBehavior: 'background' })
        ).resolves.toBeDefined();
    });

    test('App Manager passes windowShowBehavior through initializeSessions', async () => {
        const appManager = require('../../src/services/app.manager');
        const providerRegistry = require('../../src/providers/provider.registry');

        const originalGetAvailableProviders = providerRegistry.getAvailableProviders.bind(providerRegistry);
        const spawnSpy = jest.fn().mockResolvedValue({});
        providerRegistry.getAvailableProviders = () => [{
            name: 'WhatsApp',
            commandArg: '--whatsapp',
            spawn: spawnSpy
        }];

        try {
            const sessions = [{ provider: 'whatsapp', profile: 'test' }];
            const context = { windowShowBehavior: 'minimize' };
            await appManager.initializeSessions(sessions, context);
        } finally {
            providerRegistry.getAvailableProviders = originalGetAvailableProviders;
        }

        expect(spawnSpy).toHaveBeenCalledWith('test', { windowShowBehavior: 'minimize' });
    });

    test('Window show behaviors are applied correctly', async () => {
        const BaseProvider = require('../../src/providers/abstract/base.provider');
        class TestProvider extends BaseProvider {
            getName() { return 'Test'; }
            getCommandArg() { return '--test'; }
            getUrl() { return 'https://test.com'; }
            getBaseIconPath() { return '/test'; }
        }

        const provider = new TestProvider();
        provider.window = { ...mockSharedWindow };

        provider.setWindowShowBehavior('auto');
        await provider.applyWindowShowBehavior(false);
        expect(provider.window.show).toHaveBeenCalled();
        expect(provider.window.focus).toHaveBeenCalled();

        provider.window.show.mockClear();
        provider.window.focus.mockClear();
        provider.window.hide.mockClear();
        provider.window.showInactive.mockClear();
        provider.window.moveTop.mockClear();

        provider.setWindowShowBehavior('hidden');
        await provider.applyWindowShowBehavior(false);
        expect(provider.window.hide).toHaveBeenCalled();

        provider.setWindowShowBehavior('minimize');
        await provider.applyWindowShowBehavior(false);
        expect(provider.window.hide).toHaveBeenCalled();

        provider.setWindowShowBehavior('background');
        await provider.applyWindowShowBehavior(false);
        expect(provider.window.showInactive).toHaveBeenCalled();

        provider.setWindowShowBehavior('bring-to-front');
        await provider.applyWindowShowBehavior(true);
        expect(provider.window.moveTop).toHaveBeenCalled();
    });

    test('CLI help includes window-show option', () => {
        const ProviderCLI = require('../../src/cli/modules/provider-cli');
        const cli = new ProviderCLI();

        let helpOutput = '';
        const originalLog = console.log;
        console.log = (msg) => { helpOutput += `${msg}\n`; };

        try {
            cli.showUsage();
        } finally {
            console.log = originalLog;
        }

        expect(helpOutput).toContain('--window-show');
        expect(helpOutput).toMatch(/auto, minimize, hidden, background, bring-to-front/);
    });
});
