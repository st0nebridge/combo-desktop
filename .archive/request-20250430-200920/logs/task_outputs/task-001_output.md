# Task Output: Scan Source Directory Structure

Task ID: task-001
Started: 2025-04-30T20:14:00+01:00
Completed: 2025-04-30T20:14:30+01:00

## Source Directory Structure

The application has the following directory structure:

```
src/
├── cli/
│   ├── abstract/
│   │   └── base-cli.js
│   ├── cli.registry.js
│   ├── index.js
│   ├── modules/
│   │   ├── help-cli.js
│   │   ├── instance-cli.js
│   │   ├── profile-cli.js
│   │   └── provider-cli.js
│   └── old/
│       ├── help-cli.js
│       ├── instance-cli.js
│       ├── profile-cli.js
│       └── provider-cli.js
├── config/
│   ├── app.config.js
│   └── user-agent.config.js
├── main.js
├── preload.js
├── providers/
│   ├── abstract/
│   │   └── base.provider.js
│   ├── index.js
│   ├── modules/
│   │   ├── facebook.provider.js
│   │   └── whatsapp.provider.js
│   └── provider.registry.js
├── services/
│   ├── app.manager.js
│   ├── instance.manager.js
│   ├── logging.service.js
│   ├── profile.manager.js
│   ├── tray.service.js
│   └── window.service.js
└── utils/
    └── icons.js
```

## Key Components Identified

1. **Main Entry Point**: The application entry point is `main.js`.
2. **Service Layer**:
   - `instance.manager.js`: Manages application instances and their lifecycle.
   - `app.manager.js`: Manages the application initialization.
   - Other services for logging, profiles, window management, etc.
3. **Providers**:
   - Social media providers for WhatsApp and Facebook.
   - Abstract provider classes for shared functionality.
4. **CLI**:
   - Command-line interface modules for different functionalities.
   - Registry for CLI commands.
5. **Configuration**: App and user-agent configurations.

## Notes on Codebase Organization

The codebase follows a modular structure with clear separation of concerns:

- Core application logic in services
- Provider-specific implementations in providers
- Command-line interface handling in cli
- Configuration in config
- Utility functions in utils

The directory structure suggests an Electron application designed to manage different social media provider instances.
