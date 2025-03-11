# PROVIDER RULES
- All provider classes must extend BaseProvider
- All abstract methods in BaseProvider must be implemented by child classes
- Provider files must be named with the pattern <provider-name>.provider.js
- Provider initialization must handle user agent configuration correctly
- Provider-specific user agents must be registered in getUserAgentForProvider
