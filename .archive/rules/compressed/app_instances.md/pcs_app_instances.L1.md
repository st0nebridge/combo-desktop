<# PCS L1: App Instance Management Implementation Guide

**📊 Compression Metadata:**
- Level: L1 (Implementation Guide)
- Source: `../app_instances.md`
- Timestamp: 2025-06-10
- Token Reduction: ~45%
- Preservation: Core requirements (100%), structure (100%), examples (65%), practices (85%), validation (90%), error handling (90%)

**🔗 Navigation:** [Source](../app_instances.md) | [L2 Reference](./pcs_app_instances.L2.md)th: m:\Dev\Tools\combo-desktop\rules\compressed\app_instances.md\pcs_app_instances.L1.md -->
# PCS L1: App Instance Management Implementation Guide

**📊 Compression Metadata:**
- Level: L1 (Implementation Guide)
- Source: `../app_instances.md`
- Timestamp: 2025-06-10
- Token Reduction: ~40%
- Preservation: Core requirements (100%), structure (100%), examples (60%), practices (80%)

**🔗 Navigation:** [Source](../app_instances.md) | [L2 Version](./pcs_app_instances.L2.md)

## 📋 TABLE OF CONTENTS
- [🔐 Instance Uniqueness](#-instance-uniqueness)
- [⚡ Process Isolation](#-process-isolation)
- [🔧 Process Management](#-process-management)
- [🆕 Instance Creation](#-instance-creation)
- [💻 CLI Behavior](#-cli-behavior)
- [⚙️ Configuration](#-configuration)
- [🔄 Reset Operations](#-reset-operations)
- [📡 Inter-Process Communication](#-inter-process-communication)
- [❌ Error Handling](#-error-handling)

## 🔐 Instance Uniqueness
**MUST Requirements:**
- ✅ Unique ID (timestamp-based) per instance
- ✅ Session registration in lock file
- ✅ Unique provider+profile combinations across instances
- ✅ Session registration for each provider+profile combo
- ✅ Process isolation rule compliance

## ⚡ Process Isolation
**Priority Order (highest→lowest):**
1. **Individual processes** (safest, `--new-instance`)
2. **Profile isolation** (default behavior)
3. **Shared process** (least safe, `--one-instance`)

**Override Rules:**
- `--new-instance`: Force new process unless no providers running
- `--one-instance`: Override profile isolation, force current process
- Both still enforce session uniqueness

## 🔧 Process Management
### PID Registry (`pids.json`)
**Operations:**
- ✅ Add PID after successful initialization
- ✅ Remove PID on successful exit
- ✅ OS-level file system locking (same as instance locks)
- ✅ Clean invalid PIDs during reads
- ✅ Handle stale locks appropriately

**Termination Protocol:**
1. Clean up child processes
2. Remove PID from registry
3. Release all locks
4. Clean up temp files

## 🆕 Instance Creation
**Grouping Rules:**
- Same profile → same app instance (default)
- Different profiles → separate processes (default)
- New instance created if no existing with specified profile
- Exception: Current instance first + no providers

**CLI Parameters:**
- `--new-instance`: Force new app instance
- `--profile`: Define target profile
- Multiple providers: `--whatsapp --facebook --whatsapp "work"`

## 💻 CLI Behavior
**Command Flow:**
1. Remote control when target instance exists
2. Exit after delegation
3. Create new instance only when required

**Instance CLI Support:**
- List instances (PIDs, profiles, status)
- Kill instances (ID/PID/profile)
- Status and health checks
- Lock management
- Graceful error handling

## ⚙️ Configuration
**JSON Configuration:**
- Provider/profile settings
- Tray minimization status
- Chrome version override (blank=app default)
- CLI parameter for config file path
- Session uniqueness rules NOT overrideable

## 🔄 Reset Operations
**`reset-lock` Execution Order:**
1. Kill all processes in `pids.json`
2. Remove `pids.json` after termination
3. Remove instance lock file
4. Initialize fresh lock file

**Error Handling:** Missing PIDs, invalid PIDs, corrupted locks, permissions

## 📡 Inter-Process Communication
### Named Pipes Protocol
**Pipe Format:** `\\?\pipe\{package.name}-{pid}`
- Package name from `package.json` (runtime)
- PID-derived unique names
- Server init during construction
- Cleanup on shutdown

### Message Structure
```json
{
  "type": "delegate-command|delegate-response",
  "requestId": "unique-id",
  "targetPid": 12345,
  "args": ["command", "args"],
  "success": true,
  "error": "error-message"
}
```

### Communication Rules
- ✅ JSON messages with proper structure
- ✅ 30-second timeout max
- ✅ Error handling + logging
- ✅ Resource cleanup
- ✅ Fallback to local execution

## ❌ Error Handling
**Atomic Operations:**
- Roll back on failure
- Clean up resources
- Appropriate logging

**Specific Handling:**
- Duplicate sessions → clear rejection
- Invalid config → graceful failure + feedback
- Uniqueness violations → prevention (not just detection)

**⚠️ Preservation Statement:**
All core requirements and implementation patterns preserved. Detailed explanations condensed to essential guidance.
