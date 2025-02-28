# Changelog

All notable changes to Combo Desktop will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.4] - 2025-02-28

### Added
- Multi-profile support for both WhatsApp and Facebook Messenger
- CLI tools for managing profiles
- Improved documentation

### Changed
- Updated Electron to version 29.1.1
- Improved tray icon handling for dark mode
- Refactored provider system for better extensibility

### Fixed
- Fixed notification detection in WhatsApp provider
- Fixed window focus issues when clicking on tray icon
- Improved error handling for profile management

## [1.1.3] - 2025-01-15

### Added
- Dark mode support with automatic theme detection
- Improved logging with electron-log

### Changed
- Updated dependencies to latest versions
- Improved error handling and user feedback

### Fixed
- Fixed issue with WhatsApp Web not loading on some systems
- Fixed tray icon visibility on some Linux distributions

## [1.1.2] - 2024-12-10

### Added
- Support for system notifications
- Keyboard shortcut (Esc) to hide window to tray

### Changed
- Improved tray icon with notification indicators
- Better handling of window state

### Fixed
- Fixed memory leak when switching between services
- Fixed issue with Facebook login on some systems

## [1.1.1] - 2024-11-05

### Added
- System tray support
- Option to start minimized to tray

### Changed
- Improved startup performance
- Updated Electron to version 28

### Fixed
- Fixed issue with WhatsApp QR code scanning
- Fixed window positioning on multi-monitor setups

## [1.1.0] - 2024-10-01

### Added
- Facebook Messenger integration
- Command-line arguments for selecting service
- Cross-platform support improvements

### Changed
- Refactored codebase for better maintainability
- Updated dependencies

### Fixed
- Fixed various UI glitches
- Improved error handling

## [1.0.0] - 2024-09-01

### Added
- Initial release with WhatsApp Web integration
- Basic window management
- Cross-platform support (Windows, macOS, Linux)
