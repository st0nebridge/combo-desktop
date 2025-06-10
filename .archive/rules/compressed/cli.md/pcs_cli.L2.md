<!-- filepath: m:\Dev\Tools\combo-desktop\rules\compressed\cli.md\pcs_cli.L2.md -->
# PCS L2: CLI Framework Operations Reference

**📊 Compression Metadata:**
- Level: L2 (Operational Reference)
- Source: `../cli.md`
- Timestamp: 2025-06-10
- Token Reduction: ~75%
- Preservation: Core requirements (100%), structure (100%), critical examples (25%)

**🔗 Navigation:** [Source](../cli.md) | [L1 Guide](./pcs_cli.L1.md)

## 🎯 CORE PRINCIPLES
- **Responsibility:** Each module owns commands/flags/parsing/execution/registration
- **Centralization:** BaseCLI provides utilities, registry, validation, standard results
- **Abstraction:** BaseCLI = abstract only (no hardcoded config/flags/business logic)
- **Auto-Registration:** index.js discovers all, excludes BaseCLI, no manual registration

## 🏗️ STRUCTURE
### BaseCLI Abstract
```javascript
constructor() parseArgs() isCliCommand() execute() showUsage()        // Abstract
validateFilePath() getBaseResultObject() parseCommonFlags()          // Utilities
```

### Module Requirements
- ✅ Extend BaseCLI + implement ALL abstracts
- ✅ Define `moduleFlags` in constructor
- ✅ Use command binding: `this.commands = { 'cmd': this.handler.bind(this) }`
- ✅ JSDoc all methods

## 🔧 PATTERNS
### Flag Parsing
- Use `getBaseResultObject()` → `parseCommonFlags(result, index)`
- Return `null` if no relevant flags
- Validate required args + use `validateFilePath()`

### Command Execution
```javascript
// parseArgs(): if (this.commands[sub]) result.command = sub;
// execute(): if (args.command && this.commands[args.command]) this.commands[args.command](...);
```

## 📁 ORGANIZATION
- **Location:** `src/cli/modules/*-cli.js`
- **Export:** Class definition only
- **Instantiation:** index.js only

## 🚀 REGISTRATION
Auto-discovery: `modules/` → filter `*-cli.js` → exclude BaseCLI → instantiate + register

**⚠️ Preservation Statement:**
All operational requirements and patterns preserved. Implementation details reduced for quick reference.
