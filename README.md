# Combo Desktop

A desktop application that combines WhatsApp and Facebook Messenger into a single, convenient desktop experience.

## Features

- WhatsApp Web integration
- Facebook Messenger integration
- Multi-profile support for each service
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

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.