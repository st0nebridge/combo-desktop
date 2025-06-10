<!-- filepath: m:\Dev\Tools\combo-desktop\rules\compressed\app_instances.md\pcs_app_instances.L2.md -->
# PCS L2: App Instance Operations Reference

**📊 Compression Metadata:**
- Level: L2 (Operational Reference)
- Source: `../app_instances.md`
- Timestamp: 2025-06-10
- Token Reduction: ~70%
- Preservation: Core requirements (100%), structure (100%), critical examples (20%)

**🔗 Navigation:** [Source](../app_instances.md) | [L1 Guide](./pcs_app_instances.L1.md)

## 🔐 UNIQUENESS RULES
- ✅ Unique ID (timestamp) per instance
- ✅ Provider+profile combinations unique across instances
- ✅ Session registration required

## ⚡ ISOLATION PRIORITY
1. Individual processes (`--new-instance`) 
2. Profile isolation (default)
3. Shared process (`--one-instance`)

## 🔧 PROCESS MGMT
- **PID Registry:** `pids.json` with OS-level locking
- **Termination:** cleanup children → remove PID → release locks → cleanup temp

## 🆕 CREATION RULES
- Same profile → same instance (default)
- Different profiles → separate processes
- `--new-instance` → force new unless no providers
- `--one-instance` → override isolation

## 💻 CLI BEHAVIOR
- Remote control existing instances
- Exit after delegation
- Instance CLI: list/kill/status/locks

## 📡 IPC PROTOCOL
- **Pipes:** `\\?\pipe\{package.name}-{pid}`
- **Messages:** JSON with type/requestId/targetPid/args/success/error
- **Timeout:** 30 seconds max
- **Fallback:** Local execution on failure

## ⚙️ CONFIG
- JSON: provider/profile/tray/chrome settings
- CLI parameter for config path
- Session uniqueness NOT overrideable

## 🔄 RESET-LOCK
1. Kill pids.json processes
2. Remove pids.json
3. Remove instance lock
4. Initialize fresh lock

## ❌ ERROR HANDLING
- Atomic operations with rollback
- Duplicate sessions → rejection
- Invalid config → graceful failure
- Prevention > detection

**⚠️ Preservation Statement:**
All operational requirements preserved. Implementation details reduced for quick reference.
