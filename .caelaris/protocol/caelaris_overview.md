# Caelaris Protocol Overview

This document provides a summary of the Caelaris Protocol, a ruleset for task execution, planning, state management, and directive enforcement.

## Key Aspects:

*   **Activation**: Triggered by specific keywords, file presence, metadata, or workflow invocation.
*   **Directory Structure**: Mandates a specific folder structure (`.caelaris/requests/request-{timestamp}/`) with subfolders for state, logs, plans, outputs, and errors.
*   **Request Model**: Defines a JSON-based model for requests, including metadata, context, instructions, priorities, and directives.
*   **Directives**: Categorized as REQUIRED, PREFERRED, PROHIBITED, and CONDITIONAL, with a defined priority order.
*   **Variables**: Tasks declare variable usage (`uses`, `produces`) and adhere to write modes and flags.
*   **Task Lifecycle**: Tasks progress through `queued` → `next` → `current` → `completed` states.
*   **Planning Mode**: A special Caelaris request type (`meta.type = "planning"`) with specific output structures.
*   **Logging**: Detailed logging format for task execution.
*   **Snapshots**: State snapshots are taken after task completion, errors, or recovery.
*   **Validation**: Structure and schema validation at various stages.
*   **Error Handling**: Defined error logging and recovery procedures.
*   **Protocol Generation**: If `.caelaris/protocol` is missing, it must be generated from `core_bundle.md`.
*   **Lifecycle Events**: Specific actions are required at the start and end of requests, tasks, and task chunks.
*   **Self-Review**: Mandatory self-review under uncertainty, with user notification.

This overview is based on the provided `caelaris.md` document.
