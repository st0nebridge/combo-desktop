# Source Files Documentation

## 🛠️ SERVICES
Core application services:
- `app.manager.js` → Application lifecycle + window mgmt
- `logging.service.js` → Centralized logging + severity levels
- `tray.service.js` → Tray icon + menu mgmt
- `window.service.js` → Window creation + mgmt
- `profile.service.js` → Profile mgmt + persistence

## 🔌 PROVIDERS
Provider implementations:
- `abstract/base.provider.js` → Base provider class + core functionality
- `provider.registry.js` → Provider registration + mgmt
- `modules/*.provider.js` → Individual provider implementations

## 💻 CLI
Command-line interface:
- `abstract/base.cli.js` → Base CLI command handler
- `modules/*.js` → Individual CLI command implementations

## ⚙️ CONFIGURATION
Config files + constants:
- `user-agent.config.js` → User agent string definitions
- `window.config.js` → Window configuration defaults
- `app.config.js` → Global application settings

## 🔧 UTILS
Utility functions:
- `icons.js` → Icon mgmt + theme handling
- `paths.js` → Path resolution + validation
- `validation.js` → Input validation helpers

## 🎯 CORE
Core application files:
- `main.js` → Main electron entry point
- `preload.js` → Preload script for webviews
- `index.js` → Application bootstrapping

**⚠️ Preservation Statement:**
All file organization structure preserved. Descriptions condensed for quick reference.
