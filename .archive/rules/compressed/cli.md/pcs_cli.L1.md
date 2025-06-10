<!-- filepath: m:\Dev\Tools\combo-desktop\rules\compressed\cli.md\pcs_cli.L1.md -->
# PCS L1: CLI Framework Implementation Guide

**📊 Compression Metadata:**
- Level: L1 (Implementation Guide)
- Source: `../cli.md`
- Timestamp: 2025-06-10
- Token Reduction: ~50%
- Preservation: Core requirements (100%), structure (100%), examples (70%), practices (85%)

**🔗 Navigation:** [Source](../cli.md) | [L2 Version](./pcs_cli.L2.md)

## 📋 TABLE OF CONTENTS
- [🎯 Core Principles](#-core-principles)
- [🏗️ Module Structure](#-module-structure)
- [🔧 Implementation Patterns](#-implementation-patterns)
- [📁 Organization Rules](#-organization-rules)
- [🚀 Registration Process](#-registration-process)

## 🎯 Core Principles

### 📋 Responsibility Principle
Each module handles:
- ✅ Own commands and flags definition
- ✅ Specific argument parsing (using base utilities)
- ✅ Execution logic
- ✅ Auto-registration with registry

### 🎯 Centralization Principle
BaseCLI provides:
- ✅ Common flag parsing utilities
- ✅ Registry integration
- ✅ Validation utilities
- ✅ Standard result object structure

### 🔒 Abstraction Principle
BaseCLI remains abstract:
- ❌ No specific configuration implementation
- ❌ No hardcoded flags or commands
- ❌ No business logic implementation
- ✅ Only abstract methods and utilities

### 🔄 Auto-Registration Principle
- ✅ index.js discovers and registers all modules
- ✅ Excludes BaseCLI from registration
- ❌ No manual registration in individual files
- ❌ No direct instantiation outside index.js

## 🏗️ Module Structure

### BaseCLI Abstract Class
```javascript
class BaseCLI {
  constructor()                    // Prevents direct instantiation
  parseArgs()                     // Abstract: Child implementation required
  isCliCommand()                  // Abstract: Child implementation required
  execute(args)                   // Abstract: Child implementation required
  showUsage()                     // Abstract: Child implementation required
  validateFilePath(path)          // Utility: File validation
  getBaseResultObject()           // Utility: Standard result structure
  parseCommonFlags(result, index) // Utility: Common flag parsing
}
```

### Module Implementation Requirements
- ✅ Class-based structure extending BaseCLI
- ✅ Implement ALL abstract methods
- ✅ Define module-specific flags in constructor
- ✅ JSDoc documentation for all methods

## 🔧 Implementation Patterns

### Command Function Binding
```javascript
class ExampleCLI extends BaseCLI {
  constructor() {
    super();
    this.moduleFlags = ['--example'];
    
    // Bind command functions
    this.commands = {
      'list': this.listItems.bind(this),
      'create': this.createItem.bind(this),
      'delete': this.deleteItem.bind(this)
    };
  }
}
```

### Command Map Usage
```javascript
// In parseArgs()
if (this.commands[subcommand]) {
  result.command = subcommand;
  // Parse additional args if needed
}

// In execute()
if (args.command && this.commands[args.command]) {
  this.commands[args.command](...commandArgs);
}
```

### Flag Parsing Rules
- ✅ Use `this.getBaseResultObject()` for standardized results
- ✅ Use `this.parseCommonFlags(result, index)` for common flags
- ✅ Return `null` from `parseArgs()` if no relevant flags
- ✅ Validate all required arguments
- ✅ Use `this.validateFilePath()` for file validation

## 📁 Organization Rules

### File Structure
- **Location:** `src/cli/modules/`
- **Naming:** `*-cli.js` suffix (e.g., `profile-cli.js`)
- **Export:** Class definition (not instance)
- **Instantiation:** Only in index.js

### Module Requirements
- ✅ Extend BaseCLI
- ✅ Implement abstract methods
- ✅ Self-contained functionality
- ✅ JSDoc documentation

## 🚀 Registration Process

### Automatic Discovery
```javascript
// src/cli/index.js
const fs = require('fs');
const path = require('path');

// Automatically register all CLI modules
const modulesDir = path.join(__dirname, 'modules');
const moduleFiles = fs.readdirSync(modulesDir)
  .filter(file => file.endsWith('-cli.js'));

moduleFiles.forEach(file => {
  const ModuleClass = require(path.join(modulesDir, file));
  if (ModuleClass.prototype instanceof BaseCLI) {
    registry.register(new ModuleClass());
  }
});
```

### Registration Requirements
- ✅ Auto-discovery of modules in `modules/` directory
- ✅ Filter for `-cli.js` files
- ✅ Exclude BaseCLI from registration
- ✅ Instantiate and register valid modules

**⚠️ Preservation Statement:**
All core principles, structure requirements, and implementation patterns preserved. Code examples condensed to essential patterns.
