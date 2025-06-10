# 📐 Modular Structure Protocol (MSP)

## 🎯 Purpose

A comprehensive protocol for enforcing modularity across different content types (code, documentation, configurations) to simplify generation, maintenance, and understanding of complex systems.

## 🧱 Core Principles

1. **Atomic Responsibility**: Each module must have a single, well-defined purpose
2. **Hierarchical Organization**: Content must follow a clear nested structure
3. **Self-Documentation**: Modules must describe their own purpose and interfaces
4. **Composition Over Inheritance**: Prefer combining small modules over large monolithic ones
5. **Explicit Dependencies**: All dependencies must be clearly declared

---

## 📁 Directory Structure (Convention)

```
root/
├── index.{ext}                # Main entry point
├── modules/                   # Core functionality modules
│   ├── moduleA.{ext}          # Single-file module
│   └── moduleB/               # Complex module
│       ├── index.{ext}        # Module entry point
│       └── components/        # Sub-components
│           └── component1.{ext}
├── shared/                    # Shared utilities
│   └── helpers.{ext}
└── docs/                      # Documentation
    └── README.md
```

> `.{ext}` may be any supported language (e.g. `.js`, `.py`, `.md`, etc.)

---

## 🧠 Execution Rules

1. **Entrypoint Required**: The root `index.{ext}` must exist. It is responsible for routing or aggregating logic.
2. **Autoload Module Pattern**:
   * Any file under `modules/` is considered a valid submodule.
   * Folders with `index.{ext}` are recursively resolved.
3. **Self-Naming**:
   * Each module declares its own name via file/folder structure, not internal variables.
4. **Dynamic Invocation**:
   * Invocation follows this pattern:

```bash
./index [module] [submodule] ... [args]
```

---

## 🧬 Generation Protocol for LLMs

During generation:

1. **Plan Before Generating**:
   * Identify the core modules needed
   * Map dependencies between modules
   * Define clear interfaces between components

2. **Generate in Dependency Order**:
   * Start with lowest-level modules
   * Create shared utilities before dependent modules
   * Build entry points last

3. **For Each Module**:
   * Begin with standardized header comment/block
   * Define interface before implementation
   * Include validation for inputs
   * Document any side effects

---

## 🧪 Verification Rules

Before saving or executing generated output:

* [ ] Does the module name clearly reflect its purpose?
* [ ] Is the responsibility singular and well-defined?
* [ ] Are all dependencies explicitly declared?
* [ ] Does the interface follow consistent patterns?
* [ ] Is the module independently testable?
* [ ] Are inputs properly validated?
* [ ] Is the module's place in the hierarchy clear?

---

## 📝 Module Header Template

```
/**
 * @module {ModuleName}
 * @description Single-sentence description of purpose
 * 
 * @input {InputType} - Description of expected input
 * @output {OutputType} - Description of produced output
 * @dependencies - List of other modules required
 * 
 * @example
 * // Simple usage example
 */
```

---

## 🔁 Output Patterns

* **Single-file modules** go in `modules/`
* **Complex modules** go in `modules/<module>/index.{ext}` + submodules
* **Supporting files** go in `shared/` or `assets/`
* **Global orchestration** happens in `index.{ext}`
* **Documentation** goes in `docs/`

---

## 🔐 Optional Extensions

* `manifest.json` to declare module metadata
* `schema.json` to define input/output structure
* `README.md` inside each module folder
* `tests/` directory for module-specific tests
* `config/` directory for configuration files

---

## ✅ Minimal Example

```
myapp/
├── index.js                 # Dispatcher
├── modules/
│   ├── transform.js         # Transforms data format
│   └── validate/
│       ├── index.js         # Root validator
│       └── schema.js        # Schema validator
└── shared/
    └── utils.js
```

> Invocation: `node index.js validate schema data/input.json`

This protocol enforces modular, testable, scalable design with minimal ceremony.
