# CLI Rules and Framework

## Core Principles
1. **Responsibility Principle**: Each module is responsible for:
   - Defining its own commands and flags
   - Parsing its specific arguments (while leveraging base functionality)
   - Handling its own execution logic
   - Auto-registering itself with the registry

2. **Centralization Principle**: Common functionality must be implemented in BaseCLI:
   - Common flag parsing utilities
   - Registry integration
   - Validation utilities
   - Standard result object structure

3. **Abstraction Principle**: BaseCLI must remain abstract:
   - No specific configuration implementation
   - No hardcoded flags or commands
   - No implementation of business logic
   - Only abstract methods and utility functions
   - Child modules must implement all specific behavior

4. **Auto-Registration Principle**: Module registration is handled by index.js:
   - Automatically discovers and registers all CLI modules
   - Excludes BaseCLI from registration
   - No manual module registration in individual files
   - No direct instantiation outside of index.js

## Module Structure
1. BaseCLI Abstract Class:
   ```javascript
   class BaseCLI {
     constructor()                    // Prevents direct instantiation
     parseArgs()                     // Abstract: Must be implemented by child
     isCliCommand()                  // Abstract: Must be implemented by child
     execute(args)                   // Abstract: Must be implemented by child
     showUsage()                     // Abstract: Must be implemented by child
     validateFilePath(path)          // Utility: File validation
     getBaseResultObject()           // Utility: Standard result structure
     parseCommonFlags(result, index) // Utility: Common flag parsing
   }
   ```

2. Module Implementation Rules:
   - Use class-based structure extending BaseCLI
   - Must implement all abstract methods
   - Define module-specific flags in constructor
   - Document all methods with JSDoc comments

3. Command Function Binding:
   - Use .bind() pattern to map subcommands to their handler functions in constructor:
   ```javascript
   class ExampleCLI extends BaseCLI {
     constructor() {
       super();
       this.moduleFlags = ['--example'];
       
       // Bind command functions
       this.commands = {
         'list': this.listItems.bind(this),
         'create': this.createItem.bind(this),
         'delete': this.deleteItem.bind(this)
       };
     }
   }
   ```
   - Use command map in parseArgs() and execute() for cleaner code:
   ```javascript
   // In parseArgs()
   if (this.commands[subcommand]) {
     result.command = subcommand;
     // Parse additional args if needed
   }

   // In execute()
   if (args.command && this.commands[args.command]) {
     this.commands[args.command](...commandArgs);
   }
   ```

4. Module Organization:
   - Place modules in `src/cli/modules/`
   - Name files with `-cli.js` suffix (e.g. `profile-cli.js`)
   - Export class definition (not instance)
   - No direct instantiation in module files

5. Flag Parsing Rules:
   - Use `this.getBaseResultObject()` to get standardized result structure
   - Use `this.parseCommonFlags(result, index)` for common flags
   - Return `null` from `parseArgs()` if no relevant flags for this module
   - Validate all required arguments
   - Use `this.validateFilePath()` for file path validation

## Module Registration
1. Registration Process:
   ```javascript
   // src/cli/index.js
   const fs = require('fs');
   const path = require('path');
   
   // Automatically register all CLI modules
   const modulesDir = path.join(__dirname, 'modules');
   const modules = fs.readdirSync(modulesDir)
     .filter(file => file.endsWith('-cli.js') && file !== 'base-cli.js')
     .map(file => {
       const ModuleClass = require(path.join(modulesDir, file));
       return new ModuleClass();
     });
   
   module.exports = modules;
   ```

2. Registration Rules:
   - index.js must discover and load all CLI modules automatically
   - Only load files ending in `-cli.js`
   - Exclude `base-cli.js` from registration
   - Create instances of all discovered modules
   - Export array of module instances

## Standard Flags
1. Application Control:
   - `--tray`: Start application minimized to tray
   - `--new-instance`: Force new instance creation
   - `--one-instance`: Allow only one instance to run
   - `--reset-lock`: Reset instance locks
   - `--config <path>`: Specify config file path

2. Help and Information:
   - `--help`: Show help information
   - `--manual [topic]`: Show detailed help (topics: providers, profiles, flags)
   - `--version`: Show version information

3. Provider Control:
   - `--whatsapp [profile]`: Start WhatsApp provider
   - `--facebook [profile]`: Start Facebook provider

4. Instance Management:
   - `--instances list`: List all running instances
   - `--instances status`: Show detailed instance status
   - `--instances kill [id]`: Kill specific instance or all instances

5. Profile Management:
   - `--profiles list`: List all available profiles
   - `--profiles create --provider <n> --name <n> [--options <json>]`: Create profile
   - `--profiles delete --provider <n> --name <n>`: Delete profile
   - `--profiles delete-all`: Delete all profiles

## Command Format
1. Package Manager Commands:
   - Use ONLY kebab-case for script names:
      - `yarn whatsapp`
      - `yarn reset-lock`

2. Direct Commands:
   - All flags MUST start with `--`
   - Use kebab-case for flag names
   - `electron . --new-instance`

3. Subcommands:
   - Use space separator for subcommands in CLI
   - Each module should define a single entry point flag (e.g. --profiles)
   - Map subcommands to handler functions using .bind() pattern
   - Example format:
     ```
     --module-name subcommand [--flag value]
     --profiles create --name test --provider whatsapp
     --instances kill --id 123
     ```

## Module Development Guide
1. Creating New Modules:
   ```javascript
   // src/cli/modules/example-cli.js
   const BaseCLI = require('./base-cli');
   const log = require('electron-log');
   
   /**
    * Example CLI Module
    * Handles example-specific commands
    */
   class ExampleCLI extends BaseCLI {
     constructor() {
       super();
       this.moduleFlags = ['--example'];
       
       // Bind command functions
       this.commands = {
         'list': this.listItems.bind(this),
         'create': this.createItem.bind(this),
         'delete': this.deleteItem.bind(this)
       };
     }
     
     /**
      * Parse example-specific arguments
      * @returns {Object|null} Parsed arguments or null if not applicable
      */
     parseArgs() {
       const result = this.getBaseResultObject();
       result.exampleSpecific = null;
       
       let i = 0;
       while (i < this.args.length) {
         const arg = this.args[i];
         
         if (arg === '--example') {
           // Handle example-specific parsing
           result.exampleSpecific = true;
           i++;
           continue;
         }
         
         // Use common flag parsing for other flags
         i = this.parseCommonFlags(result, i);
       }
       
       return result.exampleSpecific ? result : null;
     }
     
     /**
      * Check if this is a CLI command that shouldn't register a PID
      * @returns {boolean} True if this is a CLI command
      */
     isCliCommand() {
       const args = this.parseArgs();
       return args !== null;
     }
     
     /**
      * Execute example-specific logic
      * @param {Object} args - Parsed arguments
      */
     execute(args) {
       if (!args) {
         return;
       }
       
       // Validate config file if specified
       if (args.config) {
         this.validateFilePath(args.config);
       }
       
       // Example-specific execution logic
       log.info('Executing example command');
       console.log('Example command executed');
     }
   }
   
   // Export class definition (not instance)
   module.exports = ExampleCLI;
   ```

2. Module Registration:
   - Create module in `src/cli/modules/`
   - Export class definition
   - Import and instantiate in `src/cli/index.js`

## Error Handling
1. Validation:
   - Validate all flag values
   - Check for missing required values
   - Verify file paths exist for --config
   - Use BaseCLI validation methods

2. Error Messages:
   - Use electron-log for error logging
   - Provide helpful error messages
   - Include command usage on error
   - Follow standard error format

## Registry Responsibilities
1. The CLIRegistry is responsible for:
   - Maintaining a registry of CLI modules
   - Executing modules based on command line arguments
   - Checking if commands should prevent PID registration
   - Showing help when no module handles the arguments

2. Registry Implementation:
   - Store module classes, not instances
   - Create instances as needed for execution
   - Track if any module handled the arguments
   - Show help if no module handled the arguments
