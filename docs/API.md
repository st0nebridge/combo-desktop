# Combo Desktop API Documentation

This document provides detailed API documentation for the Combo Desktop application, focusing on the interfaces and services available for extending the application.

## Provider API

The Provider API is the core extensibility point of Combo Desktop. By implementing a provider, you can integrate any web-based messaging service into the application.

### BaseProvider

All providers must extend the `BaseProvider` class and implement its abstract methods.

#### Constructor

```javascript
constructor(window)
```

- `window`: The Electron BrowserWindow instance

#### Abstract Methods

These methods must be implemented by all providers:

##### initialize()

```javascript
initialize()
```

Sets up the provider, loads the URL, and configures event listeners.

##### getUrl()

```javascript
getUrl() => string
```

Returns the URL that this provider should load.

##### getName()

```javascript
getName() => string
```

Returns the display name of this provider.

##### getCommandArg()

```javascript
getCommandArg() => string
```

Returns the command-line argument that activates this provider (e.g., `--whatsapp`).

##### getBaseIconPath()

```javascript
getBaseIconPath() => string
```

Returns the base name of the icon file without extension (e.g., `whatsapp`).

#### Optional Methods to Override

##### getNotificationInterval()

```javascript
getNotificationInterval() => number
```

Returns the notification blink interval in milliseconds. Default is 3000ms.

##### injectCustomJS()

```javascript
injectCustomJS()
```

Injects custom JavaScript into the web page. Used for customizing the web application behavior.

##### hasNotifications()

```javascript
hasNotifications() => boolean
```

Determines if there are active notifications. Usually implemented by checking the window title.

#### Utility Methods

##### getTrayIcon(hasNotification)

```javascript
getTrayIcon(hasNotification = false) => Object
```

- `hasNotification`: Boolean indicating whether there is a notification
- Returns: Object containing the icon path and theme information

##### getAppIconPath()

```javascript
getAppIconPath() => string
```

Returns the path to the application icon.

##### startNotification()

```javascript
startNotification()
```

Starts the notification blinking effect.

##### stopNotification()

```javascript
stopNotification()
```

Stops the notification blinking effect.

##### getWebPreferences()

```javascript
getWebPreferences() => Object
```

Returns web preferences for the provider.

##### setWebPreferences(preferences)

```javascript
setWebPreferences(preferences)
```

- `preferences`: Object containing web preferences

Sets web preferences for the provider.

### Provider Registry

The Provider Registry manages the registration and creation of providers.

#### register(ProviderClass)

```javascript
register(ProviderClass) => ProviderRegistry
```

- `ProviderClass`: The provider class to register
- Returns: The registry instance for chaining

Registers a provider class with the registry.

#### createProvider(window, args)

```javascript
createProvider(window, args) => BaseProvider
```

- `window`: The Electron BrowserWindow instance
- `args`: Command-line arguments
- Returns: An instance of the appropriate provider

Creates a provider instance based on command-line arguments.

#### getAvailableProviders()

```javascript
getAvailableProviders() => Array
```

Returns an array of available providers with their names and command arguments.

## Profile Management API

The Profile Manager handles the creation, retrieval, and deletion of user profiles.

### getPartitionName(providerName, profileName)

```javascript
getPartitionName(providerName, profileName = 'default') => string
```

- `providerName`: Name of the provider
- `profileName`: Name of the profile
- Returns: The partition name for the profile

Gets the partition name for a specific provider and profile.

### createProfile(providerName, profileName, options)

```javascript
createProfile(providerName, profileName = 'default', options = {}) => string
```

- `providerName`: Name of the provider
- `profileName`: Name of the profile
- `options`: Additional options for the profile
- Returns: The partition name for the created profile

Creates a new profile for a provider.

### getProfile(providerName, profileName)

```javascript
getProfile(providerName, profileName = 'default') => Object
```

- `providerName`: Name of the provider
- `profileName`: Name of the profile
- Returns: The profile object or undefined if not found

Gets a profile by provider name and profile name.

### getAllProfiles()

```javascript
getAllProfiles() => Object
```

Returns all profiles.

### getProfilesByProvider(providerName)

```javascript
getProfilesByProvider(providerName) => Object
```

- `providerName`: Name of the provider
- Returns: Object containing profiles for the specified provider

Gets all profiles for a specific provider.

### deleteProfile(providerName, profileName)

```javascript
deleteProfile(providerName, profileName = 'default')
```

- `providerName`: Name of the provider
- `profileName`: Name of the profile

Deletes a profile.

### deleteAllProfiles()

```javascript
deleteAllProfiles()
```

Deletes all profiles.

## CLI API

The CLI interface provides commands for managing profiles from the command line.

### handleCommand(args)

```javascript
handleCommand(args)
```

- `args`: Command-line arguments

Handles a CLI command.

### listProfiles(args)

```javascript
listProfiles(args)
```

- `args`: Command-line arguments

Lists profiles.

### createProfile(args)

```javascript
createProfile(args)
```

- `args`: Command-line arguments

Creates a profile.

### deleteProfile(args)

```javascript
deleteProfile(args)
```

- `args`: Command-line arguments

Deletes a profile.

### deleteAllProfiles(args)

```javascript
deleteAllProfiles(args)
```

- `args`: Command-line arguments

Deletes all non-default profiles.

## Icon Utilities

The icon utilities provide functions for working with application icons.

### getIconPath(serviceName, hasNotification)

```javascript
getIconPath(serviceName, hasNotification = false) => Object
```

- `serviceName`: Name of the service
- `hasNotification`: Whether there is a notification
- Returns: Object containing the icon path and theme information

Gets the appropriate icon for the current theme and notification state.

### getAppIconPath(serviceName)

```javascript
getAppIconPath(serviceName) => string
```

- `serviceName`: Name of the service
- Returns: Path to the app icon

Gets the app icon path for a service.
