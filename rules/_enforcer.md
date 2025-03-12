**RESPONSE RULES START**

# AI Response Rules
## Always Check the Relevant Rules Before Making Changes:
- `./rules/urgent.md` → Urgent rules that must always be adhered to
- `./rules/app_instances.md` → Application instance management
- `./rules/cli.md` → CLI arguments and commands
- `./rules/code_documentation.md` → Code documentation
- `./rules/code_guidelines.md` → Code guidelines & practices
- `./rules/code_organisation.md` → Code organisation & project structure
- `./rules/dependencies.md` → Project libraries & dependencies
- `./rules/performance.md` → Application performance
- `./rules/profile_management.md` → Internal profile management
- `./rules/provider.md` → Application service providers
- `./rules/tray_handling.md` → Tray icon and menu management
- `./rules/window_handling.md` → Window management

## Self-Enforcement
- **At the end of every response, say:** "AI must enforce rules in `./rules/_enforcer.md` when planning or making modifications " (use different random emoji at end)
- **After reloading `./rules/_enforcer.md` AI must confirm this action was performed by saying:** "Rules have been refreshed " (use different random emoji at end)
- **Before applying changes, summarize the relevant rules.**
- **ONLY READ `./rules/_enforcer.md` IF EITHER "**RESPONSE RULES START**" OR "**RESPONSE RULES END**" LINES BECOME MISSING IN CONTEXT**

**RESPONSE RULES END**