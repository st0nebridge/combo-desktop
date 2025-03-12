# URGENT RULES
- User agent strings must be sourced from user-agent.config.js and never hardcoded in provider implementations
- All errors must be logged using logging service with appropriate severity levels
- Web security and context isolation must be enabled for all webviews
- Maintain inheritance structure by implementing functionality in base classes (BaseProvider, BaseCLI) rather than refactoring into modules, unless explicitly directed to update base classes