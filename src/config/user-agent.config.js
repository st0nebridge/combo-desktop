// User Agent Configuration
// This file centralizes user agent configuration for the application

const { chromeVersion } = require('../../package.json');
const log = require('electron-log');

/**
 * Extract major version from full Chrome version string
 * @param {string} version Full version string (e.g. '121.0.6167.184')
 * @returns {string} Major version number
 */
const extractMajorVersion = (version) => {
    if (!version || typeof version !== 'string') {
        log.error('Invalid Chrome version:', version);
        return '120'; // Fallback version
    }
    return version.split('.')[0];
};

// Extract major version for client hints
const CHROME_MAJOR_VERSION = extractMajorVersion(chromeVersion);

// Base user agent components
const BASE_UA = {
    platform: 'Windows NT 10.0; Win64; x64',
    webkit: '537.36',
    chrome: chromeVersion
};

// Provider-specific user agents
const PROVIDER_USER_AGENTS = {
    WhatsApp: `Mozilla/5.0 (${BASE_UA.platform}) AppleWebKit/${BASE_UA.webkit} (KHTML, like Gecko) Chrome/${BASE_UA.chrome} Safari/${BASE_UA.webkit}`,
    Facebook: `Mozilla/5.0 (${BASE_UA.platform}) AppleWebKit/${BASE_UA.webkit} (KHTML, like Gecko) Chrome/${BASE_UA.chrome} Safari/${BASE_UA.webkit}`
};

/**
 * User agent configuration
 */
module.exports = {
    // Chrome version for reference
    CHROME_VERSION: chromeVersion,

    // Default user agent string
    DEFAULT_USER_AGENT: `Mozilla/5.0 (${BASE_UA.platform}) AppleWebKit/${BASE_UA.webkit} (KHTML, like Gecko) Chrome/${BASE_UA.chrome} Safari/${BASE_UA.webkit}`,
    
    // Default client hint headers for Chrome
    DEFAULT_CLIENT_HINTS: {
        'sec-ch-ua': `"Not A(Brand";v="99", "Google Chrome";v="${CHROME_MAJOR_VERSION}", "Chromium";v="${CHROME_MAJOR_VERSION}"`,
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-ch-ua-platform-version': '"10.0.0"'
    },

    /**
     * Get user agent string for provider
     * @param {string} providerName Provider name
     * @returns {string} User agent string
     */
    getUserAgent(providerName) {
        if (!providerName || typeof providerName !== 'string') {
            log.error('Invalid provider name:', providerName);
            return this.DEFAULT_USER_AGENT;
        }

        const ua = PROVIDER_USER_AGENTS[providerName];
        if (!ua) {
            log.warn(`No specific user agent for provider: ${providerName}, using default`);
            return this.DEFAULT_USER_AGENT;
        }

        return ua;
    }
};
