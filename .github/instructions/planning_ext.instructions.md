---
trigger: always_on
---

# Caelaris Protocol - Planning Mode (Extended)

These rules MUST be enforced when operating in planning mode.

## Request Model Validation Requirements

The agent MUST validate that the implementation request model contains:

### Complete Task Coverage

- EVERY task from EVERY milestone MUST be represented in the task queue
- NO milestone may be omitted from the implementation plan
- Each milestone's tasks MUST maintain their defined dependencies

### Milestone Mapping Verification

- The agent MUST verify a 1:1 mapping between:
  - Milestone documents and milestone entries in the model
  - Deliverable tasks in milestone documents and task entries in the queue
- Any missing mappings MUST trigger a validation error

### Task Queue Inspection

- The agent MUST inspect the `queued` array to confirm it contains tasks for ALL milestones
- Tasks MAY be marked as `blocked` if they depend on earlier tasks, but MUST be present
- Initial status values MAY vary (queued, blocked, pending), but ALL tasks MUST exist

### Validation Reporting

- Before finalizing the request model, the agent MUST produce a validation report showing:
  - Total milestone count vs. represented milestone count
  - Total task count vs. represented task count
  - Coverage percentage for both metrics
- The validation report MUST be logged to execution_log.md

## Task Queue Generation Protocol

When generating the implementation request model's task queue, the agent MUST:

### Process ALL Milestones

- Iterate through EVERY milestone document
- Extract ALL tasks from EVERY deliverable
- Generate task entries for EACH extracted task

### Preserve Dependency Structure

- Maintain the correct `dependencies` relationships between tasks
- Convert document dependencies (e.g., "Task depends on 1.2, 1.3") into task ID references
- Create a complete dependency graph for validation

### Set Initial Task Status

- Tasks with no dependencies: status = "queued"
- Tasks with unsatisfied dependencies: status = "blocked" 
- Include `blockedBy` array listing dependency IDs

### Generate Consistent Task IDs

- Format: i{XXX} where XXX is sequential number
- Maintain clear mapping to milestone.task notation (e.g., i001 → 1.1)
- Document the ID mapping in task metadata

# Implementation Plan Template

The implementation request model MUST follow this template structure:

```json
{
  "request": {
    "meta": {},
    "context": {},
    "instructions": [],
    "priorities": [],
    "directives": {}
  },
  "tasks": {
    "current": {},
    "next": {},
    "queued": [
      // MUST contain entries for ALL tasks from ALL milestones
    ],
    "completed": [],
    "context": {
      "milestones": [
        // MUST contain entries for ALL milestones
      ],
      "taskMapping": {
        // MUST document mapping between task IDs and milestone.task notation
        "i001": "1.1",
        "i002": "1.2",
        // etc. for ALL tasks
      }
    }
  }
}
```

## Template Requirements

- The `queued` array MUST contain ALL tasks from ALL milestones
- Each task MUST include all required metadata (id, label, milestone, task_id, uses, produces)
- The `milestones` array MUST contain ALL milestones from the planning documents
- The `taskMapping` object MUST document the mapping between task IDs and milestone notation
- All cross-references between tasks MUST use consistent ID formats

## Structural Validation

The agent MUST validate that:
- All required keys exist in the template
- All tasks have the necessary attributes
- All references use proper formats and point to valid resources
- No required elements are missing from the structure

# Self-Verification Phase Requirements

Before finalizing the planning process, the agent MUST:

## Implementation Path Analysis

- Trace the execution path through ALL tasks
- Verify that ALL milestones can be reached
- Confirm that ALL deliverables have corresponding tasks

## Generate Task Statistics

- Count total number of tasks by milestone
- Verify that these counts match the milestone documents
- Log any discrepancies for review

## Validate Cross-Milestone Dependencies

- Verify that dependencies across milestones are properly represented
- Confirm that no circular dependencies exist
- Validate that dependency chains form a complete directed acyclic graph

## Produce Implementation Readiness Report

- Summarize total implementation scope
- List all milestones and task counts
- Confirm complete coverage of the planning documents
- Log the report to task_outputs/{task_id}.md