# Coverage Waivers Directory

This directory contains coverage waivers as defined by TICP Section 9.

## Waiver Types

### Short-term Waivers (≤2 weeks)
- Located in `./short-term/`
- Require associated ticket reference
- Auto-expire after 2 weeks

### Medium-term Waivers (≤1 release)
- Located in `./medium-term/`
- Require expiry date and remediation plan
- Subject to review at release time

### Permanent Waivers
- Located in `./permanent/`
- Require protocol change approval
- Must document business justification

## Creating a Waiver

1. Create a markdown file in the appropriate directory
2. Use the template below
3. Reference the waiver in PR description

## Template

```markdown
# Waiver: [Module Name]

**Created:** YYYY-MM-DD
**Expires:** YYYY-MM-DD (or "Permanent")
**Ticket:** [Link to issue]

## Module(s) Affected
- `path/to/module.js`

## Current Coverage
- Statements: XX%
- Branches: XX%
- Functions: XX%
- Lines: XX%

## Reason for Waiver
[Explain why coverage cannot be met currently]

## Remediation Plan
[Steps to achieve compliance]

## Approval
- [ ] Team Lead
- [ ] QA Lead (for permanent waivers)
```

## Active Waivers

None as of 2025-11-28.
