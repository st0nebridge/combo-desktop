# Combo Desktop Architecture

This document provides a detailed overview of the Combo Desktop application architecture, designed for developers who want to understand, maintain, or extend the codebase.

## Overview

Combo Desktop is built on Electron, providing a desktop wrapper for web-based messaging services like WhatsApp and Facebook Messenger. The application follows a modular architecture with clear separation of concerns:

- **Provider System**: Extensible system for integrating different messaging services
- **Profile Management**: Support for multiple user profiles per service
- **Core Services**: Window management, tray functionality, and notification handling
- **CLI Tools**: Command-line interface for managing profiles

## Core Components

### Main Process (src/main.js)

The main process is the entry point of the application and is responsible for:

- Creating and managing the application window
- Handling system tray functionality
- Managing providers
- Coordinating profile management
- Setting up IPC communication
- Handling application lifecycle events

The `AppManager` class encapsulates most of this functionality, providing methods for:

- Creating and configuring the main window
- Setting up system tray with appropriate icons
- Handling notification state changes
- Managing keyboard shortcuts
- Initializing the selected provider

### Provider System

The provider system is designed to be extensible, allowing easy integration of new messaging services.

#### BaseProvider (src/providers/base.provider.js)

An abstract class that defines the interface for all providers:

- `initialize()`: Set up the provider
- `getUrl()`: Return the URL to load
- `getName()`: Return the provider name
- `getCommandArg()`: Return the command-line argument that activates this provider
- `getIconPath()`: Return the path to the provider's icon
- `getNotificationInterval()`: Return the notification blink interval
- `getTrayIcon()`: Get the tray icon for the current state
- `getAppIconPath()`: Get the application icon path
- `startNotification()`: Start notification blinking
- `stopNotification()`: Stop notification blinking
- `injectCustomJS()`: Inject custom JavaScript into the web page
- `getWebPreferences()`: Get web preferences for the provider

#### Provider Registry (src/providers/provider.registry.js)

Manages provider registration and creation:

- Auto-discovers and registers providers
- Creates provider instances based on command-line arguments
- Provides information about available providers

#### Concrete Providers

- **WhatsApp Provider** (src/providers/whatsapp.provider.js): Implements the WhatsApp Web integration
- **Facebook Provider** (src/providers/facebook.provider.js): Implements the Facebook Messenger integration

### Profile Management (src/services/profile.manager.js)

The profile management system allows users to maintain multiple profiles for each provider:

- Stores profile information in a configuration file
- Creates, retrieves, and deletes profiles
- Manages profile partitions for Electron sessions

### CLI Interface (src/cli/profile-cli.js)

Provides a command-line interface for managing profiles:

- List all profiles or profiles for a specific provider
- Create new profiles
- Delete existing profiles
- Delete all non-default profiles

## Data Flow

1. The application starts and processes command-line arguments
2. The `AppManager` creates a window and initializes the selected provider
3. The provider loads its URL and sets up notification monitoring
4. User interactions with the web content trigger notification state changes
5. The application updates the tray icon and shows/hides notifications accordingly

## Extending the Application

### Adding a New Provider

To add a new messaging service:

1. Create a new file in `src/providers/` (e.g., `telegram.provider.js`)
2. Implement a class that extends `BaseProvider`
3. Implement all required methods
4. The provider will be automatically registered by the provider registry

### Adding New Features

- **Window Management**: Modify `AppManager` in `main.js`
- **Tray Functionality**: Modify the `createTray()` method in `AppManager`
- **Keyboard Shortcuts**: Modify the `setupShortcuts()` method in `AppManager`
- **Profile Management**: Modify `profile.manager.js`

## Technology Stack

- **Electron**: Framework for building cross-platform desktop applications
- **Node.js**: JavaScript runtime
- **electron-store**: For persistent storage of profile information
- **electron-localshortcut**: For keyboard shortcut management
- **electron-log**: For application logging
- **electron-builder**: For packaging and distribution

## Build Process

The application uses electron-builder for packaging and distribution:

- Configuration is in the `build` section of `package.json`
- Supports building for Windows, macOS, and Linux
- Creates installers and portable versions

## Logging

The application uses electron-log for logging:

- Logs are stored in platform-specific locations
- Log level can be configured
- Logs include application startup, provider initialization, and error information
