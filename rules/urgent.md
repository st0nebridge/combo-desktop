# URGENT RULES
- User agent strings must be sourced from user-agent.config.js and never hardcoded in provider implementations
- All errors must be logged using logging service with appropriate severity levels
- Web security and context isolation must be enabled for all webviews
- Maintain inheritance structure by implementing functionality in base classes (BaseProvider, BaseCLI) rather than refactoring into modules, unless explicitly directed to update base classes
- Respect code structure and favor logic defined in JSDoc descriptions regarding function behavior, implementations should attempt to iteratively expand functionality, rather than major refactoring
- Functional code changes should be reflected in JSDoc descriptions where summary is no longer accurate
- Check for services that may offer functionality before refactoring or creating new implementations