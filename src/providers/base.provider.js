class BaseProvider {
    constructor(window) {
        if (this.constructor === BaseProvider) {
            throw new Error('BaseProvider is abstract and cannot be instantiated directly');
        }
        this.window = window;
    }

    // Abstract methods that must be implemented by child classes
    initialize() {
        throw new Error('initialize() must be implemented by child class');
    }

    // Return the URL that this provider should load
    getUrl() {
        throw new Error('getUrl() must be implemented by child class');
    }

    // Return the name of this provider
    getName() {
        throw new Error('getName() must be implemented by child class');
    }

    // Return the command line argument that activates this provider
    getCommandArg() {
        throw new Error('getCommandArg() must be implemented by child class');
    }

    // Optional: Custom JS injection
    injectCustomJS() {
        // Default implementation does nothing
    }
}

module.exports = BaseProvider;
