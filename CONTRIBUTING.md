# Contributing to Combo Desktop

Thank you for your interest in contributing to Combo Desktop! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

Please be respectful and considerate of others when contributing to this project. We aim to foster an inclusive and welcoming community.

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- Yarn package manager
- Git

### Setting Up the Development Environment

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/combo-desktop.git
   cd combo-desktop
   ```

3. Install dependencies:
   ```bash
   yarn install
   ```

4. Run the application in development mode:
   ```bash
   yarn dev
   ```

## Development Workflow

### Branching Strategy

- `main`: The main branch contains the latest stable release
- `develop`: The development branch contains the latest development changes
- Feature branches: Create a new branch for each feature or bugfix

### Creating a Feature Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

### Making Changes

1. Make your changes to the codebase
2. Test your changes thoroughly
3. Commit your changes with a descriptive commit message:
   ```bash
   git commit -m "Add feature: your feature description"
   ```

### Code Style

We follow the Airbnb JavaScript Style Guide. Please ensure your code adheres to this style guide by running:

```bash
yarn lint
```

### Testing

Please add tests for any new features or bugfixes. Run the tests to ensure everything is working:

```bash
yarn test
```

### Submitting a Pull Request

1. Push your changes to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. Go to the original repository on GitHub and create a pull request from your feature branch to the `develop` branch
3. Provide a clear description of the changes and reference any related issues
4. Wait for the maintainers to review your pull request

## Project Structure

Understanding the project structure will help you contribute effectively:

```
combo-desktop/
├── assets/              # Application assets (icons, images)
├── docs/                # Documentation
├── src/
│   ├── cli/             # Command-line interface tools
│   ├── config/          # Application configuration
│   ├── providers/       # Service providers (WhatsApp, Facebook)
│   ├── services/        # Core services
│   ├── utils/           # Utility functions
│   └── main.js          # Main application entry point
├── test/                # Test files
└── ...
```

## Adding a New Provider

One of the most valuable contributions is adding support for new messaging services:

1. Create a new file in `src/providers/` (e.g., `telegram.provider.js`)
2. Implement a class that extends `BaseProvider`
3. Implement all required methods (see `base.provider.js` for the interface)
4. Test your provider thoroughly

Example:

```javascript
const BaseProvider = require('./base.provider');

class TelegramProvider extends BaseProvider {
    getName() {
        return 'Telegram';
    }
    
    getCommandArg() {
        return '--telegram';
    }
    
    getBaseIconPath() {
        return 'telegram';
    }
    
    getUrl() {
        return 'https://web.telegram.org/';
    }
    
    initialize() {
        console.log('Initializing Telegram Provider...');
        this.window.loadURL(this.getUrl());
        
        // Monitor for notifications
        this.window.webContents.on('page-title-updated', (event, title) => {
            if (this.hasNotifications()) {
                this.startNotification();
            } else {
                this.stopNotification();
            }
        });
    }
    
    hasNotifications() {
        const title = this.window.getTitle();
        return title.includes('(') && title.includes(')');
    }
}

module.exports = TelegramProvider;
```

## Adding Icons for a New Provider

When adding a new provider, you'll need to add icons:

1. Create icon files in both light and dark variants
2. Place them in the `assets/icons` directory
3. Follow the naming convention: `provider-light.png` and `provider-dark.png`
4. Also add a notification variant: `provider-notification-light.png` and `provider-notification-dark.png`

## Documentation

Please update the documentation when adding new features:

- Update the README.md with any user-facing changes
- Update the API.md when changing or adding APIs
- Update the ARCHITECTURE.md when making architectural changes
- Update the USER_GUIDE.md for user-facing features

## Release Process

The maintainers follow this process for releases:

1. Merge feature branches into `develop`
2. Test thoroughly on the `develop` branch
3. Create a release branch: `release/vX.Y.Z`
4. Update version numbers and changelogs
5. Merge the release branch into `main`
6. Tag the release: `vX.Y.Z`
7. Build and publish the release artifacts

## Getting Help

If you need help with contributing, please:

1. Check the existing documentation
2. Look for similar issues on GitHub
3. Open a new issue with your question

## Thank You

Your contributions help make Combo Desktop better for everyone. Thank you for your time and effort!
