# Combo Desktop Installation Guide

This document provides detailed instructions for installing, building, and distributing Combo Desktop.

## Installation from Pre-built Binaries

### Windows

1. Download the latest `.exe` installer from the [releases page](https://github.com/st0nebridge/combo-desktop/releases)
2. Run the installer and follow the prompts
3. The application will be installed to `%LOCALAPPDATA%\Programs\combo-desktop` by default
4. A shortcut will be created in the Start Menu

### macOS

1. Download the latest `.dmg` file from the [releases page](https://github.com/st0nebridge/combo-desktop/releases)
2. Open the DMG file
3. Drag the Combo Desktop app to the Applications folder
4. Right-click the app and select "Open" (required the first time due to security settings)

### Linux

#### Debian/Ubuntu

1. Download the latest `.deb` file from the [releases page](https://github.com/st0nebridge/combo-desktop/releases)
2. Install it using:
   ```bash
   sudo dpkg -i combo-desktop_x.y.z_amd64.deb
   sudo apt-get install -f
   ```

#### Red Hat/Fedora

1. Download the latest `.rpm` file from the [releases page](https://github.com/st0nebridge/combo-desktop/releases)
2. Install it using:
   ```bash
   sudo rpm -i combo-desktop-x.y.z.x86_64.rpm
   ```

#### AppImage

1. Download the latest `.AppImage` file from the [releases page](https://github.com/st0nebridge/combo-desktop/releases)
2. Make it executable:
   ```bash
   chmod +x Combo_Desktop-x.y.z.AppImage
   ```
3. Run it:
   ```bash
   ./Combo_Desktop-x.y.z.AppImage
   ```

## Building from Source

### Prerequisites

- Node.js (v16 or higher)
- Yarn package manager
- Git
- Platform-specific build tools:
  - Windows: Windows 10+ with Visual Studio Build Tools
  - macOS: Xcode Command Line Tools
  - Linux: GCC, make, and required development libraries

### Clone and Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/st0nebridge/combo-desktop.git
   cd combo-desktop
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

### Development Build

To run the application in development mode:

```bash
yarn dev
```

This will start the application with hot reloading for easier development.

### Production Build

To create a production build for your current platform:

```bash
yarn dist
```

This will create distributable packages in the `dist` directory.

### Platform-Specific Builds

To build for a specific platform:

```bash
# Windows
yarn dist --win

# macOS
yarn dist --mac

# Linux
yarn dist --linux
```

### Build Configuration

The build configuration is defined in the `build` section of `package.json`:

```json
"build": {
  "appId": "com.st0nebridge.combo-desktop",
  "productName": "Combo Desktop",
  "directories": {
    "output": "dist"
  },
  "win": {
    "target": "nsis",
    "icon": "build/icon.ico"
  },
  "mac": {
    "target": "dmg",
    "icon": "build/icon.icns"
  },
  "linux": {
    "target": ["deb", "rpm", "AppImage"],
    "category": "Network;Chat"
  }
}
```

You can customize this configuration to change build options, add file associations, or configure installers.

## Advanced Installation Options

### Silent Installation (Windows)

To perform a silent installation on Windows:

```bash
combo-desktop-setup-x.y.z.exe /S
```

### Custom Installation Directory (Windows)

To specify a custom installation directory:

```bash
combo-desktop-setup-x.y.z.exe /D=C:\CustomPath
```

### Installation for All Users (Windows)

By default, the application is installed for the current user only. To install for all users:

```bash
combo-desktop-setup-x.y.z.exe /allusers
```

### Portable Mode

To run the application in portable mode (storing all data in the application directory):

1. Create a file named `portable` in the application directory
2. Start the application normally

## Command-Line Arguments

Combo Desktop supports various command-line arguments:

```
--whatsapp           Start with WhatsApp
--facebook           Start with Facebook Messenger
--tray               Start minimized to tray
--profile <name>     Use a specific profile
--profiles <command> Run a profile management command
```

Examples:

```bash
# Start WhatsApp minimized to tray
combo-desktop --whatsapp --tray

# Start Facebook with a specific profile
combo-desktop --facebook --profile work

# List all profiles
combo-desktop --profiles list
```

## Uninstallation

### Windows

1. Go to Control Panel > Programs > Uninstall a program
2. Select "Combo Desktop" and click "Uninstall"
3. Alternatively, run the uninstaller directly from the installation directory

### macOS

1. Drag the application from the Applications folder to the Trash
2. To remove all data, also delete:
   ```
   ~/Library/Application Support/combo-desktop
   ~/Library/Logs/combo-desktop
   ```

### Linux

#### Debian/Ubuntu

```bash
sudo apt-get remove combo-desktop
```

#### Red Hat/Fedora

```bash
sudo rpm -e combo-desktop
```

#### AppImage

Simply delete the AppImage file. To remove all data, also delete:
```bash
~/.config/combo-desktop
```

## Troubleshooting Installation Issues

### Windows: "Windows protected your PC" Message

If you see this message:

1. Click "More info"
2. Click "Run anyway"

This happens because the application is not signed with a Microsoft-recognized certificate.

### macOS: "App cannot be opened because the developer cannot be verified"

If you see this message:

1. Right-click (or Control-click) the app
2. Select "Open" from the context menu
3. Click "Open" in the dialog that appears

### Linux: Missing Dependencies

If the application fails to start due to missing dependencies:

```bash
# Debian/Ubuntu
sudo apt-get install -f

# Red Hat/Fedora
sudo dnf install libXScrnSaver
```

### General: Application Crashes on Startup

1. Try running from the command line to see error messages:
   ```bash
   /path/to/combo-desktop
   ```

2. Check the logs:
   - Windows: `%USERPROFILE%\AppData\Roaming\combo-desktop\logs`
   - macOS: `~/Library/Logs/combo-desktop`
   - Linux: `~/.config/combo-desktop/logs`

3. Make sure your system meets the minimum requirements:
   - 64-bit operating system
   - Windows 10+, macOS 10.13+, or modern Linux distribution
   - 4GB RAM
   - 100MB free disk space
