# Extending Combo Desktop

This guide explains how to extend Combo Desktop with new features, particularly how to add support for additional messaging services.

## Adding a New Messaging Service Provider

Combo Desktop is designed to be easily extensible with new messaging services. Follow these steps to add a new provider:

### 1. Create a Provider Class

Create a new file in the `src/providers/` directory named after your service (e.g., `telegram.provider.js`):

```javascript
const BaseProvider = require('./base.provider');

class TelegramProvider extends BaseProvider {
    constructor(window) {
        super(window);
    }

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
        // Implement notification detection logic specific to this service
        return title.includes('(') && title.includes(')');
    }

    injectCustomJS() {
        // Add any service-specific JS injection here
        this.window.webContents.executeJavaScript(`
            // Disable service worker registrations
            window.navigator.serviceWorker.getRegistrations().then(registrations => {
                for (let registration of registrations) {
                    registration.unregister();
                }
            });
        `);
    }
}

module.exports = TelegramProvider;
```

### 2. Add Icons

Create icons for your provider in the `assets/icons` directory:

1. Regular icons:
   - `telegram-light.png` - Light theme icon
   - `telegram-dark.png` - Dark theme icon

2. Notification icons:
   - `telegram-notification-light.png` - Light theme notification icon
   - `telegram-notification-dark.png` - Dark theme notification icon

Icons should be PNG format with transparency, ideally 32x32 pixels for tray icons.

### 3. Update Package Scripts (Optional)

Add convenience scripts to `package.json` for your new provider:

```json
"scripts": {
  "telegram": "electron . --telegram",
  "telegram-tray": "electron . --telegram --tray"
}
```

### 4. Test Your Provider

The provider will be automatically registered by the provider registry. Test it by running:

```bash
yarn telegram
```

## Customizing Provider Behavior

### Custom Web Preferences

You can customize the web preferences for your provider by overriding the constructor:

```javascript
constructor(window) {
    super(window);
    
    // Set custom web preferences
    this.setWebPreferences({
        webSecurity: false,
        allowRunningInsecureContent: true
    });
}
```

### Custom Notification Detection

Different web services indicate notifications in different ways. Override the `hasNotifications()` method to implement custom detection:

```javascript
hasNotifications() {
    // Check for unread messages in the DOM
    return this.window.webContents.executeJavaScript(`
        !!document.querySelector('.unread-badge')
    `);
}
```

### Custom JavaScript Injection

You can inject custom JavaScript to modify the behavior of the web application:

```javascript
injectCustomJS() {
    this.window.webContents.executeJavaScript(`
        // Hide unwanted elements
        const style = document.createElement('style');
        style.textContent = '.ad-banner { display: none !important; }';
        document.head.appendChild(style);
        
        // Add custom functionality
        window.addEventListener('message', (event) => {
            if (event.data.type === 'new-message') {
                // Do something with new messages
            }
        });
    `);
}
```

## Advanced Extensions

### Custom Notification Interval

Override the `getNotificationInterval()` method to customize the notification blinking interval:

```javascript
getNotificationInterval() {
    return 1000; // 1 second
}
```

### Custom URL Parameters

Modify the URL to include custom parameters:

```javascript
getUrl() {
    return 'https://web.telegram.org/?theme=dark&lang=en';
}
```

### Custom Window Settings

You can customize the window settings in the `initialize()` method:

```javascript
initialize() {
    // Set custom window title
    this.window.setTitle('Telegram Desktop');
    
    // Set custom window size
    this.window.setSize(1200, 800);
    
    // Load the URL
    this.window.loadURL(this.getUrl());
    
    // Other initialization...
}
```

## Handling Service-Specific Events

Some services may require handling specific events:

```javascript
initialize() {
    this.window.loadURL(this.getUrl());
    
    // Handle new window creation (e.g., for OAuth)
    this.window.webContents.setWindowOpenHandler(({ url }) => {
        if (url.includes('oauth')) {
            // Open OAuth windows externally
            require('electron').shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });
    
    // Other initialization...
}
```

## Adding New Features

### New System Tray Features

To add new features to the system tray menu, modify the `createTray()` method in `main.js`:

```javascript
createTray() {
    // ... existing code ...
    
    // Create context menu with additional options
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show',
            click: () => {
                this.window.show();
                this.window.focus();
            }
        },
        {
            label: 'Reload',
            click: () => {
                this.window.reload();
            }
        },
        {
            label: 'Switch Profile',
            submenu: [
                {
                    label: 'Default',
                    click: () => {
                        // Code to switch profile
                    }
                },
                {
                    label: 'Work',
                    click: () => {
                        // Code to switch profile
                    }
                }
            ]
        },
        {
            label: 'Exit',
            click: () => {
                this.window.isQuitting = true;
                app.quit();
            }
        }
    ]);
    
    // ... rest of the method ...
}
```

### Additional Keyboard Shortcuts

To add new keyboard shortcuts, modify the `setupShortcuts()` method in `main.js`:

```javascript
setupShortcuts() {
    electronLocalshortcut.register(this.window, 'Esc', () => {
        this.window.hide();
    });
    
    electronLocalshortcut.register(this.window, 'CommandOrControl+R', () => {
        this.window.reload();
    });
    
    electronLocalshortcut.register(this.window, 'CommandOrControl+Shift+I', () => {
        this.window.webContents.toggleDevTools();
    });
}
```

## Contributing Your Extensions

If you've created a new provider or added new features, consider contributing them back to the main project:

1. Fork the repository
2. Create a feature branch
3. Add your changes
4. Submit a pull request

See the [CONTRIBUTING.md](../CONTRIBUTING.md) file for more details on the contribution process.
