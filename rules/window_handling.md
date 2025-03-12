# Window Handling Rules

## Window Creation
1. All windows MUST be created through `WindowService.createWindow()`
2. Every window MUST have a unique `windowName` identifier
3. Window configurations MUST include:
   ```js
   {
     webPreferences: {
       contextIsolation: true,
       webSecurity: true
     }
   }
   ```

## Window Security
1. Context isolation MUST be enabled for all windows
2. Web security MUST be enabled for all windows
3. Remote content loading MUST be disabled by default

## Window Lifecycle
1. Windows SHOULD be hidden instead of closed by default
2. Force close MUST be explicitly set via `forceClose` flag
3. All window cleanup MUST happen during the close event
4. Provider sessions MUST be unregistered before window destruction

## Window State Management
1. Use `WindowService.resolveWindow()` for window operations
2. Track window state using the internal `windows` Map
3. Always check `isDestroyed()` before window operations
4. Handle the `ready-to-show` event before displaying windows

## Error Handling
1. All window operations MUST use try-catch blocks
2. Use log service for error logging with appropriate severity
3. Failed window creation MUST NOT crash the application

## Application Quit Behavior
1. Set `isQuitting` flag before force closing all windows
2. Cleanup all provider sessions before application quit
3. Last window closure SHOULD trigger application quit

## Memory Management
1. Remove window references from `windows` Map after closure
2. Clear all event listeners during window cleanup
3. Ensure proper garbage collection of closed windows
