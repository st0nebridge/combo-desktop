# Application Instance Management Rules

## Instance Uniqueness
1. Each provider+profile combination (session) MUST be unique across all app instances
2. ONLY ONE instance of a specific session is allowed across all running app instances
3. Uniqueness rules MUST take precedence over ALL configuration overrides

## Process Isolation Priority
1. Process isolation MUST follow this priority order (highest to lowest):
   - Individual processes (safest, via `--new-instance`)
   - Profile isolation (default behavior)
   - Shared process (least safe, via `--one-instance`)
2. ALL process isolation rules MUST respect instance uniqueness requirements

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

## Profile Management
1. Multiple providers with same profile MUST run in same process
2. Multiple providers with different profiles MUST:
   - Run in separate processes by default
   - Run in existing profile process if that profile is already running
   - Run in current process if specified via `--one-instance`
   - Run in new process if specified via `--new-instance`
3. ALL profile combinations MUST respect session uniqueness rules

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

## Error Handling
1. Instance creation failures MUST be logged with appropriate severity
2. Duplicate session attempts MUST be rejected with clear error message
3. Invalid configuration MUST fail gracefully with helpful feedback
4. Uniqueness violations MUST be prevented, not just detected
