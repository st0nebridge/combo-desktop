<!-- filepath: m:\Dev\Tools\combo-desktop\rules\compressed\code_guidelines.md\pcs_code_guidelines.L3.md -->
# PCS L3: Essential Coding Guidelines

**📊 Compression Metadata:**
- Level: L3 (Essential Protocol)
- Source: `../code_guidelines.md`
- Timestamp: 2025-06-10
- Token Reduction: ~70%
- Preservation: Core requirements (100%), essential practices (90%)

**🔗 Navigation:** [Source](../code_guidelines.md)

## 🎯 WET / AHA PRINCIPLES

### 💡 CORE RULES
1. **Clarity > Abstraction** → Explicit, self-contained functions
2. **Write Twice Rule** → No helper functions until 2+ uses
3. **Context-Specific Duplication** → Different business logic = separate code
4. **Composition > Inheritance** → Small modular functions, stable hierarchies only
5. **Delay Generalization** → Wait for natural patterns to emerge
6. **Optimize for Maintainability** → Explicit > concise but unclear
7. **Evolutionary Abstraction** → Isolated → patterns → extract common logic

### ❓ BEFORE REFACTORING ASK
- "Will this abstraction make future changes harder?"
- "Are these similar functions likely to evolve differently?"

### 🚫 AVOID
- ❌ Premature abstraction
- ❌ Generic utilities without clear reuse
- ❌ Flexible parameters/configs just for reuse
- ❌ Deep class hierarchies
- ❌ Generic, overly dynamic solutions

### ✅ PREFER
- ✅ Explicit, self-contained code
- ✅ Small, focused abstractions
- ✅ Natural pattern emergence
- ✅ Clear, stable hierarchies

**💡 Rule of Thumb:** Duplication is cheaper than the wrong abstraction.

**⚠️ Preservation Statement:**
Core WET/AHA principles preserved. Implementation guidelines condensed to essential rules.
