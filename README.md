# Combo Desktop

A desktop application that combines WhatsApp and Facebook Messenger into a single, convenient desktop experience.

## Features

- WhatsApp Web integration
- Facebook Messenger integration
- Multi-profile support for each service
- Multi-window support with session isolation
- System tray support with notification indicators
- Desktop notifications
- Keyboard shortcuts
- Cross-platform support (Windows, macOS, Linux)
- Dark mode support

## Installation

1. Clone the repository:
```bash
git clone https://github.com/st0nebridge/combo-desktop.git
cd combo-desktop
```

2. Install dependencies:
```bash
yarn install
```

3. Start the application:
```bash
# Start with WhatsApp (default)
yarn start

# Start with Facebook Messenger
yarn facebook

# Start minimized to tray
yarn whatsapp-tray

# Start Facebook Messenger minimized to tray
yarn facebook-tray
```

## Usage

### Basic Usage

```bash
# Start with WhatsApp (default)
yarn start

# Start with Facebook Messenger
yarn facebook

# Start minimized to tray
yarn whatsapp-tray

# Start Facebook Messenger minimized to tray
yarn facebook-tray
```

### Advanced Usage

```bash
# Start multiple providers
electron . --whatsapp --facebook

# Start providers with specific profiles
electron . --whatsapp "work" --facebook "personal"

# Start minimized to tray
electron . --whatsapp --tray

# Force new application instance
electron . --whatsapp --new-instance

# Use configuration file
electron . --config config.json

# Override Chrome version
electron . --whatsapp --chrome-version "120.0.0"

# Group all providers in one instance
electron . --whatsapp "work" --facebook "personal" --one-instance
```

### Configuration File

You can specify all settings in a JSON configuration file:

```json
{
  "providers": [
    {
      "provider": "--whatsapp",
      "profile": "work"
    },
    {
      "provider": "--facebook",
      "profile": "personal"
    }
  ],
  "startMinimized": true,
  "chromeVersion": "120.0.0",
  "forceNewInstance": false,
  "oneInstance": false
}
```

## Architecture

Combo Desktop is built using Electron and follows a modular architecture:

- **Providers**: Each messaging service (WhatsApp, Facebook) is implemented as a provider that extends the BaseProvider class
- **Profile Management**: Support for multiple user profiles per service
- **Services**: Core services for window management, tray functionality, and profile management
- **CLI Tools**: Command-line interface for managing profiles

### Directory Structure

```
combo-desktop/
├── assets/              # Application assets (icons, images)
├── src/
│   ├── cli/             # Command-line interface tools
│   ├── config/          # Application configuration
│   ├── providers/       # Service providers (WhatsApp, Facebook)
│   ├── services/        # Core services
│   ├── utils/           # Utility functions
│   └── main.js          # Main application entry point
└── ...
```

## Project Structure

This project maintains a clean structure for production use:

```
combo-desktop/
├── src/                 # Production source code
├── docs/               # User and developer documentation
├── tests/              # Formal test suite
├── assets/             # Application assets
├── archived/           # Archived development files
├── package.json        # Project configuration
├── README.md          # This file
└── CHANGELOG.md       # Version history
```

### Archived Development Files

Development and debugging files have been moved to the `archived/` directory to maintain a clean production codebase:
- `archived/development-tests/` - Individual test scripts from development
- `archived/debug-scripts/` - Debugging utilities and diagnostic tools
- `archived/development-tools/` - Demo scripts and validation tools
- `archived/implementation-notes/` - Development completion documentation

These files can be restored to the project root if needed for development work.

## Profile Management

Combo Desktop supports multiple user profiles for each messaging service. This allows you to use multiple accounts simultaneously.

### Managing Profiles via CLI

```bash
# List all profiles
yarn profiles list

# List profiles for a specific provider
yarn profiles list --provider WhatsApp

# Create a new profile
yarn profiles create --provider WhatsApp --name work

# Delete a profile
yarn profiles delete --provider Facebook --name personal

# Delete all non-default profiles
yarn profiles delete-all
```

### Using Profiles

To start the application with a specific profile:

```bash
# Start WhatsApp with a specific profile
electron . --whatsapp --profile work

# Start Facebook with a specific profile
electron . --facebook --profile personal
```

## Multi-Window Support

Combo Desktop now supports running multiple provider windows efficiently:

- Each profile runs in its own process by default for better isolation
- Multiple providers can be opened simultaneously
- Only one instance of each provider+profile combination is allowed
- Windows can be individually minimized to tray
- Each window has its own tray icon with notifications
- CLI commands target the correct application instance

### Instance Management

The application follows these rules for managing instances:

1. By default, providers using the same profile group to the same application instance
2. Different profiles run in separate processes for better isolation
3. The `--new-instance` flag forces a new application instance
4. The `--one-instance` flag groups all providers in one instance
5. Only one instance of each provider+profile combination (session) is allowed

## Development

### Prerequisites

- Node.js (v16 or higher)
- Yarn package manager
- Git

### Setup Development Environment

1. Install development dependencies:
```bash
yarn install
```

2. Run in development mode:
```bash
yarn dev
```

### Building

To create a production build:

```bash
# For your current platform
yarn dist

# For a specific platform
yarn dist --win
yarn dist --mac
yarn dist --linux
```

### Testing

```bash
# Run tests
yarn test

# Run linter
yarn lint
```

## Keyboard Shortcuts

- `Esc`: Hide window to tray

## Troubleshooting

### Common Issues

1. **WhatsApp QR Code Not Scanning**
   - Make sure your phone has a stable internet connection
   - Try refreshing the page
   - Clear the profile data: `yarn profiles delete --provider WhatsApp --name <profile_name>`

2. **Facebook Login Issues**
   - Try clearing the profile data: `yarn profiles delete --provider Facebook --name <profile_name>`
   - Check if Facebook is accessible in your browser

3. **Notification Issues**
   - Make sure notifications are enabled in your operating system
   - Check if the application has permission to send notifications

### Logs

Application logs are stored in:
- Windows: `%USERPROFILE%\AppData\Roaming\combo-desktop\logs`
- macOS: `~/Library/Logs/combo-desktop`
- Linux: `~/.config/combo-desktop/logs`

## Extending

### Adding a New Provider

To add a new messaging service:

1. Create a new provider class in `src/providers/` that extends `BaseProvider`
2. Implement all required methods
3. The provider will be automatically registered

Example:
```javascript
const BaseProvider = require('./base.provider');

class MyNewProvider extends BaseProvider {
    getName() {
        return 'MyService';
    }
    
    getCommandArg() {
        return '--myservice';
    }
    
    getUrl() {
        return 'https://my-service.com';
    }
    
    // Implement other required methods...
}

module.exports = MyNewProvider;
```

## Quality & Compliance

This project adheres to the following protocols:

### MSP (Modular Structure Protocol) v1.0

- Atomic module responsibility
- Hierarchical organization with clear dependency chains
- Self-documenting modules with standardized headers
- See [`manifest.json`](./manifest.json) for module definitions

### TICP (Test Iteration & Coverage Protocol) v1.0

- Coverage thresholds: 85% statements, 70% branches, 85% functions, 85% lines
- Critical modules: 90/80/90/90
- TDD workflow encouraged
- No delete-to-pass allowed

**Documentation:**
- [Test Charter](./docs/TEST_CHARTER.md) - Test strategy and objectives
- [Coverage Map](./docs/COVERAGE_MAP.md) - Module coverage matrix
- [Waivers](./quality/waivers/README.md) - Coverage waiver process

### Running Quality Checks

```bash
# Full validation (lint + test + coverage)
npm run validate

# Coverage report only
npm run test:coverage
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Ensure MSP/TICP compliance
4. Run `npm run validate` before committing
5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.