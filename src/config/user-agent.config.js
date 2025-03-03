// User Agent Configuration
// This file centralizes user agent configuration for the application

/**
 * User agent configuration
 */
module.exports = {
    // Default Chrome version to use - update monthly
    DEFAULT_CHROME_VERSION: '121.0.6167.184',
    
    // Default user agent string
    DEFAULT_USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.184 Safari/537.36',
    
    // Default client hint headers for Chrome
    DEFAULT_CLIENT_HINTS: {
        'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-ch-ua-platform-version': '"10.0.0"'
    }
};
