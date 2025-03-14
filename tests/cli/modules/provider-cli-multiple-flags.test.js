/**
 * @file Tests for the provider-cli module with multiple provider flags
 */

const ProviderCLI = require('../../../src/cli/modules/provider-cli');
const providerRegistry = require('../../../src/providers');

// Mock the provider registry
jest.mock('../../../src/providers', () => ({
    getAvailableProviders: jest.fn()
}));

// Mock the logging service
jest.mock('../../../src/services/logging.service', () => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

describe('ProviderCLI with multiple provider flags', () => {
    let providerCli;
    
    beforeEach(() => {
        // Setup mock providers
        providerRegistry.getAvailableProviders.mockReturnValue([
            { name: 'WhatsApp', commandArg: '--whatsapp' },
            { name: 'Facebook', commandArg: '--facebook' },
            { name: 'Telegram', commandArg: '--telegram' }
        ]);
        
        // Create a new instance for each test
        providerCli = new ProviderCLI();
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });
    
    test('should handle multiple instances of the same provider flag', () => {
        // Test with multiple instances of the same provider flag
        const args = ['--whatsapp', '--facebook', '--whatsapp', 'work'];
        const result = providerCli.parseArgs(args);
        
        // Should have both providers in the providers array
        expect(result.providers).toContain('whatsapp');
        expect(result.providers).toContain('facebook');
        
        // Should have both WhatsApp sessions in the sessions array
        expect(result.sessions).toHaveLength(3);
        
        // Check for default WhatsApp session
        expect(result.sessions).toContainEqual({
            provider: 'whatsapp',
            profile: 'default'
        });
        
        // Check for work WhatsApp session
        expect(result.sessions).toContainEqual({
            provider: 'whatsapp',
            profile: 'work'
        });
        
        // Check for default Facebook session
        expect(result.sessions).toContainEqual({
            provider: 'facebook',
            profile: 'default'
        });
    });
    
    test('should handle multiple instances with different profiles', () => {
        // Test with multiple instances of multiple providers with different profiles
        const args = ['--whatsapp', 'personal', '--facebook', 'work', '--whatsapp', 'business'];
        const result = providerCli.parseArgs(args);
        
        // Should have both providers in the providers array
        expect(result.providers).toContain('whatsapp');
        expect(result.providers).toContain('facebook');
        
        // Should have all sessions in the sessions array
        expect(result.sessions).toHaveLength(3);
        
        // Check for personal WhatsApp session
        expect(result.sessions).toContainEqual({
            provider: 'whatsapp',
            profile: 'personal'
        });
        
        // Check for business WhatsApp session
        expect(result.sessions).toContainEqual({
            provider: 'whatsapp',
            profile: 'business'
        });
        
        // Check for work Facebook session
        expect(result.sessions).toContainEqual({
            provider: 'facebook',
            profile: 'work'
        });
    });
    
    test('should handle multiple instances with no profiles', () => {
        // Test with multiple instances of the same provider with no profiles
        const args = ['--whatsapp', '--whatsapp', '--facebook'];
        const result = providerCli.parseArgs(args);
        
        // Should have both providers in the providers array
        expect(result.providers).toContain('whatsapp');
        expect(result.providers).toContain('facebook');
        
        // Should have both sessions in the sessions array (only one for WhatsApp since they're duplicates)
        expect(result.sessions).toHaveLength(2);
        
        // Check for default WhatsApp session
        expect(result.sessions).toContainEqual({
            provider: 'whatsapp',
            profile: 'default'
        });
        
        // Check for default Facebook session
        expect(result.sessions).toContainEqual({
            provider: 'facebook',
            profile: 'default'
        });
    });
});
