# CLI Rules

## Module Structure
1. All CLI modules MUST follow the provider-cli.js pattern:
   - Use class-based structure
   - Parse arguments in constructor
   - Implement `parseArgs()` method for module-specific argument parsing
   - Implement `isCliFlag()` method to identify module-specific flags
   - Implement `isCliCommand()` method to identify non-PID commands
   - Document all methods with JSDoc comments

2. Flag Parsing Rules:
   - Parse arguments using `process.argv.slice(2)`
   - Handle paired arguments (e.g., `--profile work`) in sequence
   - Skip non-module flags using `isCliFlag()`
   - Support chaining of multiple flags

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
   - Use colon separator for subcommands in package.json scripts
   - `instances:list`
   - `instances:status`
   - `instances-list`
   - `instances.list`

## Help System
1. Help Topics:
   - General help: `--help` or `--manual`
   - Provider help: `--manual providers`
   - Profile help: `--manual profiles`
   - Flag help: `--manual flags`

2. Help Output:
   - Show package manager commands when in yarn/npm mode
   - Always show CLI flags
   - List available providers
   - Include usage examples
   - Document all flags and their purpose

## Error Handling
1. Validation:
   - Validate all flag values
   - Check for missing required values
   - Verify file paths exist for --config

2. Error Messages:
   - Use electron-log for error logging
   - Provide helpful error messages
   - Include command usage on error
