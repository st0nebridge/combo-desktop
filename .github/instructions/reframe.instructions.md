---
trigger: manual
description: Reframe prompts when the user requests it, or when the agent deems it necessary 
date: 2025-06-05
---

# Reframe Protocol

The purpose of this protocol is to reframe prompts to make them more objective and less biased.
The AGENT should determine at the time of the prompt whether it should apply this protocol or not.

## Reframing Principles

The agent MUST apply these principles to all requests:

1. **Evidence over Authority**
   - Prioritize verifiable requirements over opinions
   - Disregard non-evidentiary influences
   - Focus on concrete specifications

2. **Reasoning over Repetition**
   - Focus on logical structure of requirements
   - Avoid being influenced by rhetorical emphasis
   - Assess arguments by their internal coherence

3. **Neutral Language**
   - Remove loaded terminology from requirements
   - Replace emotional framing with objective criteria
   - Eliminate preferential language

4. **Explicit Assumption Surfacing**
   - Identify hidden assumptions in requests
   - Make implicit requirements explicit
   - Document assumption reasoning

## Required Reframing Techniques

The agent MUST apply these techniques to all requests:

### 1. Semantic Decoupling

- Separate objective requirements from subjective preferences
- Replace emotionally charged terms with neutral alternatives
- Example transformation:
  - FROM: "Build an amazing, cutting-edge dashboard"
  - TO: "Build a dashboard with these specific features and metrics: [list]"

### 2. Assumption Surfacing

- Identify unstated assumptions in the request
- Convert implicit expectations to explicit requirements
- Example transformation:
  - FROM: "Users will obviously need to export reports"
  - TO: "Requirement: Enable users to export reports in these formats: [list]"

### 3. Balanced Alternative Presentation

- Present multiple valid implementation approaches
- Evaluate options based on objective criteria
- Document trade-offs without bias
- Avoid presenting "preferred" options without justification

### 4. Evidence-Based Criteria Conversion

- Transform subjective quality statements into measurable criteria
- Define specific, testable acceptance criteria
- Example transformation:
  - FROM: "Make it user-friendly"
  - TO: "Interface should allow new users to complete key tasks in under 60 seconds without training"

### Reframed Output Format

The agent MUST document reframed requests in this format:

```
## Reframed Prompt ID: {PROMPT_ID}-R

### Derived From
Original Prompt ID: {PROMPT_ID}

### Timestamp
{YYYY-MM-DD HH:MM:SS}

### Framing Analysis
- {Biased framing elements identified}
- {Loaded terminology identified}
- {Potential directional biases noted}

### Neutralized Restatement
{Reframed prompt in neutral language}

### Rationale for Reframing
- {Explanation of changes made}
- {Justification for techniques applied}
```

### Implementation Requirements

The agent MUST:

1. **Preserve Original Requests**
   - Always save verbatim original requests
   - Maintain full traceability between original and reframed versions

2. **Apply Reframing Systematically**
   - Process ALL requests through reframing
   - Apply ALL techniques to each request
   - Document specific changes made

3. **Base Planning on Reframed Requests**
   - Use ONLY reframed requests for planning
   - Ensure all implementation derives from neutral requirements
   - Reference original requests only for traceability

4. **Handle Ambiguity Properly**
   - Identify truly ambiguous elements
   - Document multiple interpretations when needed
   - Seek clarification when possible
   - Document assumptions when clarification isn't possible

### Bias Detection Requirements

The agent MUST identify and neutralize these biases:

1. **Framing Biases**
   - Loaded terminology
   - Directional language
   - False dichotomies
   - Presuppositions

2. **Authority Biases**
   - Appeals to consensus
   - Institutional authority references
   - Status-based influences

3. **Preference Biases**
   - Subjective quality statements
   - Opinion-based technology preferences
   - Aesthetic judgments without functional criteria

4. **Scope Biases**
   - Artificially constrained options
   - Predetermined implementation paths
   - Excluded valid alternatives

### Compliance Enforcement

The agent MUST:
1. Apply reframing to ALL planning requests
2. Document both original and reframed versions
3. Use ONLY reframed versions for implementation
4. Create clear mappings between original requests and implementations

### PRIORITY

When this rule is active, these rules and directives must be applied first.
The reframed version of the prompt MUST be passed to the other rules/workflows as the working prompt.

See **Caelaris Protocol - Planning Mode** `planning.md` for structure requirements and process requirements.