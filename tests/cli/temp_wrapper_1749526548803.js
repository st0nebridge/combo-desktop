
            // Set environment variables
            process.env.NODE_ENV = 'test';
            process.env.CLI_TEST_VERBOSE = 'true';
            
            // Load electron-mock first
            require('M:\\Dev\\Tools\\combo-desktop\\tests\\electron-mock');
            
            // Run the actual test
            const testModule = require('M:\\Dev\\Tools\\combo-desktop\\tests\\cli\\modules\\instance-cli.test.js');
            
            // Call the runTests function
            if (typeof testModule.runTests === 'function') {
                const result = testModule.runTests();
                
                // Handle promise result
                if (result instanceof Promise) {
                    result
                        .then(success => {
                            if (success) {
                                process.exit(0);
                            } else {
                                process.exit(1);
                            }
                        })
                        .catch(error => {
                            console.error('Test error:', error);
                            process.exit(1);
                        });
                } else {
                    // Handle synchronous result
                    process.exit(result ? 0 : 1);
                }
            } else {
                console.error('No runTests function found');
                process.exit(1);
            }
        