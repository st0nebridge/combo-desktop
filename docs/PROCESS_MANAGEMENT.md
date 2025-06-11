# Process Management Guide

## Overview

Combo Desktop now features a sophisticated process management system that provides flexible instance handling, intelligent delegation, and robust session management. This guide covers all aspects of the new system.

## Key Features

### 1. **Multi-Instance Architecture**
- **Default Behavior**: One process per profile (e.g., WhatsApp gets its own process)
- **Flexible Configuration**: Support for multiple profiles in one process or multiple processes per profile
- **Intelligent Delegation**: Automatically routes requests to existing processes when appropriate

### 2. **Process Discovery & Delegation**
- **Inter-Process Communication (IPC)**: Processes can discover and communicate with each other
- **Profile-Based Routing**: New instances delegate to existing processes with matching profiles
- **Priority Scoring**: Advanced algorithm to select the best target process for delegation

### 3. **Session Management**
- **Consistent Session Naming**: Unified session key format across all components
- **Event-Driven Architecture**: Proper cleanup and exit handling via EventEmitter pattern
- **Graceful Shutdown**: Intelligent process termination when all sessions are closed

## Process Management Modes

### Default Mode (Profile Isolation)
```bash
# Each profile gets its own process
combo-desktop --whatsapp          # Process 1
combo-desktop --telegram          # Process 2
combo-desktop --whatsapp          # Delegates to Process 1
```

### Force New Instance Mode
```bash
# Always create a new process
combo-desktop --whatsapp --new-instance    # Process 1
combo-desktop --whatsapp --new-instance    # Process 2 (separate)
```

### One Instance Mode
```bash
# All profiles share one process
combo-desktop --whatsapp --one-instance    # Process 1
combo-desktop --telegram --one-instance    # Delegates to Process 1
combo-desktop --discord --one-instance     # Delegates to Process 1
```

## Technical Implementation

### Instance Manager Architecture

The `InstanceManager` class serves as the central coordinator for all process management:

```javascript
class InstanceManager extends EventEmitter {
    // Core Methods
    async getInstances()                    // Discover running instances
    async getInstanceByProfile(profile)     // Find instance for specific profile
    async delegateCommand(command)          // Route command to appropriate instance
    async handleProfileSessionDelegation(profile) // Handle profile-based delegation
    
    // Session Management
    registerSession(name, profile)         // Register new session
    async unregisterSession(name, profile) // Unregister session and cleanup
    
    // Process Communication
    async setupIpcServer()                 // Setup inter-process communication
    async delegateCommandToInstance(instance, command) // Send command to specific instance
}
```

### Delegation Algorithm

The system uses a sophisticated priority scoring algorithm to select the best target process:

1. **Profile Match Score**: Higher priority for exact profile matches
2. **Session Count Score**: Prefer instances with fewer sessions
3. **Instance Age Score**: Slight preference for older, established instances
4. **Availability Score**: Only route to responsive instances

### Lock File Management

Each process maintains a lock file with metadata:

```json
{
  "pid": 12345,
  "profile": "whatsapp",
  "sessionCount": 2,
  "createdAt": 1672531200000,
  "ipcPort": 8080,
  "sessions": [
    {"name": "whatsapp", "profile": "default"},
    {"name": "whatsapp", "profile": "work"}
  ]
}
```

## Session Lifecycle

### Session Registration
1. Provider calls `instanceManager.registerSession(name, profile)`
2. Session key is generated: `"${name}:${profile}"`
3. Session is tracked in the instance's session map
4. Lock file is updated with current session count

### Session Unregistration  
1. Provider calls `instanceManager.unregisterSession(name, profile)`
2. Session is removed from the session map
3. Window and tray resources are cleaned up
4. If last session: `'last-session-closed'` event is emitted
5. App manager responds to event and initiates graceful shutdown

### Exit Handling
```javascript
// In providers/abstract/base.provider.js
getQuitMenuItem() {
    return {
        label: 'Quit',
        click: async () => {
            const instanceManager = require('../../services/instance.manager');
            await instanceManager.unregisterSession(
                this.getSessionName(), 
                this.profile
            );
        }
    };
}
```

## IPC Communication Protocol

### Discovery Request
```javascript
{
    type: 'discovery',
    requestId: 'unique-id',
    timestamp: Date.now()
}
```

### Discovery Response
```javascript
{
    type: 'discovery_response',
    requestId: 'unique-id',
    pid: process.pid,
    profile: 'whatsapp',
    sessionCount: 2,
    createdAt: 1672531200000
}
```

### Delegation Request
```javascript
{
    type: 'delegate',
    command: '--whatsapp --profile=work',
    requestId: 'unique-id',
    timestamp: Date.now()
}
```

### Delegation Response
```javascript
{
    type: 'delegate_response',
    requestId: 'unique-id',
    success: true,
    sessionId: 'whatsapp:work'
}
```

## Error Handling & Recovery

### Lock File Recovery
- Automatic detection of stale lock files
- Process validation before delegation
- Graceful fallback to new instance creation

### IPC Failure Handling
- Timeout-based request handling
- Retry logic with exponential backoff
- Fallback to independent operation

### Session Recovery
- Orphaned session detection
- Automatic cleanup on startup
- Integrity validation

## Configuration Options

### Environment Variables
```bash
COMBO_INSTANCE_MODE=default|one|force-new     # Default instance behavior
COMBO_IPC_TIMEOUT=5000                        # IPC timeout in milliseconds
COMBO_DELEGATION_RETRIES=3                    # Number of delegation retry attempts
COMBO_LOCK_FILE_DIR=/custom/path              # Custom lock file directory
```

### Command Line Arguments
```bash
--new-instance          # Force creation of new process
--one-instance          # Use single process for all profiles
--no-delegation         # Disable delegation entirely
--ipc-port=8080         # Custom IPC port
```

## Troubleshooting

### Common Issues

#### Multiple Processes Not Delegating
- Check if lock files exist in temp directory
- Verify IPC communication is working
- Look for firewall blocking local ports

#### Process Not Exiting
- Verify all sessions are properly unregistered
- Check for event listener leaks
- Ensure tray cleanup is working

#### Session Key Mismatches
- Verify `getSessionName()` returns consistent format
- Check for capitalization differences
- Ensure profile names match registration

### Debug Commands
```bash
# Check running instances
combo-desktop --list-instances

# Validate session state
combo-desktop --debug-sessions

# Test IPC communication
combo-desktop --test-ipc
```

## Performance Considerations

### Memory Usage
- Each process maintains its own V8 heap
- Shared resources through IPC minimize duplication
- Lock files are small JSON objects

### CPU Usage
- IPC communication is lightweight
- Delegation adds minimal overhead
- Background discovery is throttled

### Network Usage
- Local IPC only (no external network)
- Minimal data transfer between processes
- Efficient binary protocol for large payloads

## Migration Guide

### From Single Instance
If upgrading from a single-instance setup:

1. **No Code Changes Required**: Existing providers work automatically
2. **Profile Isolation**: Each provider now gets its own process by default
3. **Graceful Fallback**: System falls back to single instance if delegation fails

### Custom Providers
For custom provider implementations:

1. **Use `getSessionName()`**: Replace hardcoded session names
2. **Proper Cleanup**: Ensure `unregisterSession()` is called
3. **Event Handling**: Listen for session lifecycle events

## Best Practices

### Provider Development
- Always use `this.getSessionName()` for consistent naming
- Call `unregisterSession()` in cleanup handlers
- Handle delegation gracefully (transparent to users)

### Testing
- Test all three instance modes (default, force-new, one-instance)
- Verify proper cleanup in exit scenarios
- Test delegation under various conditions

### Deployment
- Ensure temp directory is writable
- Configure appropriate IPC timeouts
- Monitor lock file directory for cleanup

## Future Enhancements

### Planned Features
- **Process Pool Management**: Warm process pools for faster startup
- **Load Balancing**: Distribute sessions across multiple processes
- **Health Monitoring**: Automatic recovery of unhealthy processes
- **Remote Delegation**: Support for delegation across machines

### Extension Points
- **Custom Delegation Logic**: Plugin system for delegation algorithms
- **Process Lifecycle Hooks**: Custom handlers for process events
- **Monitoring Integration**: Metrics and logging extensions
