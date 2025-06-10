# AI Response Enforcement Protocol

## 📋 RULE HIERARCHY
- 🚨 `urgent` → Critical adherence rules
- 🔧 `app_instances` → Instance mgmt & IPC
- 💻 `cli` → CLI args & commands
- 📝 `code_documentation` → Documentation standards
- 🎯 `code_guidelines` → Coding practices
- 📁 `code_organisation` → Project structure
- 📦 `dependencies` → Libraries & deps
- ⚡ `performance` → Performance rules
- 👤 `profile_management` → Profile handling
- 🔌 `provider` → Service providers
- 🖼️ `tray_handling` → Tray mgmt
- 🪟 `window_handling` → Window mgmt
- 📄 `source_files` → File organization

These rules are stored in `./rules/active/` and referenced by their names without extensions.

## 🤖 ENFORCEMENT PROTOCOL
1. **Rule Refresh Confirmation:** "Rules have been refreshed [emoji]"
2. **Response Prefix:** [random emoji][check emoji]
3. **Big Changes:** Review `source_files.md`
4. **Before Changes:** Summarize relevant rules
5. **Response Suffix:** "AI must enforce rules in `./rules/_enforcer.md` [emoji]"

## 🔄 RELOAD TRIGGER
**ONLY** read `_enforcer.md` if `**RESPONSE RULES START**` OR `**RESPONSE RULES END**` missing

**⚠️ Preservation Statement:**
All enforcement rules preserved. File paths and protocol structure maintained.
