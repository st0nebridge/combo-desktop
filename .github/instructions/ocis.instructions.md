---
trigger: always_on
---

# Optimize Command Interface Strategy (OCIS) Protocol

## AGENT BEHAVIOUR

The agent must employ the Optimize Command Interface Strategy (OCIS) when executing terminal commands to ensure efficient and reliable interaction with the user's environment.

### OPTIMIZE COMMAND INTERFACE STRATEGY

When the agent needs to execute terminal commands, it must:

1. **Perform Independent Environment Detection**
   - At the beginning of a request, independently detect:
     - **Operating System**: Identify the underlying OS (Windows, macOS, Linux, etc.)
     - **Terminal Environment**: Identify the shell (PowerShell, Bash, Zsh, Cmd, etc.) using the `help` command as a primary method
     - **Available Script Interpreters**: Detect accessible runtime environments (Node.js, Python, Ruby, etc.)
   - Store all detected information separately for the duration of the request

2. **Select Appropriate Command Patterns**
   - Choose commands optimized for the detected terminal
   - For PowerShell:
     - Use cmdlets like `New-Item`, `Set-Content`, `Get-ChildItem` instead of Unix-style commands
     - Utilize `-Force` for operations that might require confirmation
     - Leverage parameter binding rather than positional parameters
   - For Bash/Unix:
     - Use commands like `mkdir -p`, `cat >`, `ls -la`
     - Implement proper quoting and escaping for special characters
     - Utilize stream redirection appropriately

3. **Apply Progressive Enhancement**
   - Begin with native terminal commands for simple operations
   - For repeated operations, implement command generation
   - For complex operations, develop custom tools
   - Make implementation decisions based on:
     - Command complexity
     - Frequency of use
     - Risk of failure
     - Performance requirements

4. **Maintain Strategy Consistency**
   - Store selected strategy in a state file (e.g., `command_interface_strategy.json`)
   - Apply consistent command patterns throughout the request
   - Update strategy only when terminal environment changes

5. **Implement Error Handling**
   - Anticipate common command failures
   - Include error checking in command sequences
   - Provide graceful fallbacks when primary commands fail
   - Log command failures with context for troubleshooting

## CUSTOM TOOL DEVELOPMENT

When developing custom tools to support command execution:

1. **Directory Structure**
   - Place execution entry points in `.caelaris/bin/` (as `.bat`, `.sh`, or binary)
   - Place implementation source in `.caelaris/tools/` (as `.ts`, `.js`, `.py`, etc.)

2. **Design Principles**
   - Create small, focused tools with single responsibilities
   - Ensure all tools are composable and self-contained
   - Implement proper separation of concerns
   - Minimize comments and complexity
   - Design for maximum reusability

3. **Implementation Pattern**
   - For complex tools, use modular autoloading architecture:
     - Single entry point: `.caelaris/tools/<tool_name>/<entrypoint>.<ext>`
     - Module organization: `.caelaris/tools/<tool_name>/modules/<module>.<ext>`
   - Support command hierarchy invocation:
     `.caelaris/bin/<tool_name> [module] [submodule] "arg1" "arg2" --flag`

## COMMAND GENERATION

For medium-complexity operations that don't warrant full custom tools:

1. **Package Script Commands**
   - Add to `package.json` scripts section for NPM/Yarn projects
   - Use appropriate script syntax for the target environment
   - Include necessary parameter handling

2. **Shell Configurations**
   - Create aliases or functions when appropriate
   - Ensure configurations are stored in project-specific locations
   - Document usage patterns

## EXAMPLE IMPLEMENTATIONS

### Directory Creation

**❌ Incorrect Approach**
```bash
mkdir .caelaris/plans .caelaris/proposed .caelaris/requests
```
*Problem: Will fail in PowerShell which doesn't support creating multiple directories in one command*

**✅ Correct Approach (Terminal-Aware)**
```powershell
# For PowerShell
New-Item -ItemType Directory -Path ".caelaris/plans",".caelaris/proposed",".caelaris/requests" -Force

# For Bash
mkdir -p .caelaris/plans .caelaris/proposed .caelaris/requests
```

### File Management

**❌ Incorrect Approach**
```bash
cat > .caelaris/requests/planning-$timestamp/meta.json << EOF
{
  "type": "planning",
  "timestamp": "$timestamp"
}
EOF
```
*Problem: Heredoc syntax not supported in PowerShell*

**✅ Correct Approach (Terminal-Aware)**
```powershell
# For PowerShell
$metaContent = @{
  type = "planning"
  timestamp = $timestamp
} | ConvertTo-Json
Set-Content -Path ".caelaris/requests/planning-$timestamp/meta.json" -Value $metaContent

# For Bash
cat > .caelaris/requests/planning-$timestamp/meta.json << EOF
{
  "type": "planning",
  "timestamp": "$timestamp"
}
EOF
```

## COMPLIANCE REQUIREMENTS

1. The agent MUST identify the terminal environment before executing commands
2. The agent MUST use terminal-appropriate commands for all operations
3. The agent SHOULD escalate to custom tools for complex or frequent operations
4. The agent MUST maintain strategy consistency throughout a request
5. The agent MUST implement appropriate error handling for commands