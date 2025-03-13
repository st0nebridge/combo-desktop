# Combo Desktop Tests

This directory contains tests for the Combo Desktop application.

## Test Structure

The tests are organized into the following structure:

```
tests/
├── cli/                  # CLI-related tests
│   ├── modules/          # Tests for individual CLI modules
│   │   ├── help-cli.test.js
│   │   ├── instance-cli.test.js
│   │   ├── profile-cli.test.js
│   │   └── provider-cli.test.js
│   ├── cli-registry.test.js  # Tests for CLI registry
│   ├── cli-index.test.js     # Tests for CLI index module
│   ├── test-runner.js        # CLI test runner
│   └── test-utils.js         # Utilities for CLI tests
└── run-cli-tests.js      # Main entry point for running all CLI tests
```

## Running Tests

You can run the tests using the following npm scripts:

```bash
# Run all CLI tests
npm test

# Run specific CLI module tests
npm run test:help         # Test help CLI module
npm run test:registry     # Test CLI registry

# Run all tests
npm run test:all
```

## Test Utilities

The `test-utils.js` file provides common utilities for testing CLI commands:

- `executeCliCommand(args, options)`: Execute a CLI command and return the result
- `assertOutputContains(args, expectedOutput, options)`: Assert that a command's output contains expected text
- `assertExitCode(args, expectedExitCode, options)`: Assert that a command exits with expected code
- `mockService(modulePath, mockImplementation)`: Mock a service or dependency for testing

## Writing Tests

Each test file should export a `runTests()` function that returns a Promise resolving to a boolean indicating success or failure. For example:

```javascript
async function runTests() {
    console.log('Running tests...');
    
    try {
        // Test code here
        assert.ok(true, 'Test should pass');
        
        console.log('All tests passed!');
        return true;
    } catch (error) {
        console.error('Tests failed:', error);
        return false;
    }
}

module.exports = { runTests };
```

## Test Coverage

The tests cover the following functionality:

1. **CLI Module Tests**:
   - Command parsing and execution
   - Flag handling
   - Error handling
   - Module-specific functionality

2. **CLI Registry Tests**:
   - Module registration
   - Command execution
   - Command delegation
   - Error handling

3. **CLI Index Tests**:
   - Module auto-discovery
   - Module initialization
   - Command execution