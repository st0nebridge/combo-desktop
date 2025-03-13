/**
 * @file CLI Test Utilities
 * @description Utility functions for CLI module testing
 */

const path = require('path');
const { execSync } = require('child_process');
const { spawn } = require('child_process');

/**
 * Mock a service by replacing it in the require cache
 * @param {string} servicePath - Path to the service module
 * @param {Object} mockImplementation - Mock implementation
 * @returns {Function} Function to restore the original service
 */
function mockService(servicePath, mockImplementation) {
    // Resolve the full path if it's a relative path
    let fullPath;
    try {
        fullPath = servicePath.startsWith('.') 
            ? path.resolve(__dirname, servicePath) 
            : require.resolve(servicePath);
    } catch (error) {
        console.log(`Warning: Could not resolve module path for ${servicePath}. Using direct path.`);
        fullPath = servicePath;
    }
    
    // Store the original module
    const originalModule = require.cache[fullPath];
    
    // Create a new module with the mock implementation
    const mockModule = {
        id: fullPath,
        filename: fullPath,
        loaded: true,
        exports: mockImplementation || {}
    };
    
    // Replace the module in the require cache
    require.cache[fullPath] = mockModule;
    
    // Return a function to restore the original module
    return function restoreOriginal() {
        if (originalModule) {
            require.cache[fullPath] = originalModule;
        } else {
            delete require.cache[fullPath];
        }
    };
}

/**
 * Execute a CLI command and return the output
 * @param {Array<string>} args - Command line arguments
 * @param {Object} options - Execution options
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>} Command output
 */
async function executeCliCommand(args, options = {}) {
    const cwd = options.cwd || process.cwd();
    const timeout = options.timeout || 5000;
    const env = { ...process.env, NODE_ENV: 'test', ...options.env };
    
    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        
        // Use node to run the CLI entry point
        const nodeExecutable = process.execPath;
        const cliEntryPoint = path.resolve(cwd, 'src/cli/index.js');
        
        const child = spawn(nodeExecutable, [cliEntryPoint, ...args], {
            cwd,
            env,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        
        // Set timeout
        const timeoutId = setTimeout(() => {
            child.kill();
            reject(new Error(`Command timed out after ${timeout}ms: ${args.join(' ')}`));
        }, timeout);
        
        // Collect stdout
        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        // Collect stderr
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        // Handle process exit
        child.on('close', (exitCode) => {
            clearTimeout(timeoutId);
            resolve({ stdout, stderr, exitCode });
        });
        
        // Handle process error
        child.on('error', (error) => {
            clearTimeout(timeoutId);
            reject(error);
        });
    });
}

/**
 * Assert that command output contains expected text
 * @param {Array<string>} args - Command line arguments
 * @param {string} expectedText - Text to look for in output
 * @param {Object} options - Execution options
 * @returns {Promise<boolean>} True if assertion passes
 */
async function assertOutputContains(args, expectedText, options = {}) {
    try {
        const { stdout, stderr } = await executeCliCommand(args, options);
        const output = stdout + stderr;
        
        if (!output.includes(expectedText)) {
            console.error(`Expected output to contain: "${expectedText}"`);
            console.error(`Actual output: "${output}"`);
            throw new Error(`Output does not contain expected text: ${expectedText}`);
        }
        
        return true;
    } catch (error) {
        console.error(`Assertion failed: ${error.message}`);
        throw error;
    }
}

/**
 * Assert that command exits with expected code
 * @param {Array<string>} args - Command line arguments
 * @param {number} expectedExitCode - Expected exit code
 * @param {Object} options - Execution options
 * @returns {Promise<boolean>} True if assertion passes
 */
async function assertExitCode(args, expectedExitCode, options = {}) {
    try {
        const { exitCode } = await executeCliCommand(args, options);
        
        if (exitCode !== expectedExitCode) {
            throw new Error(`Expected exit code ${expectedExitCode}, got ${exitCode}`);
        }
        
        return true;
    } catch (error) {
        console.error(`Assertion failed: ${error.message}`);
        throw error;
    }
}

module.exports = {
    mockService,
    executeCliCommand,
    assertOutputContains,
    assertExitCode
};