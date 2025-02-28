# Combo Desktop Profile System

This document provides a detailed explanation of the profile system in Combo Desktop, including how it works, how to use it, and how to manage profiles.

## Overview

The profile system in Combo Desktop allows users to maintain multiple separate accounts for each messaging service (WhatsApp and Facebook Messenger). Each profile has its own isolated storage, cookies, and login state, enabling users to switch between different accounts without logging out and back in.

## How Profiles Work

Profiles in Combo Desktop are implemented using Electron's session partitioning feature. Each profile gets its own partition, which isolates its storage from other profiles.

### Profile Storage

Profiles are stored in a configuration file using electron-store. The location of this file depends on your operating system:

- **Windows**: `%APPDATA%\combo-desktop\profiles.json`
- **macOS**: `~/Library/Application Support/combo-desktop/profiles.json`
- **Linux**: `~/.config/combo-desktop/profiles.json`

Each profile entry contains:
- Provider name (e.g., "WhatsApp" or "Facebook")
- Profile name (e.g., "work", "personal")
- Creation timestamp
- Custom options (if any)

### Partition Naming

Partition names follow this format:
```
combo-desktop:ProviderName:ProfileName
```

For example:
- `combo-desktop:WhatsApp:default`
- `combo-desktop:Facebook:work`

## Using Profiles

### Default Profile

Each provider has a default profile that is used when no specific profile is specified. This profile is named "default" and is created automatically the first time you use a provider.

### Creating Profiles

Profiles can be created using the CLI:

```bash
combo-desktop --profiles create --provider WhatsApp --name work
```

Or programmatically:

```javascript
const profileManager = require('./services/profile.manager');
profileManager.createProfile('WhatsApp', 'work');
```

### Using a Specific Profile

To use a specific profile when starting the application:

```bash
combo-desktop --whatsapp --profile work
```

This will start WhatsApp with the "work" profile. If the profile doesn't exist, you'll be prompted to create it.

### Listing Profiles

To list all available profiles:

```bash
combo-desktop --profiles list
```

To list profiles for a specific provider:

```bash
combo-desktop --profiles list --provider WhatsApp
```

### Deleting Profiles

To delete a profile:

```bash
combo-desktop --profiles delete --provider WhatsApp --name work
```

To delete all non-default profiles:

```bash
combo-desktop --profiles delete-all
```

## Profile Data

Each profile stores:

- Cookies
- Local storage
- Session storage
- IndexedDB data
- Cache

This allows each profile to maintain its own login state, preferences, and message history.

## Use Cases

### Multiple WhatsApp Accounts

If you have multiple WhatsApp accounts (e.g., personal and work), you can create a profile for each:

```bash
combo-desktop --profiles create --provider WhatsApp --name personal
combo-desktop --profiles create --provider WhatsApp --name work
```

Then start the application with the desired profile:

```bash
combo-desktop --whatsapp --profile personal
```

### Multiple Facebook Accounts

Similarly, for multiple Facebook accounts:

```bash
combo-desktop --profiles create --provider Facebook --name personal
combo-desktop --profiles create --provider Facebook --name work
```

Then start the application with the desired profile:

```bash
combo-desktop --facebook --profile work
```

### Temporary Profiles

You can create temporary profiles for one-time use:

```bash
combo-desktop --profiles create --provider WhatsApp --name temp
combo-desktop --whatsapp --profile temp
```

And delete them when done:

```bash
combo-desktop --profiles delete --provider WhatsApp --name temp
```

## Advanced Usage

### Profile Options

When creating a profile, you can specify additional options:

```bash
combo-desktop --profiles create --provider WhatsApp --name work --options '{"userAgent": "custom-agent"}'
```

These options are stored with the profile and can be used by providers for customization.

### Programmatic Profile Management

The profile management system can be used programmatically in your own code:

```javascript
const profileManager = require('./services/profile.manager');

// Create a profile
const partition = profileManager.createProfile('WhatsApp', 'custom', { theme: 'dark' });

// Get a profile
const profile = profileManager.getProfile('WhatsApp', 'custom');

// Get all profiles
const allProfiles = profileManager.getAllProfiles();

// Delete a profile
profileManager.deleteProfile('WhatsApp', 'custom');
```

## Troubleshooting

### Profile Not Found

If you get an error that a profile doesn't exist, make sure you've created it first:

```bash
combo-desktop --profiles create --provider WhatsApp --name work
```

### Profile Already Exists

If you get an error that a profile already exists, you can delete it first:

```bash
combo-desktop --profiles delete --provider WhatsApp --name work
```

### Profile Data Corruption

If a profile's data becomes corrupted, you can delete and recreate it:

```bash
combo-desktop --profiles delete --provider WhatsApp --name work
combo-desktop --profiles create --provider WhatsApp --name work
```

### Viewing Profile Data

Profile data is stored in the Electron session partition. You can view it using the Chrome DevTools in the application (press F12 to open).
