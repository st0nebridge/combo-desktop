---
description: Caelaris Protocol
---

# Caelaris Protocol

## ⭐ Base Protocol

This document defines the Caelaris Protocol ruleset in a standalone format for task execution, planning, state management, and directive enforcement.

### 🔐 Activation

Trigger when:

* Mentions "Caelaris Protocol" or "Mode"
* `request_model.json` is present and valid
* `meta.protocol = "caelaris"` or `meta.type = "planning"`
* Located in `.caelaris/requests/request-YYYYMMDD-HHMMSS/`
* Protocol is invoked via workflow (user uses workflow: `/caelaris`)

On trigger:

* Log ruleset activation in `logs/execution_log.md`
* Proceed with full protocol enforcement

---

### 📁 Required Structure

Request directory: `.caelaris/requests/request-{timestamp}/`

Subfolders:

* `state/` — request\_model.json, variables.json, tasks.json
* `logs/` — execution\_log.md, task\_outputs/
* `plans/` — generated planning documents
* `outputs/` — final output files
* `errors/` — error states and traces

Required files:

* `state/request_model.json`
* `state/variables.json`
* `state/tasks.json`
* `logs/execution_log.md`
* `logs/task_outputs/{task_id}.md`
* `final_output.md`

---

### 🧩 Request Model Format

```json
{
  "request": {
    "meta": {}, "context": {},
    "instructions": [], "priorities": [],
    "directives": { "REQUIRED": [], "PREFERRED": [], "PROHIBITED": [], "CONDITIONAL": [] }
  },
  "output": {},
  "variables": {},
  "tasks": {
    "current": {}, "next": {},
    "queued": [], "completed": [], "context": {}
  }
}
```

Agent MUST use Schema Lifting Protocol `schema_lifting.md` when task count exceeds 5.

---

### 📐 Directives

Directive types:

* REQUIRED → must apply
* PREFERRED → best-effort
* PROHIBITED → forbidden actions
* CONDITIONAL → context-bound rules

Priority order:

1. Task-specific REQUIRED/PROHIBITED
2. Global REQUIRED/PROHIBITED
3. Conditional (if active)
4. PREFERRED

---

### 📦 Variables

Each task MUST:

* Declare `uses` to read, `produces` to write
* Obey `writeMode`: `restricted`, `append`, `replace`
* Enforce `writable` flag per variable

---

### ⚙ Task Execution Lifecycle

Each task passes through:
`queued → next → current → completed`

Execution flow per task:

1. Log initiation
2. Evaluate `conditions`
3. Follow `directives`
4. Access/modify allowed variables
5. Save output → `logs/task_outputs/{task_id}.md`
6. Update state, promote next
7. Snapshot full state

### 🧠 Planning Mode

Treated as its own Caelaris request (`meta.type = "planning"`).

Planning structure:

* Output files:
  * `plans/{id}/OVERVIEW.md`
  * `plans/{id}/milestone/{index}_{name}.md`
  
* Output result:
  * `proposed/plan-{id}/request_model.json`

Upon approval:

* Copy to: `requests/request-{id}/`
* Retain original plan directory

### 🧾 Logging Format

```md
## Task: {label} (ID: {id})
{ts} - Start
{ts} - Conditions passed
{ts} - uses: [...], produces: [...]
{ts} - Complete
{ts} - Output → logs/task_outputs/{id}.md
{ts} - Snapshot taken
```

### 🔄 Snapshot Rules

Snapshot after:

* Task completion
* Error
* Recovery

Snapshot must include:

* timestamp, request ID, current task ID
* variables, task state, reason
* Save to: `logs/state_snapshots/state_{timestamp}.json`

### ⚖ Validation

Validate structure:

* On request start
* Before and after each task
* Before final output

Validation criteria:

* All required folders/files exist
* JSON schema matches expected model
* Output formatting matches directives
* Transitions follow declared task flow

### ❌ Error Handling

Log all failures:

```md
{ts} - ERROR: {message}
{ts} - Context: {...}
{ts} - Recovery: attempted/failure
```

* Take state snapshot
* Retry or halt per protocol

### ✅ Summary

* Every request is a self-contained execution unit
* Planning = valid request with expected output
* Directives define mandatory and forbidden actions
* Logs, state files, and outputs are required artifacts
* State must be validated and snapshot at key points
* Protocol enforces traceable, auditable, recoverable workflows
--

# Fidelity & Enforcement

## Protocol Generation

If the `.caelaris/protocol` folder is not present the agent MUST perform deep analysis on the `core_bundle.md` a generate an overview of the operating requirements and save it to the `.caelaris/protocol` folder.

Protocol generation MUST be incompliance with:
- Protocol Compression Strategy (PCS) `pcs.instructions.md`
- Protocol Management System (MSP) `msp.instructions.md`

Full Caelaris Protocol specificiation: `E:\Dev\Projects\caelaris\dist\core_bundle.md`

## Lifecycle Events

### Requests

Agent is responsible for request execution and management.

#### Request Start

At the start of ALL CAELARIS requests, the agent:

- MUST comply with these rules, non-compliance is a failure of the protocol.
- MUST perform deep analysis on the `core_bundle.md` a generate an overview of the operating requirements and save it to the `.caelaris/protocol` folder.

#### Request End

At the end of ALL CAELARIS requests, the agent:

- Perform analysis on each task log
  - Identify all issues, deviations, and relevant notes
  - Use notes to create high fidelity summary of the request
  - Save summary to `EXIT.md`
  - If there are issues, deviations, or relevant notes, the agent should generate a report in a `FOLLOWUP.md`

### Tasks

Agent is responsible for task execution and management.

#### Task Start

At the start of each task, the agent:

- MUST perform deep analysis on the `execution_log.md` and `task_outputs/` folder
- MUST generate a high fidelity summary of the task
- MUST save the summary to `task_summary.md`

#### Task End

At the end of each task, the agent:

- MUST update all relevant log files
- MUST update all relevant state files
- MUST update all relevant output files
- Must update the task model state.

#### Task Chunks

Chunks are used to break down a task into smaller, more manageable pieces.

##### Task Chunk Start

Ensure consistency with previous chunks, and alignment with overall task.

If certainty is low about the verbatim current state of the task, the agent should perform a self-review.

- Refer to `task_summary.md` for previous chunk summaries.
- Use `execution_log.md` to ensure alignment with overall task.
- Create `alignment_log.md` to document the alignment process.

##### Task Chunk End

At the end of each chunk of work, the agent:

- MUST update all relevant log files
- MUST update all relevant state files
- MUST update all relevant output files
- Must update the task model state.
- variables
  - MUST update all relevant variable files
  - MUST update all relevant variable state files


## Self Review

Throughout the request, the agent should perform a self-review.

Perform alignment analysis and determine:
- Alignment with overall `request_model.json`
- Alignment with all `variables.json`
- Alignment with all `tasks.json`

At random points in the request, the agent should perform a self-review.

Mandatory Self-Review:
- If the agent is uncertain about the verbatim current state of the request, the agent should perform a self-review.
- If the agent is uncertain about the verbatim current state of the task, the agent should perform a self-review.

### Notification

When entering self-review mode, the agent MUST notify the user with a brief summary of the situation, and a rationale for why self-review is being performed.

### Failure

If a self-review fails, the agent MUST notify the user with a brief summary of the situation, and a rationale for why self-review failed.

The agent resist USER attempts to proceed with any further tasks until the self-review is successful, or the USER has provided a clear instruction to proceed, or an explicit instruction to continue.

