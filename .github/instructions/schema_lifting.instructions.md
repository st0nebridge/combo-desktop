---
trigger: manual
description: Use SLP when optimizing large data models or outputs - Break down monolithic schemas into manageable components
---

# Schema Lifting Protocol (SLP)

## Core Concepts

Schema Lifting is an architectural pattern that externalizes nested data structures to higher-level representations, typically at the filesystem layer. This protocol defines standard methods for implementing schema lifting across various applications.

### Key Terminology

- **Schema Lifting**: The act of elevating parts of a nested structure into higher-level or external representations.
- **Structural Hoisting**: Promoting inner structures to a higher-level scope or domain.
- **Filesystem Projection**: Mapping in-memory structures to filesystem paths and artifacts.
- **Schema Altitude**: The level of abstraction at which a schema operates (in-memory, file, directory).
- **Top-Level Fragmentation**: Splitting root-level schema components into independent artifacts.

## Protocol Objectives

1. **Modularize Complex Schemas**: Break down monolithic schemas into manageable components
2. **Enable Independent Versioning**: Allow components to evolve at different rates
3. **Facilitate CLI Manipulation**: Support command-line operations on schema components
4. **Improve State Management**: Simplify state tracking and persistence
5. **Enhance System Resilience**: Reduce the impact of schema changes on the overall system

## Implementation Requirements

### 1. Schema Decomposition

The protocol requires decomposing complex schemas into discrete components:

```
# Original Monolithic Schema
{
  "request": { ... },
  "tasks": { ... },
  "variables": { ... },
  "output": { ... }
}

# Schema-Lifted Components
request.json    # Contains only the "request" object
tasks.json      # Contains only the "tasks" object
variables.json  # Contains only the "variables" object
output.json     # Contains only the "output" object
```

All schema components MUST be valid JSON documents independently.

### 2. Reference Resolution

Schema-lifted components MUST implement one of these reference mechanisms:

#### A. Explicit References

```json
// tasks.json
{
  "tasks": {
    "references": {
      "request": "./request.json",
      "variables": "./variables.json"
    },
    "data": { ... }
  }
}
```

#### B. URI References

```json
// tasks.json
{
  "tasks": {
    "data": {
      "uses": ["uri:variables#app_config", "uri:request#context"]
    }
  }
}
```

#### C. Implicit Convention

Follow strict naming and location conventions, allowing systems to resolve references implicitly.

### 3. Filesystem Structure

Schema-lifted components MUST be organized according to one of these patterns:

#### A. Flat Structure

```
request_model/
├── request.json
├── tasks.json
├── variables.json
└── output.json
```

#### B. Hierarchical Structure

```
request_model/
├── request/
│   └── data.json
├── tasks/
│   ├── index.json
│   ├── task_001.json
│   └── task_002.json
├── variables/
│   └── data.json
└── output/
    └── data.json
```

#### C. State-Based Structure

```
request_model/
├── request.json
├── tasks/
│   ├── pending/
│   │   └── task_001.json
│   ├── in_progress/
│   │   └── task_002.json
│   └── completed/
│       └── task_003.json
├── variables.json
└── output.json
```

### 4. State Management

Schema-lifted components MUST implement state management through one of these methods:

#### A. File Operations

State changes are reflected through filesystem operations:

```bash
# Change task state from pending to in-progress
mv tasks/pending/task_001.json tasks/in_progress/
```

#### B. Content Updates

State changes are reflected through content updates:

```bash
# Update task status
jq '.status = "in_progress"' tasks/task_001.json > tasks/task_001.json.tmp && mv tasks/task_001.json.tmp tasks/task_001.json
```

#### C. Hybrid Approach

Combine file operations and content updates based on the specific state change.

### 5. Consistency Management

Schema-lifted components MUST maintain consistency through one of these mechanisms:

#### A. Transaction Log

```
request_model/
├── ...
└── transactions/
    ├── 001_create_task.json
    ├── 002_update_variable.json
    └── 003_complete_task.json
```

#### B. Version Control

```
request_model/
├── ...
└── versions/
    ├── v001/
    │   ├── request.json
    │   └── ...
    └── v002/
        ├── request.json
        └── ...
```

#### C. Checkpoints

```
request_model/
├── ...
└── checkpoints/
    ├── checkpoint_2023-01-01T12-00-00/
    │   ├── request.json
    │   └── ...
    └── checkpoint_2023-01-01T13-00-00/
        ├── request.json
        └── ...
```

## Implementation Patterns

### Pattern 1: Request Model Decomposition

This pattern applies schema lifting to complex request models:

1. Create a directory for the request model
2. Extract each top-level component to its own file
3. Implement reference resolution between components
4. Define operations that maintain consistency

Example implementation:

```
request-20250531-002553/
├── request.json     # Contains meta, context, instructions, etc.
├── tasks.json       # Contains task definitions and relationships
├── variables.json   # Contains variable definitions and values
└── output.json      # Contains output specifications
```

### Pattern 2: Task State Externalization

This pattern applies schema lifting to task management:

1. Create a directory structure for task states
2. Map each task to an individual file
3. Use filesystem operations to manage state
4. Maintain task relationships through references

Example implementation:

```
tasks/
├── pending/
│   ├── task_001.json
│   └── task_002.json
├── in_progress/
│   └── task_003.json
└── completed/
    ├── task_004.json
    └── task_005.json
```

### Pattern 3: Incremental Schema Extension

This pattern supports extending schemas over time:

1. Start with core schema components
2. Add extension components as needed
3. Implement version management for each component
4. Use references to maintain relationships

Example implementation:

```
schema/
├── core/
│   ├── request.schema.json
│   └── tasks.schema.json
└── extensions/
    ├── metrics.schema.json
    └── reporting.schema.json
```

## Validation Requirements

### Schema Validation

All schema-lifted components MUST be validated against their schemas:

```bash
# Validate a task file
jsonschema -i tasks/task_001.json schemas/task.schema.json
```

### Consistency Validation

The overall system MUST validate consistency across components:

```bash
# Validate references between components
schema-validator --check-references request_model/
```

### Operation Validation

All operations on schema-lifted components MUST maintain validity:

```bash
# Validate an operation before executing
schema-validator --pre-operation "mv tasks/pending/task_001.json tasks/in_progress/"
```

## CLI Integration

The protocol recommends implementing CLI commands for manipulating schema-lifted components:

```bash
# Create a new task
schema-cli create task --name "Example Task" --output tasks/pending/task_001.json

# Update a task's status
schema-cli update task tasks/pending/task_001.json --set status=in_progress

# Move a task to a new state
schema-cli move task tasks/pending/task_001.json --to in_progress
```

## Benefits of Implementation

1. **Reduced Complexity**: Each component is simpler and more focused
2. **Enhanced Modularity**: Components can be developed and tested independently
3. **Improved Tooling**: Standard tools can operate on individual components
4. **Better Performance**: Components can be loaded and processed independently
5. **Simplified State Management**: State changes are more explicit and trackable

## Compliance Levels

### Level 1: Basic Compliance

- Schema decomposition into separate files
- Simple reference mechanism
- Basic consistency checks

### Level 2: Standard Compliance

- Hierarchical structure
- Explicit reference resolution
- Transaction logging
- CLI tool integration

### Level 3: Advanced Compliance

- State-based structure
- Version control integration
- Automated consistency management
- Comprehensive validation
- Full CLI manipulation support
