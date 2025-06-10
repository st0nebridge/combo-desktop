# Task Output: Identify Issues and Recommendations

Task ID: task-004
Started: 2025-04-30T20:21:30+01:00
Completed: 2025-04-30T20:23:00+01:00

## Consolidated Issues and Recommendations

Based on the code analysis and investigation of instance management issues, here are the key problems and recommended solutions.

### Critical Issues

#### 1. Missing delegateSessions Implementation

**Issue:** The commented-out code in `main.js` references a non-existent `instanceManager.delegateSessions()` method, preventing session delegation to existing instances.

**Recommendation:**
- Implement the missing `delegateSessions` method in `instance.manager.js`:
```javascript
/**
 * Delegate sessions to existing instances
 * @method delegateSessions
 * @param {Array<Object>} sessions - Sessions to delegate
 * @param {boolean} profileIsolation - Whether to respect profile isolation
 * @returns {Promise<boolean>} True if delegation was successful
 */
async delegateSessions(sessions, profileIsolation) {
  try {
    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
      log.error('Invalid or empty sessions array for delegation');
      return false;
    }

    log.info('Delegating sessions to existing instances:', sessions);
    
    // Group sessions by profile for delegation
    const sessionsByProfile = new Map();
    for (const session of sessions) {
      const profile = session.profile || 'default';
      if (!sessionsByProfile.has(profile)) {
        sessionsByProfile.set(profile, []);
      }
      sessionsByProfile.get(profile).push(session);
    }
    
    let allSuccessful = true;
    
    // Process each profile group
    for (const [profile, profileSessions] of sessionsByProfile) {
      // Find a suitable target instance
      const instances = await this.getInstances();
      let targetInstance = null;
      
      if (profileIsolation) {
        // Find instance with matching profile
        targetInstance = instances.find(instance => {
          try {
            process.kill(instance.pid, 0);
            return instance.profile === profile;
          } catch (error) {
            return false;
          }
        });
      } else {
        // Find any active instance
        targetInstance = instances.find(instance => {
          try {
            process.kill(instance.pid, 0);
            return true;
          } catch (error) {
            return false;
          }
        });
      }
      
      if (targetInstance) {
        const success = await this.delegateToInstance(targetInstance, profileSessions);
        if (!success) {
          log.error(`Failed to delegate sessions for profile ${profile}`);
          allSuccessful = false;
        }
      } else {
        log.warn(`No suitable instance found for profile ${profile}, can't delegate`);
        allSuccessful = false;
      }
    }
    
    return allSuccessful;
  } catch (error) {
    log.error('Error delegating sessions:', error);
    return false;
  }
}
```

- Uncomment the delegation code in `main.js` once the method is implemented.

#### 2. Race Conditions in Lock Management

**Issue:** Lock acquisition and release operations have race conditions that can lead to lock file corruption and instance conflicts.

**Recommendations:**
- Implement robust retry logic with proper timeouts for lock operations
- Add explicit cleanup of resources in error cases
- Use atomic file operations where possible by writing to temporary files and using rename
- Add lock owner tracking to detect and resolve lock ownership conflicts

```javascript
// Enhanced lock acquisition with better error handling
async acquireLock() {
  try {
    if (this.lockRelease) {
      log.warn('Lock already held, releasing first');
      await this.releaseLock();
    }

    const lockfile = require('proper-lockfile');
    const lockPath = this.getLockFilePath();

    // Ensure lock file exists with atomic check and create
    const fs = require('fs').promises;
    try {
      await fs.access(lockPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        const tempFile = `${lockPath}.tmp.${Date.now()}`;
        await fs.writeFile(tempFile, JSON.stringify({ instances: {} }), 'utf8');
        try {
          await fs.rename(tempFile, lockPath);
        } catch (renameError) {
          // Handle edge case where another process created the file meanwhile
          try { await fs.unlink(tempFile); } catch (e) {}
        }
      }
    }

    // Acquire lock with proper retry and stale detection
    this.lockRelease = await lockfile.lock(lockPath, {
      stale: 10000, // 10 seconds stale threshold
      retries: {
        retries: 10,
        factor: 1.5,
        minTimeout: 500,
        maxTimeout: 3000,
        randomize: true
      },
      // Add our PID for ownership tracking
      onCompromised: (err) => {
        log.error('Lock was compromised:', err);
        this.lockRelease = null;
      }
    });

    // Mark the lock with owner information
    await this.markLockOwner();
    log.info('Lock acquired successfully');
  } catch (error) {
    this.lockRelease = null;
    log.error('Error acquiring lock:', error);
    throw error;
  }
}
```

### High Priority Issues

#### 3. Error Recovery and State Consistency

**Issue:** Error handling paths may leave the system in an inconsistent state, especially during multi-step operations.

**Recommendations:**
- Implement a transaction-like approach for multi-step operations
- Create a dedicated state cleanup service to periodically detect and fix inconsistencies
- Add automated recovery procedures for common error scenarios
- Enhance error logging with context information for easier troubleshooting

```javascript
// Example of transaction-like approach for multi-step operations
async safeOperation(operationFn) {
  // Capture state before operation
  const initialState = await this.captureState();
  let success = false;
  
  try {
    // Perform the operation
    await operationFn();
    success = true;
    return true;
  } catch (error) {
    log.error('Operation failed:', error);
    success = false;
    return false;
  } finally {
    if (!success) {
      // Restore state if operation failed
      try {
        await this.restoreState(initialState);
        log.info('State restored after failed operation');
      } catch (restoreError) {
        log.error('Failed to restore state:', restoreError);
      }
    }
  }
}
```

#### 4. Profile Isolation Logic Issues

**Issue:** The profile isolation logic has flaws that could allow multiple instances with the same profile.

**Recommendations:**
- Strengthen profile isolation checks with double-verification
- Implement a centralized profile registry for tracking active profiles
- Add profile lock files separate from the main instance lock
- Implement periodic validation to ensure profile uniqueness is maintained

```javascript
// Enhanced profile isolation check
async validateProfileIsolation(profile) {
  if (!profile) {
    throw new Error('Profile is required for validation');
  }
  
  // First check: Check lock file
  const instances = await this.getInstances();
  const runningInstances = instances.filter(instance => {
    try {
      process.kill(instance.pid, 0);
      return instance.profile === profile;
    } catch (error) {
      return false;
    }
  });
  
  if (runningInstances.length > 0) {
    log.error(`Profile ${profile} already in use by instance ${runningInstances[0].id}`);
    return false;
  }
  
  // Second check: Try to acquire profile-specific lock
  const profileLockPath = path.join(app.getPath('userData'), `profile-${profile}.lock`);
  let profileLockRelease = null;
  
  try {
    profileLockRelease = await lockfile.lock(profileLockPath, { stale: 10000 });
    await profileLockRelease();
    return true;
  } catch (error) {
    log.error(`Profile ${profile} appears to be in use (lock acquisition failed):`, error);
    return false;
  }
}
```

### Medium Priority Issues

#### 5. PID File Management

**Issue:** PID file management lacks atomic operations, which can cause corrupted state.

**Recommendations:**
- Implement atomic file operations for PID file updates
- Add checksums or version tracking to detect corrupted PID files
- Include instance IDs alongside PIDs for better tracking
- Implement periodic PID file verification and cleanup

```javascript
// Atomic PID file update
async writePids(pids) {
  try {
    if (!Array.isArray(pids)) {
      throw new Error('Invalid PID array');
    }

    const fs = require('fs').promises;
    const pidFilePath = this.getPidFilePath();
    const tempFile = `${pidFilePath}.tmp.${Date.now()}`;
    
    // Write to temp file
    await fs.writeFile(tempFile, JSON.stringify({
      pids,
      updatedAt: new Date().toISOString(),
      checksum: this.generateChecksum(pids)
    }), 'utf8');
    
    // Atomically replace old file
    await fs.rename(tempFile, pidFilePath);
    
    log.info(`PID file updated with ${pids.length} PIDs`);
    return true;
  } catch (error) {
    log.error('Error writing PIDs file:', error);
    throw error;
  }
}
```

#### 6. IPC Communication Limitations

**Issue:** IPC communication between instances has limited error handling and can lead to lost messages.

**Recommendations:**
- Implement a more robust IPC mechanism with message acknowledgments
- Add timeout handling and automatic retries for IPC operations
- Implement a message queue for reliable delivery between instances
- Add heartbeats to detect dead connections

```javascript
// Enhanced IPC message sending with retries and timeout
async sendIpcMessage(targetId, message, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const timeout = options.timeout || 5000;
  const retryDelay = options.retryDelay || 1000;
  
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    
    try {
      const result = await this.sendIpcMessageWithTimeout(targetId, message, timeout);
      return result;
    } catch (error) {
      if (error.code === 'TIMEOUT') {
        log.warn(`IPC message to ${targetId} timed out (attempt ${attempt}/${maxRetries})`);
      } else if (error.code === 'CONNECTION_ERROR') {
        log.error(`IPC connection to ${targetId} failed (attempt ${attempt}/${maxRetries}):`, error);
      } else {
        throw error; // Re-throw unexpected errors
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  throw new Error(`Failed to send IPC message to ${targetId} after ${maxRetries} attempts`);
}
```

#### 7. Stale Instance Detection

**Issue:** The mechanism for detecting stale instances is inadequate, leading to orphaned entries in lock files.

**Recommendations:**
- Implement periodic liveness checks for all registered instances
- Add a heartbeat mechanism to detect crashed instances more reliably
- Create a cleanup service to automatically remove stale instances
- Store last activity timestamp for each instance to detect inactivity

```javascript
// Periodic instance liveness verification
startLivenessMonitor(intervalMs = 60000) {
  this.livenessInterval = setInterval(async () => {
    try {
      // Update our own heartbeat first
      await this.updateInstanceHeartbeat();
      
      // Check other instances and clean up stale ones
      const lockData = await this.readLockFile();
      if (!lockData.instances) return;
      
      const now = Date.now();
      const staleThreshold = 120000; // 2 minutes
      let staleInstances = 0;
      
      for (const [id, instance] of Object.entries(lockData.instances)) {
        // Skip our own instance
        if (id === this.instanceId) continue;
        
        const lastHeartbeat = instance.lastHeartbeat ? new Date(instance.lastHeartbeat).getTime() : 0;
        const elapsed = now - lastHeartbeat;
        
        if (elapsed > staleThreshold) {
          // Try to verify process is really gone
          let isStale = true;
          try {
            process.kill(instance.pid, 0);
            isStale = false; // Process exists but didn't update heartbeat
          } catch (error) {
            // Process doesn't exist, confirm it's stale
            isStale = true;
          }
          
          if (isStale) {
            log.info(`Cleaning up stale instance: ${id} (pid: ${instance.pid})`);
            await this.cleanupStaleInstance(id);
            staleInstances++;
          }
        }
      }
      
      if (staleInstances > 0) {
        log.info(`Cleaned up ${staleInstances} stale instances`);
      }
    } catch (error) {
      log.error('Error in liveness monitor:', error);
    }
  }, intervalMs);
}
```

### General Architecture Recommendations

1. **Refactor State Management:**
   - Implement a centralized state store with atomic transactions
   - Reduce reliance on file-based state sharing
   - Use event-based communication for state updates

2. **Improve Error Handling:**
   - Add structured error types with error codes
   - Implement consistent error logging format with contextual information
   - Create dedicated error recovery mechanisms

3. **Enhance Testing:**
   - Add unit tests for core instance management functionality
   - Create integration tests for multi-instance scenarios
   - Implement stress tests for concurrency issues

4. **Documentation:**
   - Document the instance management architecture
   - Create troubleshooting guides for common issues
   - Add logging guidelines and error code reference

By implementing these recommendations, the instance management system would become more robust, reliable, and maintainable, effectively resolving the current issues preventing proper operation.
