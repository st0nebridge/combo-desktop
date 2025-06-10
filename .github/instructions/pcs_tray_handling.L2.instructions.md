# Tray Handling Requirements

## 🎯 CORE PRINCIPLES
- ✅ All tray functionality → TrayService
- ✅ Multiple tray icons support
- ✅ Window mgmt → AppManager/WindowService only

## 🔌 BASE PROVIDER REQUIREMENTS
### Context Menu
- ✅ Menu options defined in BaseProvider
- ✅ Providers can override/extend menus
- ✅ Consistent menu structure across providers

### Click Handlers
- ✅ Handlers in BaseProvider
- **Double-click:** Toggle window visibility
- **Single-click:** Empty handler for provider override
- ✅ Use AppManager/WindowService for window ops

## 🛠️ TRAY SERVICE RESPONSIBILITIES
### 🖼️ Icon Management
- Create/cleanup tray icons
- Support multiple concurrent icons
- Manage notification icon state

### 📋 Context Menu
- Build menus from provider templates
- Update menu items dynamically

### ⚡ Event Handling
- Route click events to provider handlers
- Manage notification state changes

### 🧹 Cleanup
- Dispose all tray icons
- Clear event listeners
- Reset internal state

## 📐 IMPLEMENTATION GUIDELINES
- ✅ Use log service for error logging
- ✅ Separate tray UI logic from window mgmt
- ✅ Cleanup chain: AppManager → TrayService → disposal

## ❌ ERROR HANDLING
- ✅ Log tray creation/destruction errors
- ✅ Gracefully handle missing icons/resources
- ✅ Recover from notification state errors

**⚠️ Preservation Statement:**
All tray handling requirements and responsibilities preserved. Implementation details reduced for operational reference.
