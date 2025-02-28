# Combo Desktop User Guide

Welcome to Combo Desktop, your all-in-one solution for WhatsApp and Facebook Messenger on desktop!

## Getting Started

### Installation

1. Download the latest release for your platform from the [releases page](https://github.com/st0nebridge/combo-desktop/releases).
2. Install the application:
   - **Windows**: Run the installer (.exe) and follow the prompts
   - **macOS**: Drag the application to your Applications folder
   - **Linux**: Use the appropriate package for your distribution (.deb, .rpm, or AppImage)

### First Launch

When you first launch Combo Desktop, you'll need to choose which messaging service to use:

- **WhatsApp**: The application will open WhatsApp Web and display a QR code. Scan this with your phone's WhatsApp app to log in.
- **Facebook Messenger**: You'll be prompted to log in with your Facebook credentials.

## Basic Usage

### Switching Between Services

Combo Desktop can run either WhatsApp or Facebook Messenger at a time. To switch:

1. Close the current instance of Combo Desktop
2. Launch it again with the appropriate command:
   - For WhatsApp: `combo-desktop --whatsapp`
   - For Facebook Messenger: `combo-desktop --facebook`

### System Tray

Combo Desktop runs in the system tray, allowing you to keep it running in the background:

- **Show/Hide**: Click the tray icon to toggle the window visibility
- **Exit**: Right-click the tray icon and select "Exit"

### Notifications

Combo Desktop supports desktop notifications:

- The tray icon will blink when you have unread messages
- Desktop notifications will appear for new messages (if enabled in your browser settings)

### Keyboard Shortcuts

- **Esc**: Hide the window to the system tray

## Using Multiple Profiles

Combo Desktop supports multiple user profiles for each messaging service, allowing you to use multiple accounts simultaneously.

### Creating a New Profile

1. Open a command prompt or terminal
2. Navigate to the Combo Desktop installation directory
3. Run the following command:
   ```
   combo-desktop --profiles create --provider WhatsApp --name work
   ```
   (Replace "WhatsApp" with "Facebook" for Facebook Messenger, and "work" with your desired profile name)

### Using a Profile

To start Combo Desktop with a specific profile:

```
combo-desktop --whatsapp --profile work
```

(Replace "whatsapp" with "facebook" for Facebook Messenger, and "work" with your profile name)

### Managing Profiles

To list all profiles:
```
combo-desktop --profiles list
```

To delete a profile:
```
combo-desktop --profiles delete --provider WhatsApp --name work
```

## Customization

### Dark Mode

Combo Desktop automatically adapts to your system's theme settings. To change the appearance:

1. Change your system theme to light or dark mode
2. Restart Combo Desktop

## Troubleshooting

### WhatsApp Issues

#### QR Code Not Scanning

1. Make sure your phone has a stable internet connection
2. Try refreshing the page by right-clicking and selecting "Reload"
3. If problems persist, try clearing the profile data:
   ```
   combo-desktop --profiles delete --provider WhatsApp --name default
   ```
   Then restart the application

#### WhatsApp Web Not Loading

1. Check your internet connection
2. Make sure WhatsApp Web is not blocked on your network
3. Try restarting the application

### Facebook Messenger Issues

#### Login Problems

1. Make sure you're using the correct credentials
2. Check if you need to complete a security check on the Facebook website
3. Try clearing the profile data:
   ```
   combo-desktop --profiles delete --provider Facebook --name default
   ```
   Then restart the application

### General Issues

#### Application Not Starting

1. Make sure you have a stable internet connection
2. Check if your antivirus is blocking the application
3. Try reinstalling the application

#### High CPU Usage

1. Close and reopen the application
2. Make sure you have the latest version installed
3. Check if you have many active conversations with media content

## Frequently Asked Questions

### Can I use both WhatsApp and Facebook Messenger at the same time?

Currently, Combo Desktop can only run one service at a time. You need to close the application and restart it with the appropriate command-line argument to switch services.

### Is my data secure?

Combo Desktop is just a wrapper around the official web versions of these services. Your messages and data are handled according to the privacy policies of WhatsApp and Facebook.

### Does Combo Desktop work offline?

No, Combo Desktop requires an internet connection to function as it loads the web versions of WhatsApp and Facebook Messenger.

### Can I use Combo Desktop on multiple computers?

Yes, you can install and use Combo Desktop on multiple computers. For WhatsApp, note that WhatsApp Web can only be active on one computer at a time unless you're using the multi-device beta feature.

### How do I update Combo Desktop?

Download and install the latest version from the [releases page](https://github.com/st0nebridge/combo-desktop/releases). The application will replace the older version.

## Getting Help

If you encounter issues not covered in this guide, please:

1. Check the [GitHub issues](https://github.com/st0nebridge/combo-desktop/issues) to see if your problem has been reported
2. Submit a new issue with detailed information about your problem
3. Include logs from the following location:
   - Windows: `%USERPROFILE%\AppData\Roaming\combo-desktop\logs`
   - macOS: `~/Library/Logs/combo-desktop`
   - Linux: `~/.config/combo-desktop/logs`
