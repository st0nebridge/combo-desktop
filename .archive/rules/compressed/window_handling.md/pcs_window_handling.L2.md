<!-- filepath: m:\Dev\Tools\combo-desktop\rules\compressed\window_handling.md\pcs_window_handling.L2.md -->
# PCS L2: Window Handling Operations Reference

**📊 Compression Metadata:**
- Level: L2 (Operational Reference)
- Source: `../window_handling.md`
- Timestamp: 2025-06-10
- Token Reduction: ~70%
- Preservation: Core requirements (100%), structure (100%), critical examples (30%)

**🔗 Navigation:** [Source](../window_handling.md)

## 🪟 WINDOW CREATION
- ✅ All windows → `WindowService.createWindow()`
- ✅ Unique `windowName` identifier required
- ✅ Required config:
```js
webPreferences: { contextIsolation: true, webSecurity: true }
```

## 🔐 WINDOW SECURITY
- ✅ Context isolation enabled (all windows)
- ✅ Web security enabled (all windows)  
- ✅ Remote content loading disabled (default)

## 🔄 WINDOW LIFECYCLE
- ✅ Hide instead of close (default behavior)
- ✅ Force close via `forceClose` flag
- ✅ Cleanup during close event
- ✅ Unregister provider sessions before destruction

## 🎛️ STATE MANAGEMENT
- ✅ Use `WindowService.resolveWindow()` for operations
- ✅ Track state using internal `windows` Map
- ✅ Check `isDestroyed()` before operations
- ✅ Handle `ready-to-show` event before display

## ❌ ERROR HANDLING
- ✅ Try-catch blocks for all window operations
- ✅ Log service for errors with severity
- ✅ Failed creation MUST NOT crash app

## 🚪 APPLICATION QUIT
- ✅ Set `isQuitting` flag before force close
- ✅ Cleanup provider sessions before quit
- ✅ Last window closure triggers app quit

## 🧠 MEMORY MANAGEMENT
- ✅ Remove window refs from `windows` Map after closure
- ✅ Clear event listeners during cleanup
- ✅ Ensure proper garbage collection

**⚠️ Preservation Statement:**
All window handling requirements and security rules preserved. Implementation details reduced for operational reference.
