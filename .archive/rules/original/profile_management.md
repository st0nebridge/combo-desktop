# PROFILE MANAGEMENT RULES
- Profiles are basically the name of the Electron session partition
- We build management around the session name, which is derived from `${app.getName()}:${providerName}:${profileName}`
- Profiles should be tracked using a simple JSON file: `profiles.json`
- Profile identifier must follow the pattern <provider>:<profile-name>
- Profile data must be isolated using Electron session partitioning

## Profile Management

### Default Profile

- Default profiles are those with the name "default"
- Default profiles are used when no other profile is specified

### Custom Profiles

- Custom profiles are those with a name other than "default"
- Custom profiles are used when a specific profile is specified

### Profile Options

- Profile options are passed to the provider
