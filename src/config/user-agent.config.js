// User Agent Configuration
// This file centralizes user agent configuration for the application

/**
 * User agent configuration
 */
module.exports = {
    // Default Chrome version to use
    DEFAULT_CHROME_VERSION: '121.0.6167.184',
    
    // Default user agent string
    DEFAULT_USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.184 Safari/537.36',
    
    // Client hint headers for Chrome
    CLIENT_HINT_HEADERS: {
        'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-ch-ua-platform-version': '"10.0.0"'
    },
    
    /**
     * Get the user agent for a specific provider
     * @param {string} providerName The name of the provider
     * @returns {string} The user agent string
     */
    getUserAgentForProvider: function(providerName) {
        // Provider-specific user agents
        const providerUserAgents = {
            'WhatsApp': this.DEFAULT_USER_AGENT,
            'Facebook': this.DEFAULT_USER_AGENT
            // Add other providers as needed
        };
        
        return providerUserAgents[providerName] || this.DEFAULT_USER_AGENT;
    },
    
    /**
     * Get client hint headers for a specific provider
     * @param {string} providerName The name of the provider
     * @returns {Object} The client hint headers
     */
    getClientHintHeadersForProvider: function(providerName) {
        // Provider-specific client hint headers
        const providerClientHintHeaders = {
            'WhatsApp': this.CLIENT_HINT_HEADERS,
            // Add other providers as needed
        };
        
        return providerClientHintHeaders[providerName] || this.CLIENT_HINT_HEADERS;
    },
    
    // Helper function to get all headers including user agent and client hints
    getHeaders: function(providerName) {
        return {
            'User-Agent': this.getUserAgentForProvider(providerName),
            ...this.getClientHintHeadersForProvider(providerName)
        };
    }
};
