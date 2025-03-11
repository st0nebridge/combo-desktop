# Tray Handling Rules

## Core Principles
1. All tray functionality must be managed through the TrayService
2. Support for multiple tray icons must be maintained
3. Window management must be handled via AppManager or WindowService only

## Base Provider Requirements
1. Context menu options must be defined in BaseProvider
    - Providers can override/extend menu options
    - Menu structure must be consistent across providers
2. Tray icon click handlers must be in BaseProvider
    - Double-click: Toggle window visibility
    - Single-click: Empty handler for provider override
    - Click handlers must use AppManager/WindowService for window operations

## Tray Service Responsibilities
1. Icon Management
    - Handle creation and cleanup of tray icons
    - Support multiple concurrent icons for different windows
    - Manage notification icon state
2. Context Menu
    - Build menus from provider-supplied templates
    - Update menu items dynamically when needed
3. Event Handling
    - Route click events to appropriate provider handlers
    - Manage notification state changes
4. Cleanup
    - Properly dispose of all tray icons
    - Clear event listeners
    - Reset internal state

## Implementation Guidelines
1. Use log service for error logging
2. Maintain separation between tray UI logic and window management
3. Follow cleanup chain:
    - AppManager cleanup calls TrayService cleanup
    - TrayService cleanup handles all tray-related disposal

## Error Handling
1. Log tray creation/destruction errors
2. Gracefully handle missing icons/resources
3. Recover from notification state errors
