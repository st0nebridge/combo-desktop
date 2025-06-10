# App Instance Rules

## Instance Uniqueness
1. Each instance MUST have a unique ID (timestamp-based)
2. Each instance MUST register its sessions in the lock file
3. Each provider+profile combination MUST be unique across all instances
4. Each provider+profile combination MUST be registered as a session
5. Each instance MUST respect the process isolation rules

## Process Isolation Priority
1. Process isolation MUST follow this priority order (highest to lowest):
   - Individual processes (safest, via `--new-instance`)
   - Profile isolation (default behavior)
   - Shared process (least safe, via `--one-instance`)
2. ALL process isolation rules MUST respect instance uniqueness requirements

## Process Management
1. Each instance MUST register its PID in `pids.json` in appdata:
   - Add PID after successful instance initialization
   - Remove PID on successful instance exit
   - Handle process cleanup on abnormal termination
2. `pids.json` MUST use OS-level file system locking:
   - Use same locking mechanism as instance lock files
   - Prevent concurrent access to PID file
   - Handle stale locks appropriately
   - Clean up invalid PIDs during read operations
3. Process termination MUST:
   - Clean up all child processes
   - Remove PID from registry
   - Release all held locks
   - Clean up temporary files

## Instance Creation and Grouping
1. Provider instances MUST group to the same app instance by default when using same profile
2. Different profiles MUST be isolated to different processes by default
3. New app instance MUST be created if:
   - No existing app instances use the specified profile
   - EXCEPT when current instance is first and has no providers
4. `--new-instance` CLI parameter MUST:
   - Force creation of new app instance
   - Use current process if no providers are running yet
   - Still enforce session uniqueness across instances

## CLI Behavior
1. CLI commands MUST:
   - Act as remote control when target instance exists
   - Exit after delegating to target instance
   - Create new instance only when required by rules
2. Provider CLI arguments MUST:
   - Support multiple providers in a single command
   - Accept profile name parameter (default to 'default' if not specified)
   - Allow provider+profile combinations (e.g. --whatsapp --facebook --whatsapp "work")
   - Follow profile isolation rules unless overridden
   - Enforce session uniqueness regardless of arguments

## Instance CLI
1. Instance CLI MUST support:
   - Listing running instances with their PIDs
   - Killing instances by ID, PID, or profile name
   - Showing instance status and health
   - Managing instance locks
2. Instance CLI MUST verify process exists before operations
3. Instance CLI MUST handle errors gracefully:
   - Invalid PIDs
   - Missing processes
   - Corrupted lock files
   - Permission issues

## Configuration Override
1. `--one-instance` CLI parameter MUST:
   - Override default profile isolation
   - Force all providers to run in current process
   - Still enforce session uniqueness rules
2. `--new-instance` CLI parameter MUST:
   - Override all other instance management rules
   - Create new process unless no providers running
   - Still enforce session uniqueness rules
3. `--profile` CLI parameter MUST:
   - Define target profile for current process
   - Allow providers to run in current process if profile matches
   - Still enforce session uniqueness rules

## Configuration
1. ALL configuration MUST be configurable via JSON file, including:
   - Provider and profile settings
   - Tray minimization status
   - Chrome version override (blank by default to use app setting)
2. JSON config file path MUST be accepted via CLI parameter
3. Configuration options MUST NOT override session uniqueness rules

## Reset Lock
1. `reset-lock` command MUST execute in order:
   - Kill all processes listed in `pids.json`
   - Remove `pids.json` file after processes are terminated
   - Remove instance lock file
   - Initialize fresh instance lock file
2. `reset-lock` MUST handle error cases:
   - Missing PID file
   - Invalid PIDs
   - Corrupted lock files
   - Permission issues
   - Zombie processes

## Instance Delegation
1. Second instances MUST delegate to first instance when:
   - First instance has capacity (based on profile rules)
   - Provider+profile combination doesn't exist yet
2. Delegation rules:
   - Use current process if no providers are running yet
   - Still enforce session uniqueness across instances

## Profile Management
1. Multiple providers with same profile MUST run in same process
2. Multiple providers with different profiles MUST:
   - Run in separate processes
   - Have separate window management
   - Have separate tray icons

## Lock File Management
1. Lock files MUST be atomic:
   - Use proper file system locks
   - Handle concurrent access
   - Prevent race conditions
2. Lock files MUST be resilient:
   - Handle corruption gracefully
   - Maintain backup copies
   - Support recovery operations

## Inter-Process Communication
1. ALL inter-process communication MUST use Windows named pipes:
   - Each instance MUST create a unique pipe using format: `\\?\pipe\{package.name}-{pid}`
   - Package name MUST be read from package.json at runtime
   - Pipe names MUST be derived from process PID
   - Pipe server MUST be initialized during instance construction
   - Pipe server MUST be cleaned up during instance shutdown

2. Command delegation MUST:
   - Use JSON messages with type, requestId, and payload
   - Include proper error handling and timeouts
   - Clean up connections after use
   - Log all communication attempts

3. Named pipe messages MUST include:
   - `type`: Message type (e.g., 'delegate-command', 'delegate-response')
   - `requestId`: Unique ID for tracking requests
   - `targetPid`: Target process PID
   - `args`: Command arguments (for commands)
   - `success`: Boolean success status (for responses)
   - `error`: Error message if applicable (for responses)

4. Pipe communication MUST handle:
   - Connection timeouts (30 seconds max)
   - Connection errors
   - Invalid JSON data
   - Missing or dead target processes
   - Cleanup of resources

5. Error handling MUST:
   - Log all communication errors
   - Clean up connections on error
   - Provide meaningful error messages
   - Fall back to local execution when delegation fails

## Error Handling
1. All operations MUST be atomic:
   - Roll back on failure
   - Clean up resources
   - Log failures appropriately
2. Duplicate session attempts MUST be rejected with clear error message
3. Invalid configuration MUST fail gracefully with helpful feedback
4. Uniqueness violations MUST be prevented, not just detected
