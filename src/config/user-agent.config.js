// User Agent Configuration
// This file centralizes user agent configuration for the application

/**
 * Extract major version from full Chrome version string
 * @param {string} version Full version string (e.g. '121.0.6167.184')
 * @returns {string} Major version number
 */
const extractMajorVersion = (version) => version.split('.')[0];

/**
 * Chrome version configuration - update monthly
 * Format: <major>.<minor>.<build>.<patch>
 */
const CHROME_VERSION = '121.0.6167.184';

// Extract major version for client hints
const CHROME_MAJOR_VERSION = extractMajorVersion(CHROME_VERSION);

/**
 * User agent configuration
 */
module.exports = {
    // Chrome version for reference
    CHROME_VERSION,

    // Default user agent string
    DEFAULT_USER_AGENT: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`,
    
    // Default client hint headers for Chrome
    DEFAULT_CLIENT_HINTS: {
        'sec-ch-ua': `"Not A(Brand";v="99", "Google Chrome";v="${CHROME_MAJOR_VERSION}", "Chromium";v="${CHROME_MAJOR_VERSION}"`,
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-ch-ua-platform-version': '"10.0.0"'
    }
};
