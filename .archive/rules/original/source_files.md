# Source File Organization

## Services
Core application services that provide functionality across the application:
- `./services/app.manager.js` - Application lifecycle and window management
- `./services/logging.service.js` - Centralized logging with severity levels
- `./services/tray.service.js` - Tray icon and menu management
- `./services/window.service.js` - Window creation and management
- `./services/profile.service.js` - Profile management and persistence

## Providers
Provider implementations and base classes:
- `./providers/abstract/base.provider.js` - Base provider class with core functionality
- `./providers/provider.registry.js` - Provider registration and management
- `./providers/modules/*.provider.js` - Individual provider implementations

## CLI
Command-line interface components:
- `./cli/abstract/base.cli.js` - Base CLI command handler
- `./cli/modules/*.js` - Individual CLI command implementations

## Configuration
Configuration files and constants:
- `./config/user-agent.config.js` - User agent string definitions
- `./config/window.config.js` - Window configuration defaults
- `./config/app.config.js` - Global application settings

## Utils
Utility functions and helpers:
- `./utils/icons.js` - Icon management and theme handling
- `./utils/paths.js` - Path resolution and validation
- `./utils/validation.js` - Input validation helpers

## Core
Core application files:
- `./main.js` - Main electron entry point
- `./preload.js` - Preload script for webviews
- `./index.js` - Application bootstrapping
