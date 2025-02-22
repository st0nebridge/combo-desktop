# Combo Desktop

A desktop application that combines WhatsApp and Facebook Messenger into a single, convenient desktop experience.

## Features

- WhatsApp Web integration
- Facebook Messenger integration
- System tray support
- Desktop notifications
- Keyboard shortcuts
- Cross-platform support

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
yarn fb-start

# Start minimized to tray
yarn tray

# Start Facebook Messenger minimized to tray
yarn fb-tray
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

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.