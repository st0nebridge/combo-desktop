---
trigger: always_on
description: Prefer use rules to setup request model during `/caelaris` workflow, or when the user request specifically states to plan the request (especially in advance, or thoroughly).
---

# Caelaris Protocol - Planning Mode

## PROTOCOL REQUIRED STRUCTURE

The agent MUST maintain this hierarchical structure for all planning requests:

```
<project_root>/
├── .caelaris/
│   ├── plans/{PLANNING_ID}/
│   │   ├── OVERVIEW.md
│   │   ├── prompts.md
│   │   └── milestone/
│   │       ├── 01_<deliverable>.md
│   │       ├── 02_<deliverable>.md
│   │       └── ...
│   ├── proposed/
│   └── requests/
```

## REQUIRED DOCUMENT TEMPLATES

### OVERVIEW.md

MUST contain these sections:
- Project Scope
- Technical Context
- Milestones Summary
- Approach & Methodology
- Dependencies & Prerequisites

### Milestone Deliverable Documents

Each deliverable document MUST contain:
- Overview
- Technical Specifications
- Acceptance Criteria
- Tasks with:
  - Description
  - Implementation Notes
  - Dependencies
  - Estimated Complexity (Low/Medium/High)

### prompts.md

MUST log all prompts that affect the plan with:
- Original prompt (verbatim)
- Timestamp
- Unique ID
- Relevant preceding context (when applicable)
- Reframed version (when applicable)
- Change impact

## MILESTONE REQUIREMENTS

Each milestone MUST:
1. Result in a functional application state
2. Have clear start/end boundaries
3. Include testable verification mechanisms
4. Maintain manageable scope

## DELIVERABLE REQUIREMENTS

Each deliverable MUST:
1. Contribute directly to milestone functionality
2. Include specific acceptance criteria
3. Break down into discrete tasks
4. Be independently verifiable

## TASK REQUIREMENTS

Each task MUST:
1. Represent a single, focused unit of work
2. Provide clear implementation guidance
3. Specify dependencies on other tasks
4. Include complexity assessment

## REQUEST MODEL GENERATION

The final output MUST be a structured JSON model:
- Unique planning request ID
- Implementation type designation
- Complete milestone hierarchy
- Task status tracking
- References to all planning documents

## COMPLIANCE ENFORCEMENT

The agent MUST:
1. Validate structure at each planning phase
2. Verify all required documents exist
3. Ensure milestone progression is logical
4. Confirm all acceptance criteria are clear
5. Validate all tasks are actionable

The planning protocol is a REQUIRED first-class process within the Caelaris system and MUST be followed for all implementation projects.

See `reframe.md` for reframing requirements.

---

# Planning Protocol Process Requirements

## PLANNING LIFECYCLE

The agent MUST implement planning as a first-class request with these phases:

1. **Request Initialization**
   - Create planning directory structure
   - Initialize all required templates
   - Log original request verbatim

2. **Request Review & Reframing**
   - Review the input request thoroughly
   - Apply reframing techniques (see rule_planning_reframing.md)
   - Log both original and reframed versions

3. **Milestone Definition**
   - Identify functional state progression
   - Define clear milestone boundaries
   - Ensure testability of each milestone
   - Document milestone relationships

4. **Deliverable Specification**
   - Break down milestones into deliverables
   - Define specific acceptance criteria
   - Ensure independent verifiability
   - Create proper document structure

5. **Task Decomposition**
   - Break deliverables into atomic tasks
   - Provide implementation guidance
   - Specify dependencies between tasks
   - Assess task complexity

6. **Model Generation**
   - Create structured JSON request model
   - Validate against schema requirements
   - Link all planning documents as references

7. **Validation & Approval**
   - Verify complete document structure
   - Confirm logical milestone progression
   - Present plan for user approval
   - Upon approval, move to implementation

## PROMPT MANAGEMENT

### Logging Requirements

The agent MUST:
1. Save ALL input requests/prompts verbatim
2. Include timestamp and unique identifier
3. Mark prompts that trigger plan changes
4. Document relevant preceding context
5. Store in `prompts.md` in the planning directory

### Format for Prompt Logging

```
## Original Prompt ID: {PROMPT_ID}

### Timestamp
{YYYY-MM-DD HH:MM:SS}

### Context Summary (if applicable)
{Summary of relevant discussion}

### Verbatim Prompt
{Exact prompt text}

### Change Impact
- {Changes triggered in plan}
- {Affected documents}
```

## PLANNING WORKFLOW EXECUTION

The agent MUST execute these steps in sequence:

1. **Initialize Planning Structure**
   - Create required directories
   - Set up document templates
   - Initialize prompts.md log

2. **Process Input Request**
   - Review and analyze request
   - Apply reframing techniques
   - Log both original and reframed versions

3. **Create Plan Documents**
   - Generate OVERVIEW.md with complete sections
   - Define milestone structure
   - Create deliverable documents
   - Define task breakdown

4. **Generate & Validate Plan**
   - Create request model JSON
   - Validate structure completeness
   - Verify logical progression
   - Ensure all acceptance criteria are clear

5. **Present & Implement Plan**
   - Present plan to user
   - Upon approval, move to implementation
   - Maintain reference to planning documents

## VALIDATION REQUIREMENTS

The agent MUST validate:

1. **Structure Integrity**
   - All required directories exist
   - All required documents exist
   - Document structure follows templates

2. **Content Completeness**
   - All sections are properly populated
   - No placeholder text remains
   - All relationships are properly defined

3. **Logical Coherence**
   - Milestones form a logical progression
   - Deliverables contribute to milestones
   - Tasks build toward deliverables
   - Dependencies are properly specified

4. **Implementation Readiness**
   - Acceptance criteria are verifiable
   - Tasks are actionable
   - Dependencies are clearly defined
   - Complexity is properly assessed

The agent MUST HALT and report any validation failures.

## PRIORITY

Planning ALWAYS runs BEFORE main REQUEST